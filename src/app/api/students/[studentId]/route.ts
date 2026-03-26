import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

const updateStudentSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  usn: z.string().min(1).optional(),
  semester: z.number().int().min(1).max(8).nullable().optional(),
  departmentId: z.string().nullable().optional(),
});

type RouteParams = { params: Promise<{ studentId: string }> };

// PATCH /api/students/[studentId] — update a student's details (COLLEGE_ADMIN only)
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string; collegeId: string };
    if (user.role !== "COLLEGE_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { studentId } = await params;

    // Verify the student belongs to this college and is a student
    const student = await prisma.user.findFirst({
      where: {
        id: studentId,
        collegeId: user.collegeId,
        role: "STUDENT",
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateStudentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check email uniqueness if email is being changed
    if (data.email && data.email !== student.email) {
      const existing = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 409 }
        );
      }
    }

    // Check USN uniqueness if USN is being changed
    if (data.usn && data.usn !== student.usn) {
      const existing = await prisma.user.findUnique({
        where: { usn: data.usn },
      });
      if (existing) {
        return NextResponse.json(
          { error: "USN already in use" },
          { status: 409 }
        );
      }
    }

    // If departmentId is provided, verify it belongs to this college
    if (data.departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: data.departmentId, collegeId: user.collegeId },
      });
      if (!dept) {
        return NextResponse.json(
          { error: "Department not found" },
          { status: 404 }
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id: studentId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        usn: true,
        semester: true,
        isGraduated: true,
        department: {
          select: { id: true, name: true, code: true },
        },
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/students/[studentId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
