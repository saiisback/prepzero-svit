import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { Difficulty } from "@/generated/prisma/client";

const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

const bulkQuestionSchema = z.object({
  questionText: z.string().min(1, "Question text is required"),
  questionType: z.enum(["SINGLE_SELECT", "MULTI_SELECT"]),
  options: z.array(optionSchema).min(2, "At least 2 options are required"),
  correctOptionIds: z.array(z.string()).min(1, "At least 1 correct option is required"),
  marks: z.number().int().positive(),
  negativeMarks: z.number().min(0),
  explanation: z.string().optional().nullable(),
  categories: z.array(z.string().min(1)).min(1, "At least one category is required"),
  difficulty: z.nativeEnum(Difficulty).default("MEDIUM"),
  codeBlock: z.string().optional().nullable(),
  codeLanguage: z.string().optional().nullable(),
  imageUrls: z.array(z.string()).optional().nullable(),
});

const bulkRequestSchema = z.object({
  questions: z
    .array(bulkQuestionSchema)
    .min(1, "At least 1 question is required")
    .max(100, "Maximum 100 questions per upload"),
  scope: z.enum(["global", "private"]).default("global"),
});

// POST /api/library/questions/bulk — bulk create library questions from CSV
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
    const parsed = bulkRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { questions, scope } = parsed.data;

    // Determine collegeId based on scope
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

    const result = await prisma.$transaction(async (tx) => {
      await tx.libraryQuestion.createMany({
        data: questions.map((q) => ({
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options,
          correctOptionIds: q.correctOptionIds,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          explanation: q.explanation,
          categories: q.categories,
          difficulty: q.difficulty,
          collegeId,
          createdById: user.id,
          codeBlock: q.codeBlock ?? null,
          codeLanguage: q.codeLanguage ?? null,
          imageUrls: q.imageUrls ?? undefined,
        })),
      });

      return { created: questions.length };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/library/questions/bulk error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
