import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma, TestStatus, ResultVisibility } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth-guard";
import { isStudentEligible } from "@/lib/test-eligibility";
import { sendNotificationForTest } from "@/lib/test-notifications";

const updateTestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  passingMarks: z.number().int().min(0).optional(),
  shuffleQuestions: z.boolean().optional(),
  status: z.nativeEnum(TestStatus).optional(),
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
  allowedDepartmentIds: z.array(z.string()).nullable().optional(),
  allowedSemesters: z.array(z.number().int().min(1).max(8)).nullable().optional(),
  allowedStudentIds: z.array(z.string()).nullable().optional(),
  resultVisibility: z.nativeEnum(ResultVisibility).optional(),
  showResults: z.boolean().optional(),
  maxViolations: z.number().int().min(0).optional(),
  enableTabSwitchDetection: z.boolean().optional(),
  enableFullscreenDetection: z.boolean().optional(),
  enableCopyPasteDetection: z.boolean().optional(),
  enableRefreshDetection: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ testId: string }> };

async function getTestWithAuth(testId: string) {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = session.user as {
    id: string;
    role: string;
    collegeId: string | null;
  };

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      drive: {
        select: {
          id: true,
          title: true,
          companyName: true,
          collegeId: true,
          college: { select: { id: true, name: true } },
        },
      },
      _count: { select: { questions: true, attempts: true } },
    },
  });

  if (!test) {
    return { error: NextResponse.json({ error: "Test not found" }, { status: 404 }) };
  }

  // College admin and students can only access their own college's tests
  if (
    (user.role === "COLLEGE_ADMIN" || user.role === "STUDENT") &&
    test.drive.collegeId !== user.collegeId
  ) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session, user, test };
}

// GET /api/tests/[testId] — get a single test
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;
    const result = await getTestWithAuth(testId);
    if ("error" in result) return result.error;

    // Students can only view tests they are eligible for
    if (result.user.role === "STUDENT") {
      const student = await prisma.user.findUnique({
        where: { id: result.user.id },
        select: { id: true, departmentId: true, semester: true },
      });
      if (!student || !isStudentEligible(result.test, student)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(result.test);
  } catch (error) {
    console.error("GET /api/tests/[testId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/tests/[testId] — update a test
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;
    const result = await getTestWithAuth(testId);
    if ("error" in result) return result.error;

    const { user } = result;
    if (user.role !== "COLLEGE_ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateTestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.startTime !== undefined) {
      updateData.startTime = parsed.data.startTime
        ? new Date(parsed.data.startTime)
        : null;
      // Reset notification flag when start time changes so students get re-notified
      updateData.notificationSent = false;
    }
    if (parsed.data.endTime !== undefined) {
      updateData.endTime = parsed.data.endTime
        ? new Date(parsed.data.endTime)
        : null;
    }
    // Prisma requires DbNull to set nullable JSON fields to SQL NULL
    if (parsed.data.allowedDepartmentIds === null) {
      updateData.allowedDepartmentIds = Prisma.DbNull;
    }
    if (parsed.data.allowedSemesters === null) {
      updateData.allowedSemesters = Prisma.DbNull;
    }
    if (parsed.data.allowedStudentIds === null) {
      updateData.allowedStudentIds = Prisma.DbNull;
    }

    const test = await prisma.test.update({
      where: { id: testId },
      data: updateData,
      include: {
        drive: {
          select: {
            id: true,
            title: true,
            companyName: true,
            college: { select: { id: true, name: true } },
          },
        },
        _count: { select: { questions: true, attempts: true } },
      },
    });

    // If test is published with a startTime, try to send notifications (fire-and-forget)
    if (test.status === "PUBLISHED" && test.startTime) {
      sendNotificationForTest(testId).catch((err) =>
        console.error("Background notification error:", err)
      );
    }

    return NextResponse.json(test);
  } catch (error) {
    console.error("PUT /api/tests/[testId] error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/tests/[testId] — delete a test
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;
    const result = await getTestWithAuth(testId);
    if ("error" in result) return result.error;

    const { user } = result;
    if (user.role !== "COLLEGE_ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.test.delete({ where: { id: testId } });

    return NextResponse.json({ message: "Test deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/tests/[testId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
