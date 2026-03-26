import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

const importSchema = z.object({
  testId: z.string().min(1, "Test ID is required"),
  questionIds: z.array(z.string()).min(1, "At least 1 question is required"),
});

// POST /api/library/questions/import — import library questions into a test
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string; collegeId: string | null };
    if (user.role !== "COLLEGE_ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { testId, questionIds } = parsed.data;

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

    // Fetch library questions
    const libraryQuestions = await prisma.libraryQuestion.findMany({
      where: { id: { in: questionIds } },
      include: { testCases: { orderBy: { order: "asc" } } },
    });

    if (libraryQuestions.length === 0) {
      return NextResponse.json({ error: "No valid questions found" }, { status: 404 });
    }

    // Get current max order
    const lastQuestion = await prisma.question.findFirst({
      where: { testId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const startOrder = (lastQuestion?.order ?? -1) + 1;

    const result = await prisma.$transaction(async (tx) => {
      let imported = 0;

      for (let i = 0; i < libraryQuestions.length; i++) {
        const lq = libraryQuestions[i];

        const created = await tx.question.create({
          data: {
            testId,
            questionText: lq.questionText,
            questionType: lq.questionType,
            options: lq.options as object,
            correctOptionIds: lq.correctOptionIds as object,
            marks: lq.marks,
            negativeMarks: lq.negativeMarks,
            explanation: lq.explanation,
            order: startOrder + i,
            codeBlock: lq.codeBlock,
            codeLanguage: lq.codeLanguage,
            imageUrls: lq.imageUrls ?? undefined,
          },
        });

        // Copy test cases for coding questions
        if (lq.questionType === "CODING" && lq.testCases.length > 0) {
          await tx.testCase.createMany({
            data: lq.testCases.map((tc) => ({
              questionId: created.id,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isSample: tc.isSample,
              order: tc.order,
            })),
          });
        }

        imported++;
      }

      // Recalculate totalMarks
      const allQuestions = await tx.question.findMany({
        where: { testId },
        select: { marks: true },
      });
      const totalMarks = allQuestions.reduce((sum, q) => sum + q.marks, 0);

      await tx.test.update({
        where: { id: testId },
        data: { totalMarks },
      });

      return { imported, totalMarks };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/library/questions/import error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
