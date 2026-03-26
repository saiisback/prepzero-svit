import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { Prisma, QuestionType } from "@/generated/prisma/client";

const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

const testCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string().min(1),
  isSample: z.boolean().default(false),
  order: z.number().int().min(0).default(0),
});

const updateQuestionSchema = z.object({
  questionText: z.string().min(1).optional(),
  imageUrl: z.string().optional().nullable(),
  questionType: z.nativeEnum(QuestionType).optional(),
  options: z.array(optionSchema).min(2).optional(),
  correctOptionIds: z.array(z.string()).min(1).optional(),
  testCases: z.array(testCaseSchema).optional(),
  marks: z.number().int().positive().optional(),
  negativeMarks: z.number().min(0).optional(),
  explanation: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
  codeBlock: z.string().optional().nullable(),
  codeLanguage: z.string().optional().nullable(),
  imageUrls: z.array(z.string()).optional().nullable(),
});

type RouteParams = {
  params: Promise<{ testId: string; questionId: string }>;
};

async function verifyQuestionAccess(testId: string, questionId: string) {
  const session = await getSession();
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const user = session.user as {
    id: string;
    role: string;
    collegeId: string | null;
  };

  if (user.role !== "COLLEGE_ADMIN" && user.role !== "SUPER_ADMIN") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      test: {
        include: {
          drive: { select: { collegeId: true } },
        },
      },
    },
  });

  if (!question || question.testId !== testId) {
    return {
      error: NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      ),
    };
  }

  if (
    user.role === "COLLEGE_ADMIN" &&
    question.test.drive.collegeId !== user.collegeId
  ) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { session, user, question };
}

// PUT /api/tests/[testId]/questions/[questionId] — update a question
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId, questionId } = await params;
    const result = await verifyQuestionAccess(testId, questionId);
    if ("error" in result) return result.error;

    const body = await request.json();
    const parsed = updateQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // If both options and correctOptionIds are provided, validate consistency
    if (parsed.data.options && parsed.data.correctOptionIds) {
      const optionIds = parsed.data.options.map((o) => o.id);
      const invalidIds = parsed.data.correctOptionIds.filter(
        (id) => !optionIds.includes(id)
      );
      if (invalidIds.length > 0) {
        return NextResponse.json(
          {
            error: "Invalid correct option IDs",
            details: `These IDs are not in options: ${invalidIds.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    const { testCases, imageUrls, ...questionData } = parsed.data;

    const question = await prisma.$transaction(async (tx) => {
      const updated = await tx.question.update({
        where: { id: questionId },
        data: {
          ...questionData,
          ...(imageUrls !== undefined && { imageUrls: imageUrls ?? Prisma.JsonNull }),
        },
        include: { testCases: true },
      });

      // If testCases provided (coding question), replace them
      if (testCases !== undefined) {
        await tx.testCase.deleteMany({ where: { questionId } });
        if (testCases.length > 0) {
          await tx.testCase.createMany({
            data: testCases.map((tc, idx) => ({
              questionId,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isSample: tc.isSample,
              order: tc.order ?? idx,
            })),
          });
        }
      }

      // Recalculate totalMarks
      const questions = await tx.question.findMany({
        where: { testId },
        select: { marks: true },
      });
      const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

      await tx.test.update({
        where: { id: testId },
        data: { totalMarks },
      });

      return tx.question.findUnique({
        where: { id: questionId },
        include: { testCases: true },
      });
    });

    return NextResponse.json(question);
  } catch (error) {
    console.error(
      "PUT /api/tests/[testId]/questions/[questionId] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/tests/[testId]/questions/[questionId] — delete a question
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { testId, questionId } = await params;
    const result = await verifyQuestionAccess(testId, questionId);
    if ("error" in result) return result.error;

    await prisma.$transaction(async (tx) => {
      await tx.question.delete({ where: { id: questionId } });

      // Recalculate totalMarks
      const questions = await tx.question.findMany({
        where: { testId },
        select: { marks: true },
      });
      const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

      await tx.test.update({
        where: { id: testId },
        data: { totalMarks },
      });
    });

    return NextResponse.json({ message: "Question deleted successfully" });
  } catch (error) {
    console.error(
      "DELETE /api/tests/[testId]/questions/[questionId] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
