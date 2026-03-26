import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { isStudentEligible } from "@/lib/test-eligibility";
import { TestStatus, ResultVisibility } from "@/generated/prisma/client";

const createTestSchema = z.object({
  driveId: z.string().min(1, "Drive ID is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  instructions: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  passingMarks: z.number().int().min(0).optional(),
  shuffleQuestions: z.boolean().optional(),
  status: z.nativeEnum(TestStatus).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  allowedDepartmentIds: z.array(z.string()).nullable().optional(),
  allowedSemesters: z.array(z.number().int().min(1).max(8)).nullable().optional(),
  allowedStudentIds: z.array(z.string()).nullable().optional(),
  resultVisibility: z.nativeEnum(ResultVisibility).optional(),
  maxViolations: z.number().int().min(0).optional(),
  enableTabSwitchDetection: z.boolean().optional(),
  enableFullscreenDetection: z.boolean().optional(),
  enableCopyPasteDetection: z.boolean().optional(),
  enableRefreshDetection: z.boolean().optional(),
});

// GET /api/tests — list tests (optionally filter by driveId query param)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as {
      id: string;
      role: string;
      collegeId: string | null;
    };

    const { searchParams } = new URL(request.url);
    const driveId = searchParams.get("driveId");

    // Build where clause based on role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (driveId) {
      where.driveId = driveId;
    }

    // College admin: only tests from their college's drives
    if (user.role === "COLLEGE_ADMIN") {
      where.drive = { collegeId: user.collegeId };
    }
    // Student: only published tests from their college's drives
    else if (user.role === "STUDENT") {
      where.drive = { collegeId: user.collegeId };
      where.status = "PUBLISHED";
    }
    // SUPER_ADMIN: no additional filter

    const allTests = await prisma.test.findMany({
      where,
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
      orderBy: { createdAt: "desc" },
    });

    // Filter by eligibility for students
    if (user.role === "STUDENT") {
      const student = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, departmentId: true, semester: true },
      });
      if (student) {
        const tests = allTests.filter((test) => isStudentEligible(test, student));
        return NextResponse.json(tests);
      }
    }

    return NextResponse.json(allTests);
  } catch (error) {
    console.error("GET /api/tests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/tests — create a test under a drive (verify drive belongs to user's college)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as {
      id: string;
      role: string;
      collegeId: string | null;
    };

    if (user.role !== "COLLEGE_ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createTestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify drive exists and belongs to user's college
    const drive = await prisma.placementDrive.findUnique({
      where: { id: parsed.data.driveId },
    });

    if (!drive) {
      return NextResponse.json({ error: "Drive not found" }, { status: 404 });
    }

    if (
      user.role === "COLLEGE_ADMIN" &&
      drive.collegeId !== user.collegeId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { allowedDepartmentIds, allowedSemesters, allowedStudentIds, ...rest } = parsed.data;
    const test = await prisma.test.create({
      data: {
        ...rest,
        startTime: rest.startTime ? new Date(rest.startTime) : undefined,
        endTime: rest.endTime ? new Date(rest.endTime) : undefined,
        ...(allowedDepartmentIds !== undefined && {
          allowedDepartmentIds: allowedDepartmentIds ?? undefined,
        }),
        ...(allowedSemesters !== undefined && {
          allowedSemesters: allowedSemesters ?? undefined,
        }),
        ...(allowedStudentIds !== undefined && {
          allowedStudentIds: allowedStudentIds ?? undefined,
        }),
      },
      include: {
        drive: {
          select: {
            id: true,
            title: true,
            companyName: true,
            college: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(test, { status: 201 });
  } catch (error) {
    console.error("POST /api/tests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
