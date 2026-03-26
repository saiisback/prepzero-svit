import { z } from "zod";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure, protectedProcedure, collegeAdminProcedure } from "../trpc";
import { createCollegeSchema, updateCollegeSchema, paginationSchema, searchSchema } from "../schemas";

export const collegeRouter = router({
  list: adminProcedure
    .input(paginationSchema.merge(searchSchema).optional())
    .query(async ({ ctx }) => {
      const colleges = await ctx.prisma.college.findMany({
        include: {
          _count: {
            select: {
              users: true,
              placementDrives: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return colleges;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "SUPER_ADMIN" && ctx.user.collegeId !== input.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
      }

      const college = await ctx.prisma.college.findUnique({
        where: { id: input.id },
        include: {
          _count: {
            select: {
              users: true,
              placementDrives: true,
            },
          },
        },
      });

      if (!college) {
        throw new TRPCError({ code: "NOT_FOUND", message: "College not found" });
      }

      return college;
    }),

  getStats: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const college = await ctx.prisma.college.findUnique({
        where: { id: input.id },
      });
      if (!college) {
        throw new TRPCError({ code: "NOT_FOUND", message: "College not found" });
      }

      const collegeId = input.id;

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
        ctx.prisma.user.count({ where: { collegeId, role: "STUDENT" } }),
        ctx.prisma.user.count({ where: { collegeId, role: "COLLEGE_ADMIN" } }),
        ctx.prisma.department.count({ where: { collegeId } }),
        ctx.prisma.placementDrive.findMany({
          where: { collegeId },
          select: { status: true },
        }),
        ctx.prisma.test.findMany({
          where: { drive: { collegeId } },
          select: { id: true, status: true, passingMarks: true },
        }),
        ctx.prisma.testAttempt.findMany({
          where: { test: { drive: { collegeId } } },
          select: { status: true, score: true, percentage: true, testId: true },
        }),
        ctx.prisma.question.count({ where: { test: { drive: { collegeId } } } }),
        ctx.prisma.user.findMany({
          where: { collegeId, role: "STUDENT" },
          select: { department: { select: { name: true, code: true } } },
        }),
      ]);

      const drivesByStatus: Record<string, number> = {
        DRAFT: 0, UPCOMING: 0, ACTIVE: 0, COMPLETED: 0, CANCELLED: 0,
      };
      for (const d of drives) {
        drivesByStatus[d.status] = (drivesByStatus[d.status] || 0) + 1;
      }

      const testsByStatus: Record<string, number> = {
        DRAFT: 0, PUBLISHED: 0, CLOSED: 0,
      };
      for (const t of tests) {
        testsByStatus[t.status] = (testsByStatus[t.status] || 0) + 1;
      }

      const passingMarksMap = new Map<string, number>();
      for (const t of tests) {
        passingMarksMap.set(t.id, t.passingMarks);
      }

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

      const deptCounts = new Map<string, number>();
      for (const s of studentsWithDept) {
        const deptName = s.department?.name ?? "Unassigned";
        deptCounts.set(deptName, (deptCounts.get(deptName) ?? 0) + 1);
      }
      const studentsByDepartment = Array.from(deptCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      return {
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
      };
    }),

  create: adminProcedure
    .input(createCollegeSchema)
    .mutation(async ({ ctx, input }) => {
      const code = input.code || nanoid(8).toUpperCase();
      const college = await ctx.prisma.college.create({
        data: { ...input, code },
      });
      return college;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(updateCollegeSchema))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      if (ctx.user.role !== "SUPER_ADMIN" && ctx.user.collegeId !== id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
      }

      const existing = await ctx.prisma.college.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "College not found" });
      }

      const college = await ctx.prisma.college.update({
        where: { id },
        data,
      });
      return college;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string(), deleteUsers: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.college.findUnique({ where: { id: input.id } });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "College not found" });
      }

      if (input.deleteUsers) {
        await ctx.prisma.user.deleteMany({ where: { collegeId: input.id } });
      }

      await ctx.prisma.college.delete({ where: { id: input.id } });
      return { message: "College deleted successfully" };
    }),

  getUsnStructure: collegeAdminProcedure.query(async ({ ctx }) => {
    const college = await ctx.prisma.college.findUnique({
      where: { id: ctx.user.collegeId! },
      select: { usnFormat: true, usnExample: true },
    });

    if (!college) {
      throw new TRPCError({ code: "NOT_FOUND", message: "College not found" });
    }

    if (!college.usnFormat) {
      return { configured: false as const };
    }

    return {
      configured: true as const,
      usnFormat: college.usnFormat,
      usnExample: college.usnExample,
    };
  }),
});
