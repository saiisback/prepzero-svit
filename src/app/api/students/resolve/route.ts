import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { hashPassword } from "better-auth/crypto";

const resolveSchema = z.object({
  students: z
    .array(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        usn: z.string().min(1),
        department: z.string().min(1),
      })
    )
    .min(1),
  defaultPassword: z.string().min(8).optional(),
});

// POST /api/students/resolve — find existing students or create new ones, return all
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as {
      id: string;
      role: string;
      collegeId: string;
    };
    if (user.role !== "COLLEGE_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = resolveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { students: csvStudents, defaultPassword } = parsed.data;
    // Pre-hash a shared default password if provided; otherwise each student
    // gets their own USN as password (hashed per-student in the loop below).
    const sharedHashedPw = defaultPassword
      ? await hashPassword(defaultPassword)
      : null;
    const collegeId = user.collegeId;

    // Fetch college departments for mapping
    const departments = await prisma.department.findMany({
      where: { collegeId },
      select: { id: true, code: true, name: true },
    });

    // Build lookup maps (case-insensitive by code and name)
    const deptByCode = new Map<string, { id: string; name: string }>();
    const deptByName = new Map<string, { id: string; name: string }>();
    for (const dept of departments) {
      if (dept.code) {
        deptByCode.set(dept.code.toUpperCase(), { id: dept.id, name: dept.name });
      }
      deptByName.set(dept.name.toUpperCase(), { id: dept.id, name: dept.name });
    }

    // Resolve department from a CSV value like "aiml (ai)", "CS", or "Computer Science"
    function resolveDept(raw: string): { id: string; name: string } | null {
      const key = raw.toUpperCase();
      // Try exact match on code or name first
      if (deptByCode.has(key)) return deptByCode.get(key)!;
      if (deptByName.has(key)) return deptByName.get(key)!;
      // Handle "name (code)" format — extract code from parentheses
      const parenMatch = raw.match(/\(([^)]+)\)/);
      if (parenMatch) {
        const code = parenMatch[1].trim().toUpperCase();
        if (deptByCode.has(code)) return deptByCode.get(code)!;
        // Try the part before parentheses as name
        const namePart = raw.replace(/\s*\([^)]*\)\s*$/, "").trim().toUpperCase();
        if (deptByName.has(namePart)) return deptByName.get(namePart)!;
        if (deptByCode.has(namePart)) return deptByCode.get(namePart)!;
      }
      return null;
    }

    // Check which emails/USNs already exist
    const inputEmails = csvStudents.map((s) => s.email.toLowerCase());
    const inputUsns = csvStudents.map((s) => s.usn.toUpperCase());

    const existingUsers = await prisma.user.findMany({
      where: {
        collegeId,
        role: "STUDENT",
        OR: [
          { email: { in: inputEmails } },
          { usn: { in: inputUsns } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        usn: true,
        department: { select: { name: true } },
      },
    });

    const existingByEmail = new Map(
      existingUsers.map((u) => [u.email.toLowerCase(), u])
    );
    const existingByUsn = new Map(
      existingUsers.filter((u) => u.usn).map((u) => [u.usn!.toUpperCase(), u])
    );

    const found: typeof existingUsers = [];
    let created = 0;
    const errors: string[] = [];

    for (const student of csvStudents) {
      const email = student.email.toLowerCase();
      const usn = student.usn.toUpperCase();

      // Check if student already exists
      const existing = existingByEmail.get(email) || existingByUsn.get(usn);
      if (existing) {
        found.push(existing);
        continue;
      }

      // Resolve department by code, name, or "name (code)" format
      const dept = resolveDept(student.department);
      if (!dept) {
        errors.push(`Department "${student.department}" not found for ${usn}`);
        continue;
      }

      try {
        const hashedPw = sharedHashedPw ?? await hashPassword(usn);
        const newUser = await prisma.$transaction(async (tx) => {
          const u = await tx.user.create({
            data: {
              name: student.name,
              email,
              emailVerified: true,
              role: "STUDENT",
              collegeId,
              usn,
              departmentId: dept.id,
            },
          });

          await tx.account.create({
            data: {
              userId: u.id,
              accountId: u.id,
              providerId: "credential",
              password: hashedPw,
            },
          });

          return u;
        });

        found.push({
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          usn: newUser.usn,
          department: { name: dept.name },
        });
        created++;

        // Track so subsequent duplicates in same CSV are caught
        existingByEmail.set(email, found[found.length - 1]);
        existingByUsn.set(usn, found[found.length - 1]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Failed to create "${email}": ${msg}`);
      }
    }

    return NextResponse.json({
      found,
      created,
      existing: found.length - created,
      errors,
    });
  } catch (error) {
    console.error("POST /api/students/resolve error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
