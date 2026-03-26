import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

type RouteParams = { params: Promise<{ attemptId: string }> };

// GET /api/attempts/[attemptId] — attempt details with answers and questions
export async function GET(_request: NextRequest, { params }: RouteParams) {
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

    const { attemptId } = await params;

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: {
          include: {
            drive: {
              select: {
                id: true,
                title: true,
                companyName: true,
                collegeId: true,
              },
            },
            questions: {
              orderBy: { order: "asc" },
              include: {
                testCases: true,
              },
            },
          },
        },
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        answers: {
          include: {
            question: true,
          },
          orderBy: { answeredAt: "asc" },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }

    // Access control
    if (user.role === "STUDENT") {
      // Students can only view their own attempts
      if (attempt.studentId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (user.role === "COLLEGE_ADMIN") {
      // College admins can view attempts for their college's tests
      if (attempt.test.drive.collegeId !== user.collegeId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    // SUPER_ADMIN can view all attempts

    // If student and attempt is still in progress, hide correct answers and hidden test cases
    if (user.role === "STUDENT" && attempt.status === "IN_PROGRESS") {
      const sanitizedQuestions = attempt.test.questions.map(
        ({ correctOptionIds: _c, explanation: _e, testCases, ...rest }) => ({
          ...rest,
          // Only show sample test cases for coding questions during the test
          ...(rest.questionType === "CODING"
            ? { testCases: testCases.filter((tc) => tc.isSample) }
            : {}),
        })
      );
      return NextResponse.json({
        ...attempt,
        test: {
          ...attempt.test,
          questions: sanitizedQuestions,
        },
      });
    }

    return NextResponse.json(attempt);
  } catch (error) {
    console.error("GET /api/attempts/[attemptId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/attempts/[attemptId] — allow retake by deleting a completed attempt
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
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

    if (user.role === "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { attemptId } = await params;

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: {
          include: {
            drive: {
              select: { collegeId: true },
            },
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }

    if (
      user.role === "COLLEGE_ADMIN" &&
      attempt.test.drive.collegeId !== user.collegeId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (attempt.status === "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Cannot delete an in-progress attempt. Wait for submission or timeout." },
        { status: 400 }
      );
    }

    await prisma.testAttempt.delete({ where: { id: attemptId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/attempts/[attemptId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
