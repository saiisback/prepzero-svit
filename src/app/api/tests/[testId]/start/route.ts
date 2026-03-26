import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { isStudentEligible } from "@/lib/test-eligibility";

type RouteParams = { params: Promise<{ testId: string }> };

// POST /api/tests/[testId]/start — student starts a test attempt
export async function POST(_request: NextRequest, { params }: RouteParams) {
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

    if (user.role !== "STUDENT") {
      return NextResponse.json(
        { error: "Only students can start tests" },
        { status: 403 }
      );
    }

    const { testId } = await params;

    // Fetch the test and verify it's published
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        drive: { select: { collegeId: true } },
      },
    });

    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    // Verify test belongs to student's college
    if (test.drive.collegeId !== user.collegeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check eligibility
    const student = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, departmentId: true, semester: true },
    });

    if (
      !student ||
      !isStudentEligible(test, student)
    ) {
      return NextResponse.json(
        { error: "You are not eligible for this test" },
        { status: 403 }
      );
    }

    // Verify test is published
    if (test.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Test is not available for taking" },
        { status: 400 }
      );
    }

    // Check time window if set
    const now = new Date();
    if (test.startTime && now < test.startTime) {
      return NextResponse.json(
        { error: "Test has not started yet" },
        { status: 400 }
      );
    }
    if (test.endTime && now > test.endTime) {
      return NextResponse.json(
        { error: "Test has ended" },
        { status: 400 }
      );
    }

    // Check for existing attempt (one per student per test)
    const existingAttempt = await prisma.testAttempt.findUnique({
      where: {
        testId_studentId: {
          testId,
          studentId: user.id,
        },
      },
    });

    if (existingAttempt) {
      // If in progress, bind to current session and return
      if (existingAttempt.status === "IN_PROGRESS") {
        // Detect multi-device attempt: session changed while test is in progress
        const oldSessionId = existingAttempt.activeSessionId;
        const newSessionId = session.session.id;

        if (oldSessionId && oldSessionId !== newSessionId) {
          // Atomic compare-and-swap: only the first request that changes the session sends a notification.
          // updateMany returns count=0 if activeSessionId was already changed by a concurrent request.
          const { count } = await prisma.testAttempt.updateMany({
            where: {
              id: existingAttempt.id,
              activeSessionId: oldSessionId,
            },
            data: { activeSessionId: newSessionId, lastHeartbeat: new Date() },
          });

          if (count > 0) {
            // We won the race — send exactly one notification
            const studentInfo = await prisma.user.findUnique({
              where: { id: user.id },
              select: { name: true, email: true },
            });

            const hdrs = await nextHeaders();
            const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "Unknown";
            const userAgent = hdrs.get("user-agent") || "Unknown";

            await prisma.notification.create({
              data: {
                collegeId: test.drive.collegeId,
                type: "SESSION_CONFLICT",
                title: "Multi-device test attempt detected",
                message: `${studentInfo?.name ?? "A student"} (${studentInfo?.email ?? user.id}) opened "${test.title}" on a different device during the test.`,
                metadata: {
                  studentId: user.id,
                  studentName: studentInfo?.name,
                  studentEmail: studentInfo?.email,
                  testId,
                  testTitle: test.title,
                  attemptId: existingAttempt.id,
                  ip,
                  userAgent,
                },
              },
            });
          }
          // else: another request already changed the session — skip notification
        } else {
          // Same session or first time — just update heartbeat
          await prisma.testAttempt.update({
            where: { id: existingAttempt.id },
            data: { activeSessionId: newSessionId, lastHeartbeat: new Date() },
          });
        }

        // Re-fetch the updated attempt to return
        const updated = await prisma.testAttempt.findUnique({
          where: { id: existingAttempt.id },
        });
        return NextResponse.json(updated);
      }
      // If already submitted or timed out, cannot retake
      return NextResponse.json(
        { error: "You have already attempted this test" },
        { status: 409 }
      );
    }

    // Create new attempt
    try {
      const attempt = await prisma.testAttempt.create({
        data: {
          testId,
          studentId: user.id,
          status: "IN_PROGRESS",
          totalMarks: test.totalMarks,
          maxViolations: test.maxViolations,
          activeSessionId: session.session.id,
          lastHeartbeat: new Date(),
        },
      });

      return NextResponse.json(attempt, { status: 201 });
    } catch (createError: unknown) {
      // Handle race condition: if another request created the attempt first
      if (
        typeof createError === "object" &&
        createError !== null &&
        "code" in createError &&
        (createError as { code: string }).code === "P2002"
      ) {
        const existing = await prisma.testAttempt.findUnique({
          where: { testId_studentId: { testId, studentId: user.id } },
        });
        if (existing?.status === "IN_PROGRESS") {
          return NextResponse.json(existing);
        }
        return NextResponse.json(
          { error: "You have already attempted this test" },
          { status: 409 }
        );
      }
      throw createError;
    }
  } catch (error) {
    console.error("POST /api/tests/[testId]/start error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
