import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

type RouteParams = { params: Promise<{ categoryId: string }> };

const updateSchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
});

// PUT /api/library/categories/[categoryId] — rename a category
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { role: string; collegeId?: string };
    if (user.role !== "SUPER_ADMIN" && user.role !== "COLLEGE_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { categoryId } = await params;

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Super admin can edit global categories only
    if (user.role === "SUPER_ADMIN" && category.collegeId !== null) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // College admin can only edit their own college categories, not global ones
    if (user.role === "COLLEGE_ADMIN") {
      if (category.collegeId === null || category.collegeId !== user.collegeId) {
        return NextResponse.json({ error: "Cannot edit global categories" }, { status: 403 });
      }
    }

    const newName = parsed.data.name.trim();

    // Check for duplicate name within the same scope
    const existing = await prisma.category.findFirst({
      where: {
        name: newName,
        collegeId: category.collegeId === null ? { equals: null } : category.collegeId,
        id: { not: categoryId },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: { name: newName },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      isGlobal: updated.collegeId === null,
    });
  } catch (error) {
    console.error("PUT /api/library/categories/[categoryId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/library/categories/[categoryId]
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { role: string; collegeId?: string };
    if (user.role !== "SUPER_ADMIN" && user.role !== "COLLEGE_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { categoryId } = await params;

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Super admin can only delete global categories
    if (user.role === "SUPER_ADMIN" && category.collegeId !== null) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // College admin can only delete their own college categories
    if (user.role === "COLLEGE_ADMIN") {
      if (category.collegeId === null || category.collegeId !== user.collegeId) {
        return NextResponse.json({ error: "Cannot delete global categories" }, { status: 403 });
      }
    }

    await prisma.category.delete({ where: { id: categoryId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/library/categories/[categoryId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
