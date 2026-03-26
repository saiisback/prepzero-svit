import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../trpc";

export const userRouter = router({
  list: adminProcedure
    .input(z.object({ role: z.enum(["SUPER_ADMIN", "COLLEGE_ADMIN", "STUDENT"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};
      if (input?.role) where.role = input.role;

      const users = await ctx.prisma.user.findMany({
        where,
        include: {
          college: { select: { id: true, name: true } },
          _count: { select: { testAttempts: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        collegeName: user.college?.name ?? null,
        testAttemptCount: user._count.testAttempts,
      }));
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete your own account" });
      }

      const targetUser = await ctx.prisma.user.findUnique({
        where: { id: input.id },
        select: { id: true, role: true },
      });

      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (targetUser.role === "SUPER_ADMIN") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete super admin users" });
      }

      await ctx.prisma.user.delete({ where: { id: input.id } });
      return { message: "User deleted successfully" };
    }),
});
