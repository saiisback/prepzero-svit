import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { QuestionType } from "@/generated/prisma/client";

const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

const testCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string().min(1, "Expected output is required"),
  isSample: z.boolean().default(false),
  order: z.number().int().min(0).default(0),
});

const mcqQuestionSchema = z.object({
  questionText: z.string().min(1, "Question text is required"),
  imageUrl: z.string().optional(),
  questionType: z.enum(["SINGLE_SELECT", "MULTI_SELECT"]).optional(),
  options: z.array(optionSchema).min(2, "At least 2 options are required"),
  correctOptionIds: z
    .array(z.string())
    .min(1, "At least 1 correct option is required"),
  marks: z.number().int().positive().optional(),
  negativeMarks: z.number().min(0).optional(),
  explanation: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
  codeBlock: z.string().optional().nullable(),
  codeLanguage: z.string().optional().nullable(),
  imageUrls: z.array(z.string()).optional().nullable(),
});

const codingQuestionSchema = z.object({
  questionText: z.string().min(1, "Question text is required"),
  imageUrl: z.string().optional(),
  questionType: z.literal("CODING"),
  testCases: z.array(testCaseSchema).min(1, "At least 1 test case is required"),
  marks: z.number().int().positive().optional(),
  negativeMarks: z.number().min(0).optional(),
  explanation: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
  codeBlock: z.string().optional().nullable(),
  codeLanguage: z.string().optional().nullable(),
  imageUrls: z.array(z.string()).optional().nullable(),
});

const createQuestionSchema = z.discriminatedUnion("questionType", [
  mcqQuestionSchema.extend({ questionType: z.literal("SINGLE_SELECT") }),
  mcqQuestionSchema.extend({ questionType: z.literal("MULTI_SELECT") }),
  codingQuestionSchema,
]);

// Also accept the legacy format (no questionType defaults to SINGLE_SELECT with MCQ fields)
const legacySchema = z.object({
  questionText: z.string().min(1, "Question text is required"),
  imageUrl: z.string().optional(),
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

type RouteParams = { params: Promise<{ testId: string }> };

async function verifyTestAccess(testId: string) {
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
      drive: { select: { collegeId: true } },
    },
  });

  if (!test) {
    return { error: NextResponse.json({ error: "Test not found" }, { status: 404 }) };
  }

  if (
    user.role === "COLLEGE_ADMIN" &&
    test.drive.collegeId !== user.collegeId
  ) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session, user, test };
}

// GET /api/tests/[testId]/questions — list questions for a test
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;
    const result = await verifyTestAccess(testId);
    if ("error" in result) return result.error;

    const { user } = result;

    const questions = await prisma.question.findMany({
      where: { testId },
      orderBy: { order: "asc" },
      include: {
        testCases: true,
      },
    });

    if (user.role === "STUDENT") {
      const sanitized = questions.map(
        ({ correctOptionIds: _c, explanation: _e, testCases, ...rest }) => ({
          ...rest,
          // Students only see sample test cases for coding questions
          ...(rest.questionType === "CODING"
            ? { testCases: testCases.filter((tc) => tc.isSample) }
            : {}),
        })
      );
      return NextResponse.json(sanitized);
    }

    return NextResponse.json(questions);
  } catch (error) {
    console.error("GET /api/tests/[testId]/questions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/tests/[testId]/questions — add a question to a test
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { testId } = await params;
    const result = await verifyTestAccess(testId);
    if ("error" in result) return result.error;

    const { user } = result;
    if (user.role !== "COLLEGE_ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Try discriminated union first, fallback to legacy
    const parsed = createQuestionSchema.safeParse(body);
    if (!parsed.success) {
      // Try legacy format
      const legacyParsed = legacySchema.safeParse(body);
      if (!legacyParsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      // Convert legacy to a usable format
      const data = legacyParsed.data;
      const qType = data.questionType || "SINGLE_SELECT";

      if (qType !== "CODING") {
        if (!data.options || data.options.length < 2) {
          return NextResponse.json(
            { error: "At least 2 options are required" },
            { status: 400 }
          );
        }
        if (!data.correctOptionIds || data.correctOptionIds.length === 0) {
          return NextResponse.json(
            { error: "At least 1 correct option is required" },
            { status: 400 }
          );
        }
      }
    }

    const data = parsed.success ? parsed.data : body;
    const questionType = data.questionType || "SINGLE_SELECT";
    const isCoding = questionType === "CODING";

    // Validate correctOptionIds for MCQ
    if (!isCoding) {
      const optionIds = data.options.map((o: { id: string }) => o.id);
      const invalidIds = data.correctOptionIds.filter(
        (id: string) => !optionIds.includes(id)
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

    // Create question and test cases in a transaction
    const question = await prisma.$transaction(async (tx) => {
      const created = await tx.question.create({
        data: {
          testId,
          questionText: data.questionText,
          imageUrl: data.imageUrl || null,
          questionType: questionType as QuestionType,
          options: isCoding ? [] : data.options,
          correctOptionIds: isCoding ? [] : data.correctOptionIds,
          marks: data.marks,
          negativeMarks: data.negativeMarks,
          explanation: data.explanation,
          order: data.order,
          codeBlock: data.codeBlock ?? null,
          codeLanguage: data.codeLanguage ?? null,
          imageUrls: data.imageUrls ?? undefined,
        },
        include: { testCases: true },
      });

      // Create test cases for coding questions
      if (isCoding && data.testCases && data.testCases.length > 0) {
        await tx.testCase.createMany({
          data: data.testCases.map(
            (
              tc: { input: string; expectedOutput: string; isSample?: boolean; order?: number },
              idx: number
            ) => ({
              questionId: created.id,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isSample: tc.isSample ?? false,
              order: tc.order ?? idx,
            })
          ),
        });

        // Re-fetch with test cases
        const withTestCases = await tx.question.findUnique({
          where: { id: created.id },
          include: { testCases: true },
        });
        if (withTestCases) return withTestCases;
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

      return created;
    });

    // Recalculate totalMarks (also needed when testCases branch returns early)
    const allQuestions = await prisma.question.findMany({
      where: { testId },
      select: { marks: true },
    });
    const totalMarks = allQuestions.reduce((sum, q) => sum + q.marks, 0);
    await prisma.test.update({
      where: { id: testId },
      data: { totalMarks },
    });

    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    console.error("POST /api/tests/[testId]/questions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
