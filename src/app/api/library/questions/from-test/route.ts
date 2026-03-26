import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

const requestSchema = z.object({
  testId: z.string().min(1),
  questionIds: z.array(z.string()).min(1, "At least 1 question is required"),
  scope: z.enum(["global", "private"]),
  categories: z.array(z.string().min(1)).min(1, "At least one category is required"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
});

// POST /api/library/questions/from-test — save test questions to library
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string; collegeId: string | null };
    if (user.role !== "SUPER_ADMIN" && user.role !== "COLLEGE_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { testId, questionIds, scope, categories, difficulty } = parsed.data;

    // Determine collegeId
    let collegeId: string | null = null;
    if (scope === "private") {
      if (user.role !== "COLLEGE_ADMIN" || !user.collegeId) {
        return NextResponse.json(
          { error: "Only college admins can create private questions" },
          { status: 403 }
        );
      }
      collegeId = user.collegeId;
    }

    // Verify test access
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { drive: { select: { collegeId: true } } },
    });

    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    if (user.role === "COLLEGE_ADMIN" && test.drive.collegeId !== user.collegeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch the test questions
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds }, testId },
      include: { testCases: true },
    });

    if (questions.length === 0) {
      return NextResponse.json({ error: "No valid questions found" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      let saved = 0;
      for (const q of questions) {
        const created = await tx.libraryQuestion.create({
          data: {
            questionText: q.questionText,
            questionType: q.questionType,
            options: q.options ?? [],
            correctOptionIds: q.correctOptionIds ?? [],
            marks: q.marks,
            negativeMarks: q.negativeMarks,
            explanation: q.explanation,
            codeBlock: q.codeBlock,
            codeLanguage: q.codeLanguage,
            imageUrls: q.imageUrls ?? undefined,
            categories,
            difficulty,
            collegeId,
            createdById: user.id,
          },
        });

        // Copy test cases for coding questions
        if (q.questionType === "CODING" && q.testCases.length > 0) {
          await tx.libraryTestCase.createMany({
            data: q.testCases.map((tc) => ({
              libraryQuestionId: created.id,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isSample: tc.isSample,
              order: tc.order,
            })),
          });
        }

        saved++;
      }
      return { saved };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/library/questions/from-test error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
