import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

// GET /api/stats — dashboard statistics based on role
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

    if (user.role === "SUPER_ADMIN") {
      const [totalColleges, totalUsers, totalDrives, totalTests] =
        await Promise.all([
          prisma.college.count(),
          prisma.user.count(),
          prisma.placementDrive.count(),
          prisma.test.count(),
        ]);

      return NextResponse.json({
        role: "SUPER_ADMIN",
        totalColleges,
        totalUsers,
        totalDrives,
        totalTests,
      });
    }

    if (user.role === "COLLEGE_ADMIN") {
      if (!user.collegeId) {
        return NextResponse.json(
          { error: "No college assigned" },
          { status: 400 }
        );
      }

      const [totalDrives, totalTests, totalStudents, activeTests] =
        await Promise.all([
          prisma.placementDrive.count({
            where: { collegeId: user.collegeId },
          }),
          prisma.test.count({
            where: { drive: { collegeId: user.collegeId } },
          }),
          prisma.user.count({
            where: { collegeId: user.collegeId, role: "STUDENT" },
          }),
          prisma.test.count({
            where: {
              drive: { collegeId: user.collegeId },
              status: "PUBLISHED",
            },
          }),
        ]);

      return NextResponse.json({
        role: "COLLEGE_ADMIN",
        totalDrives,
        totalTests,
        totalStudents,
        activeTests,
      });
    }

    if (user.role === "STUDENT") {
      if (!user.collegeId) {
        return NextResponse.json(
          { error: "No college assigned" },
          { status: 400 }
        );
      }

      const [availableTests, completedAttempts, allAttempts] =
        await Promise.all([
          prisma.test.count({
            where: {
              status: "PUBLISHED",
              drive: { collegeId: user.collegeId },
            },
          }),
          prisma.testAttempt.count({
            where: {
              studentId: user.id,
              status: "SUBMITTED",
            },
          }),
          prisma.testAttempt.findMany({
            where: {
              studentId: user.id,
              status: "SUBMITTED",
            },
            select: { percentage: true },
          }),
        ]);

      const averageScore =
        allAttempts.length > 0
          ? Math.round(
              (allAttempts.reduce(
                (sum, a) => sum + (a.percentage ?? 0),
                0
              ) /
                allAttempts.length) *
                100
            ) / 100
          : 0;

      return NextResponse.json({
        role: "STUDENT",
        availableTests,
        completedTests: completedAttempts,
        averageScore,
      });
    }

    return NextResponse.json({ error: "Unknown role" }, { status: 403 });
  } catch (error) {
    console.error("GET /api/stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
