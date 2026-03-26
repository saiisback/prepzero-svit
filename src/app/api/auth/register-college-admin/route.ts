import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  collegeCode: z.string().min(1),
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

    const { name, email, password, collegeCode } = parsed.data;

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
        role: "COLLEGE_ADMIN",
        collegeId: college.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "College admin registered successfully",
      user: { id: (result as { user?: { id: string } }).user?.id, name, email, role: "COLLEGE_ADMIN" },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
