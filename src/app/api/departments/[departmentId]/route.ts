import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

const updateDepartmentSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional().nullable(),
});

type RouteParams = { params: Promise<{ departmentId: string }> };

async function getDepartmentWithAuth(departmentId: string) {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = session.user as {
    id: string;
    role: string;
    collegeId: string | null;
  };

  if (user.role !== "COLLEGE_ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
  });

  if (!department) {
    return { error: NextResponse.json({ error: "Department not found" }, { status: 404 }) };
  }

  if (department.collegeId !== user.collegeId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session, user, department };
}

// PUT /api/departments/[departmentId] — update a department
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { departmentId } = await params;
    const result = await getDepartmentWithAuth(departmentId);
    if ("error" in result) return result.error;

    const body = await request.json();
    const parsed = updateDepartmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const department = await prisma.department.update({
      where: { id: departmentId },
      data: parsed.data,
    });

    return NextResponse.json(department);
  } catch (error) {
    console.error("PUT /api/departments/[departmentId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/departments/[departmentId] — delete a department
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { departmentId } = await params;
    const result = await getDepartmentWithAuth(departmentId);
    if ("error" in result) return result.error;

    await prisma.department.delete({ where: { id: departmentId } });

    return NextResponse.json({ message: "Department deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/departments/[departmentId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
