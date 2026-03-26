import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { hashPassword } from "better-auth/crypto";

const addStudentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  usn: z.string().optional(),
  departmentId: z.string().min(1, "Department is required"),
  semester: z.number().int().min(1).max(8),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// POST /api/students — create a single student account (COLLEGE_ADMIN only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string; collegeId: string };
    if (user.role !== "COLLEGE_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = addStudentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, usn, departmentId, semester, password } = parsed.data;
    const collegeId = user.collegeId;

    // Verify department belongs to this college
    const department = await prisma.department.findFirst({
      where: { id: departmentId, collegeId },
    });
    if (!department) {
      return NextResponse.json({ error: "Invalid department" }, { status: 400 });
    }

    // Check for duplicate email
    const existingEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingEmail) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    // Check for duplicate USN (if provided)
    if (usn) {
      const existingUsn = await prisma.user.findUnique({ where: { usn: usn.toUpperCase() } });
      if (existingUsn) {
        return NextResponse.json({ error: "USN already exists" }, { status: 400 });
      }
    }

    const hashedPw = await hashPassword(password);

    const newStudent = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          emailVerified: true,
          role: "STUDENT",
          collegeId,
          usn: usn ? usn.toUpperCase() : null,
          departmentId,
          semester,
        },
      });

      await tx.account.create({
        data: {
          userId: created.id,
          accountId: created.id,
          providerId: "credential",
          password: hashedPw,
        },
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      student: {
        id: newStudent.id,
        name: newStudent.name,
        email: newStudent.email,
      },
    });
  } catch (error) {
    console.error("POST /api/students error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/students — list students with optional filters and test stats
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string; collegeId: string };
    if (user.role !== "COLLEGE_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const semesterParam = searchParams.get("semester");
    const semester = semesterParam ? parseInt(semesterParam, 10) : null;
    const graduatedParam = searchParams.get("graduated");
    const search = searchParams.get("search");

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10))) : 30;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      collegeId: user.collegeId,
      role: "STUDENT",
    };

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (semester && semester >= 1 && semester <= 8) {
      where.semester = semester;
    }

    if (graduatedParam === "true") {
      where.isGraduated = true;
    } else if (graduatedParam === "false") {
      where.isGraduated = false;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { usn: { contains: search, mode: "insensitive" } },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
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
          testAttempts: {
            where: {
              status: { in: ["SUBMITTED", "TIMED_OUT"] },
            },
            select: {
              percentage: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const result = students.map((student) => {
      const attempts = student.testAttempts;
      const testsTaken = attempts.length;
      const averageScore =
        testsTaken > 0
          ? Math.round(
              (attempts.reduce((sum, a) => sum + (a.percentage ?? 0), 0) /
                testsTaken) *
                10
            ) / 10
          : null;

      return {
        id: student.id,
        name: student.name,
        email: student.email,
        usn: student.usn,
        semester: student.semester,
        isGraduated: student.isGraduated,
        department: student.department,
        createdAt: student.createdAt,
        testsTaken,
        averageScore,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ students: result, total, page, limit, totalPages });
  } catch (error) {
    console.error("GET /api/students error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
