import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { hashPassword } from "better-auth/crypto";

const filtersSchema = z.object({
  departmentId: z.string().optional(),
  semester: z.number().int().min(1).max(8).optional(),
  graduated: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
});

const bulkDeleteSchema = z.object({
  studentIds: z.array(z.string()).min(1).optional(),
  filters: filtersSchema.optional(),
}).refine((d) => d.studentIds || d.filters, {
  message: "Either studentIds or filters must be provided",
});

// Build a Prisma where clause from filter params, scoped to the admin's college
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFilterWhere(collegeId: string, filters: z.infer<typeof filtersSchema>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    collegeId,
    role: "STUDENT",
  };
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.semester) where.semester = filters.semester;
  if (filters.graduated === "true") where.isGraduated = true;
  else if (filters.graduated === "false") where.isGraduated = false;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { usn: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  return where;
}

// DELETE /api/students/bulk — bulk delete student accounts (COLLEGE_ADMIN only)
// Accepts either { studentIds: [...] } or { filters: { departmentId?, semester?, graduated?, search? } }
export async function DELETE(request: NextRequest) {
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
    const parsed = bulkDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    let result;
    if (parsed.data.studentIds) {
      result = await prisma.user.deleteMany({
        where: {
          id: { in: parsed.data.studentIds },
          collegeId: user.collegeId,
          role: "STUDENT",
        },
      });
    } else {
      const where = buildFilterWhere(user.collegeId, parsed.data.filters!);
      result = await prisma.user.deleteMany({ where });
    }

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("DELETE /api/students/bulk error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const bulkPromoteSchema = z.object({
  studentIds: z.array(z.string()).min(1).optional(),
  filters: filtersSchema.optional(),
}).refine((d) => d.studentIds || d.filters, {
  message: "Either studentIds or filters must be provided",
});

// PATCH /api/students/bulk — bulk promote (increment semester) for students (COLLEGE_ADMIN only)
// Accepts either { studentIds: [...] } or { filters: { departmentId?, semester?, graduated?, search? } }
export async function PATCH(request: NextRequest) {
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
    const parsed = bulkPromoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Build where clause: either by IDs or by filters, then add promote-eligibility constraints
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let baseWhere: Record<string, any>;
    if (parsed.data.studentIds) {
      baseWhere = {
        id: { in: parsed.data.studentIds },
        collegeId: user.collegeId,
        role: "STUDENT",
      };
    } else {
      baseWhere = buildFilterWhere(user.collegeId, parsed.data.filters!);
    }

    // Fetch eligible students: not graduated, semester set
    const students = await prisma.user.findMany({
      where: {
        ...baseWhere,
        isGraduated: false,
        semester: { not: null },
      },
      select: { id: true, semester: true },
    });

    if (students.length === 0) {
      return NextResponse.json(
        { error: "No eligible students found to promote" },
        { status: 400 }
      );
    }

    const toGraduate = students.filter((s) => s.semester === 8);
    const toIncrement = students.filter((s) => s.semester !== null && s.semester! < 8);

    let promoted = 0;
    let graduated = 0;

    // Increment semester for students at sem 1-7, grouped by current semester
    if (toIncrement.length > 0) {
      const bySemester = new Map<number, string[]>();
      for (const s of toIncrement) {
        const sem = s.semester!;
        if (!bySemester.has(sem)) bySemester.set(sem, []);
        bySemester.get(sem)!.push(s.id);
      }

      for (const [currentSem, ids] of bySemester) {
        const result = await prisma.user.updateMany({
          where: { id: { in: ids } },
          data: { semester: currentSem + 1 },
        });
        promoted += result.count;
      }
    }

    // Graduate semester 8 students
    if (toGraduate.length > 0) {
      const result = await prisma.user.updateMany({
        where: { id: { in: toGraduate.map((s) => s.id) } },
        data: { isGraduated: true },
      });
      graduated = result.count;
    }

    return NextResponse.json({ promoted, graduated });
  } catch (error) {
    console.error("PATCH /api/students/bulk error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const bulkStudentSchema = z.object({
  students: z.array(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      usn: z.string().min(1),
      deptCode: z.string().min(1),
      semester: z.number().int().min(1).max(8),
    })
  ),
  passwords: z.record(z.string(), z.string().min(8)),
});

// POST /api/students/bulk — bulk create student accounts (COLLEGE_ADMIN only)
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
    const parsed = bulkStudentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { students, passwords } = parsed.data;
    const collegeId = user.collegeId;

    // Fetch college's departments
    const departments = await prisma.department.findMany({
      where: { collegeId },
      select: { id: true, code: true, name: true },
    });

    // Build dept code -> department id map (case-insensitive)
    const deptMap = new Map<string, string>();
    for (const dept of departments) {
      if (dept.code) {
        deptMap.set(dept.code.toUpperCase(), dept.id);
      }
    }

    // Check which emails/USNs already exist
    const emails = students.map((s) => s.email.toLowerCase());
    const usns = students.map((s) => s.usn.toUpperCase());

    const existingUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { in: emails } },
          { usn: { in: usns } },
        ],
      },
      select: { email: true, usn: true },
    });

    const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));
    const existingUsns = new Set(
      existingUsers.filter((u) => u.usn).map((u) => u.usn!.toUpperCase())
    );

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Hash unique passwords from the passwords record
    const hashedPasswords = new Map<string, string>();
    for (const [key, pw] of Object.entries(passwords)) {
      hashedPasswords.set(key, await hashPassword(pw));
    }

    for (const student of students) {
      const email = student.email.toLowerCase();
      const usn = student.usn.toUpperCase();
      const deptCode = student.deptCode.toUpperCase();

      if (existingEmails.has(email)) {
        skipped++;
        continue;
      }

      if (existingUsns.has(usn)) {
        errors.push(`USN "${usn}" already exists`);
        continue;
      }

      const departmentId = deptMap.get(deptCode);
      if (!departmentId) {
        errors.push(
          `No department with code "${student.deptCode}" found for USN "${usn}"`
        );
        continue;
      }

      const passwordKey = `${deptCode}:${student.semester}`;
      const hashedPw = hashedPasswords.get(passwordKey);
      if (!hashedPw) {
        errors.push(
          `No password provided for group "${student.deptCode}:${student.semester}"`
        );
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              name: student.name,
              email,
              emailVerified: true,
              role: "STUDENT",
              collegeId,
              usn,
              departmentId,
              semester: student.semester,
            },
          });

          await tx.account.create({
            data: {
              userId: newUser.id,
              accountId: newUser.id,
              providerId: "credential",
              password: hashedPw,
            },
          });
        });

        created++;
        existingEmails.add(email);
        existingUsns.add(usn);
      } catch (err) {
        errors.push(`Failed to create student "${email}": ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return NextResponse.json({ created, skipped, errors });
  } catch (error) {
    console.error("POST /api/students/bulk error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
