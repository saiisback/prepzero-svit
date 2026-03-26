import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

// GET /api/attempts — list attempts
// Student: own attempts; College admin: all attempts for college's tests
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let where: any = {};

    if (user.role === "STUDENT") {
      where = { studentId: user.id };
    } else if (user.role === "COLLEGE_ADMIN") {
      where = {
        test: {
          drive: { collegeId: user.collegeId },
        },
      };
    } else if (user.role === "SUPER_ADMIN") {
      // No filter — all attempts
      where = {};
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const attempts = await prisma.testAttempt.findMany({
      where,
      include: {
        test: {
          select: {
            id: true,
            title: true,
            totalMarks: true,
            durationMinutes: true,
            drive: {
              select: {
                id: true,
                title: true,
                companyName: true,
              },
            },
          },
        },
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(attempts);
  } catch (error) {
    console.error("GET /api/attempts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
