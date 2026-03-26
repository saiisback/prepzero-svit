import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import type { Prisma } from "@/generated/prisma/client";

// GET /api/library/categories — list managed categories
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { role: string; collegeId?: string | null };
    if (user.role !== "SUPER_ADMIN" && user.role !== "COLLEGE_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let where: Prisma.CategoryWhereInput;

    if (user.role === "SUPER_ADMIN") {
      where = { collegeId: { equals: null } };
    } else if (user.collegeId) {
      where = {
        OR: [
          { collegeId: { equals: null } },
          { collegeId: user.collegeId },
        ],
      };
    } else {
      where = { collegeId: { equals: null } };
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: { name: "asc" },
    });

    // Also fetch distinct category strings from existing library questions (categories is String[])
    const allQuestions = await prisma.libraryQuestion.findMany({
      select: { categories: true },
    });
    const distinctCategoryNames = new Set<string>();
    for (const q of allQuestions) {
      for (const cat of q.categories) {
        if (cat) distinctCategoryNames.add(cat);
      }
    }

    // Merge managed categories with distinct question categories
    const managedNames = new Set(categories.map((c) => c.name));
    const result = categories.map((c) => ({
      id: c.id,
      name: c.name,
      isGlobal: c.collegeId === null,
    }));

    for (const catName of distinctCategoryNames) {
      if (!managedNames.has(catName)) {
        result.push({ id: catName, name: catName, isGlobal: true });
      }
    }

    result.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/library/categories error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
});

// POST /api/library/categories — create a category
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string; collegeId?: string | null };
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

    const name = parsed.data.name.trim();
    const collegeId = user.role === "SUPER_ADMIN" ? null : (user.collegeId || null);

    // Check for duplicate name within scope
    const existingWhere: Prisma.CategoryWhereInput = collegeId === null
      ? { name, collegeId: { equals: null } }
      : { name, collegeId };

    const existing = await prisma.category.findFirst({ where: existingWhere });

    if (existing) {
      return NextResponse.json({ error: "Category already exists" }, { status: 409 });
    }

    // For college admin, also check if a global category with the same name exists
    if (collegeId !== null) {
      const globalExists = await prisma.category.findFirst({
        where: { name, collegeId: { equals: null } },
      });
      if (globalExists) {
        return NextResponse.json(
          { error: "A global category with this name already exists" },
          { status: 409 }
        );
      }
    }

    const category = await prisma.category.create({
      data: { name, collegeId },
    });

    return NextResponse.json(
      { id: category.id, name: category.name, isGlobal: category.collegeId === null },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/library/categories error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
