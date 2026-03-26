import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { buildEligibleStudentsWhere } from "@/lib/test-eligibility";

type RouteParams = { params: Promise<{ testId: string }> };

// GET /api/tests/[testId]/monitor — live participation data
export async function GET(_request: NextRequest, { params }: RouteParams) {
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

    if (user.role !== "COLLEGE_ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { testId } = await params;

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        drive: {
          select: {
            id: true,
            title: true,
            collegeId: true,
          },
        },
      },
    });

    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    if (
      user.role === "COLLEGE_ADMIN" &&
      test.drive.collegeId !== user.collegeId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const collegeId = test.drive.collegeId;

    // Fetch eligible students and attempts in parallel
    const eligibleWhere = buildEligibleStudentsWhere(test, collegeId);
    const [students, attempts] = await Promise.all([
      prisma.user.findMany({
        where: eligibleWhere,
        select: {
          id: true,
          name: true,
          email: true,
          usn: true,
          department: { select: { name: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.testAttempt.findMany({
        where: { testId },
        select: {
          studentId: true,
          status: true,
          startedAt: true,
          submittedAt: true,
          totalViolations: true,
          lastHeartbeat: true,
        },
      }),
    ]);

    // Build attempt lookup map
    const attemptMap = new Map(attempts.map((a) => [a.studentId, a]));

    const now = Date.now();
    // Consider a student as "left" if no heartbeat for 30 seconds
    const HEARTBEAT_TIMEOUT_MS = 30_000;

    let notStarted = 0;
    let inProgress = 0;
    let submitted = 0;
    let timedOut = 0;
    let left = 0;

    const studentList = students.map((s) => {
      const attempt = attemptMap.get(s.id);
      let status: string;

      if (!attempt) {
        status = "NOT_STARTED";
        notStarted++;
      } else if (attempt.status === "SUBMITTED") {
        status = "SUBMITTED";
        submitted++;
      } else if (attempt.status === "TIMED_OUT") {
        status = "TIMED_OUT";
        timedOut++;
      } else if (
        attempt.status === "IN_PROGRESS" &&
        attempt.lastHeartbeat &&
        now - new Date(attempt.lastHeartbeat).getTime() > HEARTBEAT_TIMEOUT_MS
      ) {
        status = "LEFT";
        left++;
      } else {
        status = "IN_PROGRESS";
        inProgress++;
      }

      return {
        id: s.id,
        name: s.name,
        email: s.email,
        usn: s.usn,
        department: s.department?.name ?? null,
        status,
        startedAt: attempt?.startedAt ?? null,
        submittedAt: attempt?.submittedAt ?? null,
        totalViolations: attempt?.totalViolations ?? 0,
      };
    });

    return NextResponse.json({
      test: {
        id: test.id,
        title: test.title,
        status: test.status,
        durationMinutes: test.durationMinutes,
        startTime: test.startTime,
        endTime: test.endTime,
        drive: { id: test.drive.id, title: test.drive.title },
      },
      summary: {
        totalStudents: students.length,
        notStarted,
        inProgress,
        submitted,
        timedOut,
        left,
      },
      students: studentList,
    });
  } catch (error) {
    console.error("GET /api/tests/[testId]/monitor error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
