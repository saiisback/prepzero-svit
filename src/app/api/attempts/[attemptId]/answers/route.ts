import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { validateAttemptSession } from "@/lib/attempt-session";

const saveAnswerSchema = z.object({
  questionId: z.string().min(1, "Question ID is required"),
  selectedOptionIds: z.array(z.string()).default([]),
  code: z.string().max(50000).optional(),
  language: z.enum(["PYTHON", "JAVA", "C", "CPP"]).optional(),
});

type RouteParams = { params: Promise<{ attemptId: string }> };

// PUT /api/attempts/[attemptId]/answers — save/update a single answer (auto-save)
export async function PUT(request: NextRequest, { params }: RouteParams) {
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
        { error: "Only students can save answers" },
        { status: 403 }
      );
    }

    const { attemptId } = await params;

    // Verify the attempt exists and belongs to the student
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }

    if (attempt.studentId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Cannot modify a submitted attempt" },
        { status: 400 }
      );
    }

    // Validate session — prevent multi-device access
    const sessionError = await validateAttemptSession(attemptId, session.session.id);
    if (sessionError) return sessionError;

    const body = await request.json();
    const parsed = saveAnswerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify the question belongs to the test
    const question = await prisma.question.findUnique({
      where: { id: parsed.data.questionId },
    });

    if (!question || question.testId !== attempt.testId) {
      return NextResponse.json(
        { error: "Question does not belong to this test" },
        { status: 400 }
      );
    }

    // Only validate option IDs for MCQ questions
    if (question.questionType !== "CODING") {
      const optionIds = (question.options as Array<{ id: string }>).map(
        (o) => o.id
      );
      const invalidIds = parsed.data.selectedOptionIds.filter(
        (id) => !optionIds.includes(id)
      );
      if (invalidIds.length > 0) {
        return NextResponse.json(
          {
            error: "Invalid option IDs",
            details: `These IDs are not valid options: ${invalidIds.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Upsert the answer
    const answer = await prisma.answer.upsert({
      where: {
        attemptId_questionId: {
          attemptId,
          questionId: parsed.data.questionId,
        },
      },
      update: {
        selectedOptionIds: parsed.data.selectedOptionIds,
        ...(parsed.data.code !== undefined ? { code: parsed.data.code } : {}),
        ...(parsed.data.language !== undefined ? { language: parsed.data.language } : {}),
        answeredAt: new Date(),
      },
      create: {
        attemptId,
        questionId: parsed.data.questionId,
        selectedOptionIds: parsed.data.selectedOptionIds,
        ...(parsed.data.code !== undefined ? { code: parsed.data.code } : {}),
        ...(parsed.data.language !== undefined ? { language: parsed.data.language } : {}),
      },
    });

    return NextResponse.json(answer);
  } catch (error) {
    console.error("PUT /api/attempts/[attemptId]/answers error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
