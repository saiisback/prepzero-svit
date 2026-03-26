import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, collegeAdminProcedure } from "../trpc";

export const notificationRouter = router({
  list: collegeAdminProcedure
    .input(z.object({ unreadOnly: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.user.collegeId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No college assigned" });
      }

      const [notifications, unreadCount] = await Promise.all([
        ctx.prisma.notification.findMany({
          where: {
            collegeId: ctx.user.collegeId,
            ...(input?.unreadOnly ? { isRead: false } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        ctx.prisma.notification.count({
          where: { collegeId: ctx.user.collegeId, isRead: false },
        }),
      ]);

      return { notifications, unreadCount };
    }),

  markAsRead: collegeAdminProcedure
    .input(z.object({
      ids: z.array(z.string()).optional(),
      markAllRead: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.collegeId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No college assigned" });
      }

      if (input.markAllRead) {
        await ctx.prisma.notification.updateMany({
          where: { collegeId: ctx.user.collegeId, isRead: false },
          data: { isRead: true },
        });
      } else if (input.ids && input.ids.length > 0) {
        await ctx.prisma.notification.updateMany({
          where: { id: { in: input.ids }, collegeId: ctx.user.collegeId },
          data: { isRead: true },
        });
      }

      return { success: true };
    }),

  delete: collegeAdminProcedure
    .input(z.object({
      ids: z.array(z.string()).optional(),
      deleteAll: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.collegeId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No college assigned" });
      }

      if (input.deleteAll) {
        await ctx.prisma.notification.deleteMany({
          where: { collegeId: ctx.user.collegeId },
        });
      } else if (input.ids && input.ids.length > 0) {
        await ctx.prisma.notification.deleteMany({
          where: { id: { in: input.ids }, collegeId: ctx.user.collegeId },
        });
      }

      return { success: true };
    }),
});
