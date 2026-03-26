import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, collegeAdminProcedure } from "../trpc";
import { createDriveSchema, updateDriveSchema, driveFilterSchema, paginationSchema } from "../schemas";

export const driveRouter = router({
  list: protectedProcedure
    .input(driveFilterSchema.merge(paginationSchema).optional())
    .query(async ({ ctx }) => {
      const { user } = ctx;

      if (user.role !== "SUPER_ADMIN" && user.role !== "COLLEGE_ADMIN" && user.role !== "STUDENT") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};

      if (user.role === "COLLEGE_ADMIN") {
        where.collegeId = user.collegeId!;
      } else if (user.role === "STUDENT") {
        where.collegeId = user.collegeId!;
      }

      return ctx.prisma.placementDrive.findMany({
        where,
        include: {
          college: { select: { id: true, name: true, code: true } },
          _count: { select: { tests: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const drive = await ctx.prisma.placementDrive.findUnique({
        where: { id: input.id },
        include: {
          college: { select: { id: true, name: true, code: true } },
          _count: { select: { tests: true } },
        },
      });

      if (!drive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Drive not found" });
      }

      if (
        ctx.user.role === "COLLEGE_ADMIN" &&
        drive.collegeId !== ctx.user.collegeId
      ) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
      }

      return drive;
    }),

  create: collegeAdminProcedure
    .input(createDriveSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.collegeId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No college assigned to your account" });
      }

      return ctx.prisma.placementDrive.create({
        data: {
          ...input,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          collegeId: ctx.user.collegeId,
        },
        include: {
          college: { select: { id: true, name: true, code: true } },
        },
      });
    }),

  update: collegeAdminProcedure
    .input(z.object({ id: z.string() }).merge(updateDriveSchema))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const drive = await ctx.prisma.placementDrive.findUnique({ where: { id } });
      if (!drive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Drive not found" });
      }
      if (drive.collegeId !== ctx.user.collegeId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
      }

      const updateData: Record<string, unknown> = { ...data };
      if (data.startDate !== undefined) {
        updateData.startDate = data.startDate ? new Date(data.startDate) : null;
      }
      if (data.endDate !== undefined) {
        updateData.endDate = data.endDate ? new Date(data.endDate) : null;
      }

      return ctx.prisma.placementDrive.update({
        where: { id },
        data: updateData,
        include: {
          college: { select: { id: true, name: true, code: true } },
        },
      });
    }),

  delete: collegeAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const drive = await ctx.prisma.placementDrive.findUnique({ where: { id: input.id } });
      if (!drive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Drive not found" });
      }
      if (drive.collegeId !== ctx.user.collegeId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
      }

      await ctx.prisma.placementDrive.delete({ where: { id: input.id } });
      return { message: "Drive deleted successfully" };
    }),
});
