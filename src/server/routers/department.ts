import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, collegeAdminProcedure, protectedProcedure } from "../trpc";
import { createDepartmentSchema } from "../schemas";

export const departmentRouter = router({
  list: protectedProcedure
    .input(z.object({ collegeId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      let collegeId = input?.collegeId;

      if (ctx.user.role === "COLLEGE_ADMIN" || ctx.user.role === "STUDENT") {
        collegeId = ctx.user.collegeId!;
      }

      if (!collegeId && ctx.user.role !== "SUPER_ADMIN") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No college assigned" });
      }

      const where = collegeId ? { collegeId } : {};

      return ctx.prisma.department.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
    }),

  create: collegeAdminProcedure
    .input(createDepartmentSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.collegeId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No college assigned to your account" });
      }

      return ctx.prisma.department.create({
        data: {
          ...input,
          collegeId: ctx.user.collegeId,
        },
      });
    }),

  update: collegeAdminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      code: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const department = await ctx.prisma.department.findUnique({ where: { id } });
      if (!department) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Department not found" });
      }
      if (department.collegeId !== ctx.user.collegeId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
      }

      return ctx.prisma.department.update({ where: { id }, data });
    }),

  delete: collegeAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const department = await ctx.prisma.department.findUnique({ where: { id: input.id } });
      if (!department) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Department not found" });
      }
      if (department.collegeId !== ctx.user.collegeId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
      }

      await ctx.prisma.department.delete({ where: { id: input.id } });
      return { message: "Department deleted successfully" };
    }),
});
