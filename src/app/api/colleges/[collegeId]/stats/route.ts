import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

type RouteParams = { params: Promise<{ collegeId: string }> };

// GET /api/colleges/[collegeId]/stats — detailed college statistics (super admin only)
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { collegeId } = await params;

    const college = await prisma.college.findUnique({
      where: { id: collegeId },
    });
    if (!college) {
      return NextResponse.json({ error: "College not found" }, { status: 404 });
    }

    const [
      students,
      collegeAdmins,
      departments,
      drives,
      tests,
      attempts,
      totalQuestions,
      studentsWithDept,
    ] = await Promise.all([
      prisma.user.count({ where: { collegeId, role: "STUDENT" } }),
      prisma.user.count({ where: { collegeId, role: "COLLEGE_ADMIN" } }),
      prisma.department.count({ where: { collegeId } }),
      prisma.placementDrive.findMany({
        where: { collegeId },
        select: { status: true },
      }),
      prisma.test.findMany({
        where: { drive: { collegeId } },
        select: { id: true, status: true, passingMarks: true },
      }),
      prisma.testAttempt.findMany({
        where: { test: { drive: { collegeId } } },
        select: {
          status: true,
          score: true,
          percentage: true,
          testId: true,
        },
      }),
      prisma.question.count({ where: { test: { drive: { collegeId } } } }),
      prisma.user.findMany({
        where: { collegeId, role: "STUDENT" },
        select: { department: { select: { name: true, code: true } } },
      }),
    ]);

    // Drives by status
    const drivesByStatus: Record<string, number> = {
      DRAFT: 0,
      UPCOMING: 0,
      ACTIVE: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const d of drives) {
      drivesByStatus[d.status] = (drivesByStatus[d.status] || 0) + 1;
    }

    // Tests by status
    const testsByStatus: Record<string, number> = {
      DRAFT: 0,
      PUBLISHED: 0,
      CLOSED: 0,
    };
    for (const t of tests) {
      testsByStatus[t.status] = (testsByStatus[t.status] || 0) + 1;
    }

    // Build passing marks lookup
    const passingMarksMap = new Map<string, number>();
    for (const t of tests) {
      passingMarksMap.set(t.id, t.passingMarks);
    }

    // Performance metrics from attempts
    const submittedAttempts = attempts.filter((a) => a.status === "SUBMITTED");
    const completedAttempts = attempts.filter(
      (a) => a.status === "SUBMITTED" || a.status === "TIMED_OUT"
    );

    const averageScore =
      submittedAttempts.length > 0
        ? submittedAttempts.reduce((sum, a) => sum + (a.percentage ?? 0), 0) /
          submittedAttempts.length
        : 0;

    const completionRate =
      attempts.length > 0
        ? (completedAttempts.length / attempts.length) * 100
        : 0;

    const passedAttempts = submittedAttempts.filter((a) => {
      const passingMarks = passingMarksMap.get(a.testId) ?? 0;
      return (a.score ?? 0) >= passingMarks;
    });

    const passRate =
      submittedAttempts.length > 0
        ? (passedAttempts.length / submittedAttempts.length) * 100
        : 0;

    // Students by department
    const deptCounts = new Map<string, number>();
    for (const s of studentsWithDept) {
      const deptName = s.department?.name ?? "Unassigned";
      deptCounts.set(deptName, (deptCounts.get(deptName) ?? 0) + 1);
    }
    const studentsByDepartment = Array.from(deptCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      students,
      collegeAdmins,
      departments,
      totalDrives: drives.length,
      totalTests: tests.length,
      totalAttempts: attempts.length,
      totalQuestions,
      drivesByStatus,
      testsByStatus,
      studentsByDepartment,
      averageScore: Math.round(averageScore * 10) / 10,
      completionRate: Math.round(completionRate * 10) / 10,
      passRate: Math.round(passRate * 10) / 10,
    });
  } catch (error) {
    console.error("GET /api/colleges/[collegeId]/stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
