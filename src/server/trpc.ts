import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import type { Context } from "./context";
import type { Role } from "@/generated/prisma/client";

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

// --- Middleware ---

const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.user as unknown as {
        id: string;
        name: string;
        email: string;
        role: Role;
        collegeId: string | null;
        departmentId: string | null;
        semester: number | null;
        usn: string | null;
      },
    },
  });
});

const requireRole = (roles: Role[]) =>
  isAuthenticated.unstable_pipe(({ ctx, next }) => {
    if (!roles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
    }
    return next({ ctx });
  });

// --- Base Procedures ---

export const protectedProcedure = t.procedure.use(isAuthenticated);
export const adminProcedure = t.procedure.use(requireRole(["SUPER_ADMIN"]));
export const collegeAdminProcedure = t.procedure.use(requireRole(["COLLEGE_ADMIN"]));
export const studentProcedure = t.procedure.use(requireRole(["STUDENT"]));

// For procedures accessible by multiple roles
export const roleProtectedProcedure = (roles: Role[]) =>
  t.procedure.use(requireRole(roles));
