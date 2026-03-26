import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { QuestionType, Difficulty } from "@/generated/prisma/client";

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

const mcqSchema = z.object({
  questionText: z.string().min(1, "Question text is required"),
  questionType: z.enum(["SINGLE_SELECT", "MULTI_SELECT"]),
  options: z.array(optionSchema).min(2, "At least 2 options are required"),
  correctOptionIds: z.array(z.string()).min(1, "At least 1 correct option is required"),
  marks: z.number().int().positive().default(1),
  negativeMarks: z.number().min(0).default(0),
  explanation: z.string().optional().nullable(),
  categories: z.array(z.string().min(1)).min(1, "At least one category is required"),
  difficulty: z.nativeEnum(Difficulty).default("MEDIUM"),
  scope: z.enum(["global", "private"]).default("global"),
  codeBlock: z.string().optional().nullable(),
  codeLanguage: z.string().optional().nullable(),
  imageUrls: z.array(z.string()).optional().nullable(),
});

const codingSchema = z.object({
  questionText: z.string().min(1, "Question text is required"),
  questionType: z.literal("CODING"),
  testCases: z.array(testCaseSchema).min(1, "At least 1 test case is required"),
  marks: z.number().int().positive().default(1),
  negativeMarks: z.number().min(0).default(0),
  explanation: z.string().optional().nullable(),
  categories: z.array(z.string().min(1)).min(1, "At least one category is required"),
  difficulty: z.nativeEnum(Difficulty).default("MEDIUM"),
  scope: z.enum(["global", "private"]).default("global"),
  codeBlock: z.string().optional().nullable(),
  codeLanguage: z.string().optional().nullable(),
  imageUrls: z.array(z.string()).optional().nullable(),
});

const createSchema = z.discriminatedUnion("questionType", [
  mcqSchema.extend({ questionType: z.literal("SINGLE_SELECT") }),
  mcqSchema.extend({ questionType: z.literal("MULTI_SELECT") }),
  codingSchema,
]);

// GET /api/library/questions — list library questions with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string; collegeId: string | null };
    if (user.role !== "SUPER_ADMIN" && user.role !== "COLLEGE_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const difficulty = searchParams.get("difficulty");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const scope = searchParams.get("scope"); // "global" | "private"
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // Build AND conditions array for Prisma
    const andConditions: Record<string, unknown>[] = [];

    // Scope filter — default to "global" if not specified
    const effectiveScope = scope || "global";
    if (effectiveScope === "global") {
      andConditions.push({ collegeId: { equals: null } });
    } else if (effectiveScope === "private") {
      if (user.role === "COLLEGE_ADMIN") {
        andConditions.push({ collegeId: { equals: user.collegeId } });
      } else {
        // SUPER_ADMIN sees all private questions
        andConditions.push({ NOT: { collegeId: { equals: null } } });
      }
    }

    if (category) andConditions.push({ categories: { has: category } });
    if (difficulty && Object.values(Difficulty).includes(difficulty as Difficulty)) {
      andConditions.push({ difficulty });
    }
    if (type && Object.values(QuestionType).includes(type as QuestionType)) {
      andConditions.push({ questionType: type });
    }
    if (search) {
      andConditions.push({ questionText: { contains: search, mode: "insensitive" } });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const [questions, total] = await Promise.all([
      prisma.libraryQuestion.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          createdBy: { select: { name: true } },
          college: { select: { name: true } },
          testCases: true,
        },
      }),
      prisma.libraryQuestion.count({ where }),
    ]);

    return NextResponse.json({
      questions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET /api/library/questions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/library/questions — create a library question
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
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const isCoding = data.questionType === "CODING";

    // Determine collegeId based on scope
    let collegeId: string | null = null;
    if (data.scope === "private") {
      if (user.role !== "COLLEGE_ADMIN" || !user.collegeId) {
        return NextResponse.json(
          { error: "Only college admins can create private questions" },
          { status: 403 }
        );
      }
      collegeId = user.collegeId;
    }

    // Validate correctOptionIds for MCQ
    if (!isCoding) {
      const d = data as z.infer<typeof mcqSchema>;
      const optionIds = d.options.map((o) => o.id);
      const invalidIds = d.correctOptionIds.filter((id) => !optionIds.includes(id));
      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: "Invalid correct option IDs", details: `These IDs are not in options: ${invalidIds.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const question = await prisma.$transaction(async (tx) => {
      const created = await tx.libraryQuestion.create({
        data: {
          questionText: data.questionText,
          questionType: data.questionType as QuestionType,
          options: isCoding ? [] : (data as z.infer<typeof mcqSchema>).options,
          correctOptionIds: isCoding ? [] : (data as z.infer<typeof mcqSchema>).correctOptionIds,
          marks: data.marks,
          negativeMarks: data.negativeMarks,
          explanation: data.explanation,
          categories: data.categories,
          difficulty: data.difficulty,
          collegeId,
          createdById: user.id,
          codeBlock: data.codeBlock ?? null,
          codeLanguage: data.codeLanguage ?? null,
          imageUrls: data.imageUrls ?? undefined,
        },
        include: { testCases: true },
      });

      if (isCoding) {
        const codingData = data as z.infer<typeof codingSchema>;
        await tx.libraryTestCase.createMany({
          data: codingData.testCases.map((tc, idx) => ({
            libraryQuestionId: created.id,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isSample: tc.isSample ?? false,
            order: tc.order ?? idx,
          })),
        });

        return tx.libraryQuestion.findUnique({
          where: { id: created.id },
          include: { testCases: true },
        });
      }

      return created;
    });

    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    console.error("POST /api/library/questions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
