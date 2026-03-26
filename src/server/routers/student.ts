import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { hashPassword } from "better-auth/crypto";
import { router, protectedProcedure, collegeAdminProcedure, studentProcedure } from "../trpc";
import { createStudentSchema, updateStudentSchema, studentFilterSchema, paginationSchema } from "../schemas";

export const studentRouter = router({
  list: collegeAdminProcedure
    .input(
      studentFilterSchema.merge(paginationSchema).merge(z.object({
        limit: z.number().int().min(1).max(100).default(30),
      })).optional()
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 30;
      const skip = (page - 1) * limit;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
        collegeId: user.collegeId,
        role: "STUDENT",
      };

      if (input?.departmentId) where.departmentId = input.departmentId;
      if (input?.semester) where.semester = input.semester;
      if (input?.graduated === "true") where.isGraduated = true;
      else if (input?.graduated === "false") where.isGraduated = false;

      if (input?.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { usn: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const [students, total] = await Promise.all([
        ctx.prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            name: true,
            email: true,
            usn: true,
            semester: true,
            isGraduated: true,
            department: { select: { id: true, name: true, code: true } },
            createdAt: true,
            testAttempts: {
              where: { status: { in: ["SUBMITTED", "TIMED_OUT"] } },
              select: { percentage: true },
            },
          },
        }),
        ctx.prisma.user.count({ where }),
      ]);

      const result = students.map((student) => {
        const attempts = student.testAttempts;
        const testsTaken = attempts.length;
        const averageScore =
          testsTaken > 0
            ? Math.round(
                (attempts.reduce((sum, a) => sum + (a.percentage ?? 0), 0) / testsTaken) * 10
              ) / 10
            : null;

        return {
          id: student.id,
          name: student.name,
          email: student.email,
          usn: student.usn,
          semester: student.semester,
          isGraduated: student.isGraduated,
          department: student.department,
          createdAt: student.createdAt,
          testsTaken,
          averageScore,
        };
      });

      const totalPages = Math.ceil(total / limit);
      return { students: result, total, page, limit, totalPages };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const student = await ctx.prisma.user.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          email: true,
          usn: true,
          semester: true,
          isGraduated: true,
          collegeId: true,
          department: { select: { id: true, name: true, code: true } },
          createdAt: true,
        },
      });

      if (!student) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Student not found" });
      }

      if (ctx.user.role === "COLLEGE_ADMIN" && student.collegeId !== ctx.user.collegeId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
      }

      return student;
    }),

  create: collegeAdminProcedure
    .input(createStudentSchema)
    .mutation(async ({ ctx, input }) => {
      const collegeId = ctx.user.collegeId!;

      const department = await ctx.prisma.department.findFirst({
        where: { id: input.departmentId, collegeId },
      });
      if (!department) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid department" });
      }

      const existingEmail = await ctx.prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });
      if (existingEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Email already registered" });
      }

      if (input.usn) {
        const existingUsn = await ctx.prisma.user.findUnique({
          where: { usn: input.usn.toUpperCase() },
        });
        if (existingUsn) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "USN already exists" });
        }
      }

      const hashedPw = await hashPassword(input.password);

      const newStudent = await ctx.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: input.name,
            email: input.email.toLowerCase(),
            emailVerified: true,
            role: "STUDENT",
            collegeId,
            usn: input.usn ? input.usn.toUpperCase() : null,
            departmentId: input.departmentId,
            semester: input.semester,
          },
        });

        await tx.account.create({
          data: {
            userId: created.id,
            accountId: created.id,
            providerId: "credential",
            password: hashedPw,
          },
        });

        return created;
      });

      return {
        success: true,
        student: {
          id: newStudent.id,
          name: newStudent.name,
          email: newStudent.email,
        },
      };
    }),

  update: collegeAdminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      usn: z.string().min(1).optional(),
      semester: z.number().int().min(1).max(8).nullable().optional(),
      departmentId: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const student = await ctx.prisma.user.findFirst({
        where: { id, collegeId: ctx.user.collegeId, role: "STUDENT" },
      });
      if (!student) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Student not found" });
      }

      if (data.email && data.email !== student.email) {
        const existing = await ctx.prisma.user.findUnique({ where: { email: data.email } });
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Email already in use" });
        }
      }

      if (data.usn && data.usn !== student.usn) {
        const existing = await ctx.prisma.user.findUnique({ where: { usn: data.usn } });
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "USN already in use" });
        }
      }

      if (data.departmentId) {
        const dept = await ctx.prisma.department.findFirst({
          where: { id: data.departmentId!, collegeId: ctx.user.collegeId! },
        });
        if (!dept) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Department not found" });
        }
      }

      return ctx.prisma.user.update({
        where: { id },
        data: {
          ...data,
          departmentId: data.departmentId === null ? undefined : data.departmentId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          usn: true,
          semester: true,
          isGraduated: true,
          department: { select: { id: true, name: true, code: true } },
          createdAt: true,
        },
      });
    }),

  bulkCreate: collegeAdminProcedure
    .input(z.object({
      students: z.array(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        usn: z.string().min(1),
        deptCode: z.string().min(1),
        semester: z.number().int().min(1).max(8),
      })),
      passwords: z.record(z.string(), z.string().min(8)),
    }))
    .mutation(async ({ ctx, input }) => {
      const collegeId = ctx.user.collegeId!;

      const departments = await ctx.prisma.department.findMany({ where: { collegeId } });
      const deptMap = new Map(
        departments.flatMap((d) => {
          const entries: [string, string][] = [[d.name.toLowerCase(), d.id]];
          if (d.code) entries.push([d.code.toLowerCase(), d.id]);
          return entries;
        })
      );

      const passwordHashCache = new Map<string, string>();
      const created: string[] = [];
      const skipped: string[] = [];
      const errors: Array<{ email: string; error: string }> = [];

      for (const s of input.students) {
        const deptId = deptMap.get(s.deptCode.toLowerCase());
        if (!deptId) {
          errors.push({ email: s.email, error: `Department not found: ${s.deptCode}` });
          continue;
        }

        const passwordKey = `${s.deptCode}:${s.semester}`;
        const rawPassword = input.passwords[passwordKey];
        if (!rawPassword) {
          errors.push({ email: s.email, error: `No password for key: ${passwordKey}` });
          continue;
        }

        let hashedPw = passwordHashCache.get(passwordKey);
        if (!hashedPw) {
          hashedPw = await hashPassword(rawPassword);
          passwordHashCache.set(passwordKey, hashedPw);
        }

        try {
          const existingEmail = await ctx.prisma.user.findUnique({
            where: { email: s.email.toLowerCase() },
          });
          if (existingEmail) {
            skipped.push(s.email);
            continue;
          }

          await ctx.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
              data: {
                name: s.name,
                email: s.email.toLowerCase(),
                emailVerified: true,
                role: "STUDENT",
                collegeId,
                usn: s.usn.toUpperCase(),
                departmentId: deptId,
                semester: s.semester,
              },
            });

            await tx.account.create({
              data: {
                userId: user.id,
                accountId: user.id,
                providerId: "credential",
                password: hashedPw,
              },
            });
          });

          created.push(s.email);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          errors.push({ email: s.email, error: message });
        }
      }

      return { created: created.length, skipped: skipped.length, errors };
    }),

  bulkDelete: collegeAdminProcedure
    .input(z.object({
      studentIds: z.array(z.string()).min(1).optional(),
      filters: studentFilterSchema.optional(),
    }).refine((data) => data.studentIds || data.filters, {
      message: "Either studentIds or filters must be provided",
    }))
    .mutation(async ({ ctx, input }) => {
      const collegeId = ctx.user.collegeId!;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = { collegeId, role: "STUDENT" };

      if (input.studentIds) {
        where.id = { in: input.studentIds };
      } else if (input.filters) {
        if (input.filters.departmentId) where.departmentId = input.filters.departmentId;
        if (input.filters.semester) where.semester = input.filters.semester;
        if (input.filters.graduated === "true") where.isGraduated = true;
        else if (input.filters.graduated === "false") where.isGraduated = false;
        if (input.filters.search) {
          where.OR = [
            { name: { contains: input.filters.search, mode: "insensitive" } },
            { usn: { contains: input.filters.search, mode: "insensitive" } },
          ];
        }
      }

      const result = await ctx.prisma.user.deleteMany({ where });
      return { deleted: result.count };
    }),

  bulkPromote: collegeAdminProcedure
    .input(z.object({
      studentIds: z.array(z.string()).min(1).optional(),
      filters: studentFilterSchema.optional(),
    }).refine((data) => data.studentIds || data.filters, {
      message: "Either studentIds or filters must be provided",
    }))
    .mutation(async ({ ctx, input }) => {
      const collegeId = ctx.user.collegeId!;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
        collegeId,
        role: "STUDENT",
        isGraduated: false,
        semester: { not: null },
      };

      if (input.studentIds) {
        where.id = { in: input.studentIds };
      } else if (input.filters) {
        if (input.filters.departmentId) where.departmentId = input.filters.departmentId;
        if (input.filters.semester) where.semester = input.filters.semester;
      }

      // Promote semesters 1-7 → +1, semester 8 → graduate
      const promoted = await ctx.prisma.user.updateMany({
        where: { ...where, semester: { lt: 8 } },
        data: { semester: { increment: 1 } },
      });

      const graduated = await ctx.prisma.user.updateMany({
        where: { ...where, semester: 8 },
        data: { isGraduated: true },
      });

      return { promoted: promoted.count, graduated: graduated.count };
    }),

  getProfile: studentProcedure.query(async ({ ctx }) => {
    const student = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        usn: true,
        semester: true,
        createdAt: true,
        college: { select: { name: true } },
        department: { select: { name: true, code: true } },
      },
    });

    if (!student) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
    }

    return student;
  }),

  updateProfile: studentProcedure
    .input(updateStudentSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: input,
        select: {
          id: true,
          name: true,
          email: true,
          usn: true,
          semester: true,
        },
      });
    }),

  resolve: collegeAdminProcedure
    .input(z.object({
      usn: z.string().optional(),
      email: z.string().email().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (input.usn) {
        return ctx.prisma.user.findUnique({
          where: { usn: input.usn.toUpperCase() },
          select: { id: true, name: true, email: true, usn: true },
        });
      }
      if (input.email) {
        return ctx.prisma.user.findUnique({
          where: { email: input.email.toLowerCase() },
          select: { id: true, name: true, email: true, usn: true },
        });
      }
      return null;
    }),

  validate: collegeAdminProcedure
    .input(z.object({
      usns: z.array(z.string()),
    }))
    .query(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findMany({
        where: {
          usn: { in: input.usns.map((u) => u.toUpperCase()) },
          collegeId: ctx.user.collegeId,
        },
        select: { usn: true, semester: true },
      });

      const conflicts: Record<string, number | null> = {};
      for (const s of existing) {
        if (s.usn) conflicts[s.usn] = s.semester;
      }
      return conflicts;
    }),
});
