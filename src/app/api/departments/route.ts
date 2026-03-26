import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

const createDepartmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
});

// GET /api/departments — list departments for the college admin's college
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as {
      id: string;
      role: string;
      collegeId: string | null;
    };

    if (user.role !== "COLLEGE_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!user.collegeId) {
      return NextResponse.json(
        { error: "No college assigned to your account" },
        { status: 400 }
      );
    }

    const departments = await prisma.department.findMany({
      where: { collegeId: user.collegeId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(departments);
  } catch (error) {
    console.error("GET /api/departments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/departments — create a department
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as {
      id: string;
      role: string;
      collegeId: string | null;
    };

    if (user.role !== "COLLEGE_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!user.collegeId) {
      return NextResponse.json(
        { error: "No college assigned to your account" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = createDepartmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const department = await prisma.department.create({
      data: {
        ...parsed.data,
        collegeId: user.collegeId,
      },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    console.error("POST /api/departments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
