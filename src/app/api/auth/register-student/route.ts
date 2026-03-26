import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  collegeCode: z.string().min(1),
  departmentId: z.string().min(1, "Department is required"),
  semester: z.number().int().min(1).max(8),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password, collegeCode, departmentId, semester } = parsed.data;

    const college = await prisma.college.findUnique({
      where: { code: collegeCode },
    });

    if (!college) {
      return NextResponse.json(
        { error: "Invalid college code" },
        { status: 400 }
      );
    }

    if (!college.isActive) {
      return NextResponse.json(
        { error: "This college is not active" },
        { status: 400 }
      );
    }

    // Verify department belongs to this college
    const department = await prisma.department.findFirst({
      where: { id: departmentId, collegeId: college.id },
    });

    if (!department) {
      return NextResponse.json(
        { error: "Invalid department" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    const result = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
      },
    });

    await prisma.user.update({
      where: { email },
      data: {
        role: "STUDENT",
        collegeId: college.id,
        departmentId,
        semester,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Student registered successfully",
      user: { id: (result as { user?: { id: string } }).user?.id, name, email, role: "STUDENT" },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
