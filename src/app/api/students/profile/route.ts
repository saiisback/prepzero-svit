import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  semester: z.number().int().min(1).max(8).optional().nullable(),
});

// GET /api/students/profile — get current student's profile
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    if (user.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const student = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        usn: true,
        semester: true,
        college: { select: { name: true } },
        department: { select: { name: true, code: true } },
        createdAt: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(student);
  } catch (error) {
    console.error("GET /api/students/profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/students/profile — update current student's profile
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    if (user.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        email: true,
        usn: true,
        semester: true,
        college: { select: { name: true } },
        department: { select: { name: true, code: true } },
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/students/profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
