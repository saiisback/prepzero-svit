import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import { registerCollegeAdminSchema, registerStudentSchema, listDepartmentsSchema } from "../schemas";
import { auth } from "@/lib/auth";

export const authRouter = router({
  registerCollegeAdmin: publicProcedure
    .input(registerCollegeAdminSchema)
    .mutation(async ({ ctx, input }) => {
      const college = await ctx.prisma.college.findUnique({
        where: { code: input.collegeCode },
      });

      if (!college) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid college code" });
      }
      if (!college.isActive) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This college is not active" });
      }

      const existingUser = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });
      if (existingUser) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Email already registered" });
      }

      const result = await auth.api.signUpEmail({
        body: {
          name: input.name,
          email: input.email,
          password: input.password,
        },
      });

      await ctx.prisma.user.update({
        where: { email: input.email },
        data: {
          role: "COLLEGE_ADMIN",
          collegeId: college.id,
        },
      });

      return {
        success: true,
        message: "College admin registered successfully",
        user: {
          id: (result as { user?: { id: string } }).user?.id,
          name: input.name,
          email: input.email,
          role: "COLLEGE_ADMIN" as const,
        },
      };
    }),

  registerStudent: publicProcedure
    .input(registerStudentSchema)
    .mutation(async ({ ctx, input }) => {
      const college = await ctx.prisma.college.findUnique({
        where: { code: input.collegeCode },
      });

      if (!college) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid college code" });
      }
      if (!college.isActive) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This college is not active" });
      }

      const department = await ctx.prisma.department.findFirst({
        where: { id: input.departmentId, collegeId: college.id },
      });
      if (!department) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid department" });
      }

      const existingUser = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });
      if (existingUser) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Email already registered" });
      }

      const result = await auth.api.signUpEmail({
        body: {
          name: input.name,
          email: input.email,
          password: input.password,
        },
      });

      await ctx.prisma.user.update({
        where: { email: input.email },
        data: {
          role: "STUDENT",
          collegeId: college.id,
          departmentId: input.departmentId,
          semester: input.semester,
        },
      });

      return {
        success: true,
        message: "Student registered successfully",
        user: {
          id: (result as { user?: { id: string } }).user?.id,
          name: input.name,
          email: input.email,
          role: "STUDENT" as const,
        },
      };
    }),

  listDepartments: publicProcedure
    .input(listDepartmentsSchema)
    .query(async ({ ctx, input }) => {
      const college = await ctx.prisma.college.findUnique({
        where: { code: input.collegeCode },
        select: { id: true, isActive: true },
      });

      if (!college || !college.isActive) {
        return { departments: [] };
      }

      const departments = await ctx.prisma.department.findMany({
        where: { collegeId: college.id },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

      return { departments };
    }),
});
