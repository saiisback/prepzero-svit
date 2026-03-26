import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

const validateSchema = z.object({
  usns: z.array(z.string().min(1)).min(1),
});

// POST /api/students/validate — check which USNs already exist in the college
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
    const parsed = validateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { usns } = parsed.data;
    const upperUsns = usns.map((u) => u.toUpperCase());

    const existing = await prisma.user.findMany({
      where: {
        collegeId: user.collegeId,
        usn: { in: upperUsns },
      },
      select: { usn: true, semester: true },
    });

    // Return a map of USN -> semester for existing students
    const conflicts: Record<string, number | null> = {};
    for (const u of existing) {
      if (u.usn) {
        conflicts[u.usn.toUpperCase()] = u.semester;
      }
    }

    return NextResponse.json({ conflicts });
  } catch (error) {
    console.error("POST /api/students/validate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
