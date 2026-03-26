import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";

export const statsRouter = router({
  getDashboard: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx;

    if (user.role === "SUPER_ADMIN") {
      const [totalColleges, totalUsers, totalDrives, totalTests] = await Promise.all([
        ctx.prisma.college.count(),
        ctx.prisma.user.count(),
        ctx.prisma.placementDrive.count(),
        ctx.prisma.test.count(),
      ]);

      return {
        role: "SUPER_ADMIN" as const,
        totalColleges,
        totalUsers,
        totalDrives,
        totalTests,
      };
    }

    if (user.role === "COLLEGE_ADMIN") {
      if (!user.collegeId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No college assigned" });
      }

      const [totalDrives, totalTests, totalStudents, activeTests] = await Promise.all([
        ctx.prisma.placementDrive.count({ where: { collegeId: user.collegeId } }),
        ctx.prisma.test.count({ where: { drive: { collegeId: user.collegeId } } }),
        ctx.prisma.user.count({ where: { collegeId: user.collegeId, role: "STUDENT" } }),
        ctx.prisma.test.count({
          where: { drive: { collegeId: user.collegeId }, status: "PUBLISHED" },
        }),
      ]);

      return {
        role: "COLLEGE_ADMIN" as const,
        totalDrives,
        totalTests,
        totalStudents,
        activeTests,
      };
    }

    if (user.role === "STUDENT") {
      if (!user.collegeId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No college assigned" });
      }

      const [availableTests, completedAttempts, allAttempts] = await Promise.all([
        ctx.prisma.test.count({
          where: { status: "PUBLISHED", drive: { collegeId: user.collegeId } },
        }),
        ctx.prisma.testAttempt.count({
          where: { studentId: user.id, status: "SUBMITTED" },
        }),
        ctx.prisma.testAttempt.findMany({
          where: { studentId: user.id, status: "SUBMITTED" },
          select: { percentage: true },
        }),
      ]);

      const averageScore =
        allAttempts.length > 0
          ? Math.round(
              (allAttempts.reduce((sum, a) => sum + (a.percentage ?? 0), 0) / allAttempts.length) *
                100
            ) / 100
          : 0;

      return {
        role: "STUDENT" as const,
        availableTests,
        completedTests: completedAttempts,
        averageScore,
      };
    }

    throw new TRPCError({ code: "FORBIDDEN", message: "Unknown role" });
  }),
});
