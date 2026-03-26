import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { QuestionType, Difficulty } from "@/generated/prisma/client";

const filtersSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.string().optional(),
  type: z.string().optional(),
  scope: z.enum(["global", "private"]).optional(),
});

const requestSchema = z.object({
  questionIds: z.array(z.string()).min(1).optional(),
  filters: filtersSchema.optional(),
}).refine((d) => d.questionIds || d.filters, {
  message: "Either questionIds or filters must be provided",
});

function buildFilterWhere(
  role: string,
  collegeId: string | null,
  filters: z.infer<typeof filtersSchema>
): Record<string, unknown> {
  const andConditions: Record<string, unknown>[] = [];

  // Scope filter
  const effectiveScope = filters.scope || "global";
  if (effectiveScope === "global") {
    andConditions.push({ collegeId: { equals: null } });
  } else if (effectiveScope === "private") {
    if (role === "COLLEGE_ADMIN") {
      andConditions.push({ collegeId: { equals: collegeId } });
    } else {
      andConditions.push({ NOT: { collegeId: { equals: null } } });
    }
  }

  if (filters.category) andConditions.push({ categories: { has: filters.category } });
  if (filters.difficulty && Object.values(Difficulty).includes(filters.difficulty as Difficulty)) {
    andConditions.push({ difficulty: filters.difficulty });
  }
  if (filters.type && Object.values(QuestionType).includes(filters.type as QuestionType)) {
    andConditions.push({ questionType: filters.type });
  }
  if (filters.search) {
    andConditions.push({ questionText: { contains: filters.search, mode: "insensitive" } });
  }

  return andConditions.length > 0 ? { AND: andConditions } : {};
}

// POST /api/library/questions/bulk-delete — delete multiple library questions
// Accepts either { questionIds: [...] } or { filters: { search?, category?, difficulty?, type?, scope? } }
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

    let where: Record<string, unknown>;

    if (parsed.data.questionIds) {
      where = { id: { in: parsed.data.questionIds } };
      // College admins can only delete their own private questions
      if (user.role === "COLLEGE_ADMIN") {
        where.collegeId = user.collegeId;
      }
    } else {
      where = buildFilterWhere(user.role, user.collegeId, parsed.data.filters!);
      // Extra safety: college admins can never delete global questions via filters
      if (user.role === "COLLEGE_ADMIN") {
        (where as Record<string, unknown>).collegeId = user.collegeId;
      }
    }

    const result = await prisma.libraryQuestion.deleteMany({ where });

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("POST /api/library/questions/bulk-delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
