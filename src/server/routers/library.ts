import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma, QuestionType, Difficulty } from "@/generated/prisma/client";
import { router, protectedProcedure, collegeAdminProcedure } from "../trpc";
import {
  libraryQuestionSchema,
  bulkLibraryQuestionSchema,
  importToTestSchema,
  createCategorySchema,
  updateCategorySchema,
  libraryFilterSchema,
  paginationSchema,
} from "../schemas";

function canWrite(
  userRole: string,
  userCollegeId: string | null,
  questionCollegeId: string | null
): boolean {
  if (userRole === "SUPER_ADMIN") return true;
  if (userRole === "COLLEGE_ADMIN") {
    return questionCollegeId !== null && questionCollegeId === userCollegeId;
  }
  return false;
}

export const libraryRouter = router({
  listQuestions: protectedProcedure
    .input(libraryFilterSchema.merge(paginationSchema).merge(z.object({
      limit: z.number().int().min(1).max(100).default(20),
    })).optional())
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      if (user.role !== "SUPER_ADMIN" && user.role !== "COLLEGE_ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }

      const page = input?.page ?? 1;
      const limit = input?.limit ?? 20;
      const andConditions: Record<string, unknown>[] = [];

      const effectiveScope = input?.scope || "global";
      if (effectiveScope === "global") {
        andConditions.push({ collegeId: { equals: null } });
      } else if (effectiveScope === "college") {
        if (user.role === "COLLEGE_ADMIN") {
          andConditions.push({ collegeId: { equals: user.collegeId } });
        } else {
          andConditions.push({ NOT: { collegeId: { equals: null } } });
        }
      }

      if (input?.category) andConditions.push({ categories: { has: input.category } });
      if (input?.difficulty) andConditions.push({ difficulty: input.difficulty });
      if (input?.questionType) andConditions.push({ questionType: input.questionType });
      if (input?.search) {
        andConditions.push({ questionText: { contains: input.search, mode: "insensitive" } });
      }

      const where = andConditions.length > 0 ? { AND: andConditions } : {};

      const [questions, total] = await Promise.all([
        ctx.prisma.libraryQuestion.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            createdBy: { select: { name: true } },
            college: { select: { name: true } },
            testCases: true,
          },
        }),
        ctx.prisma.libraryQuestion.count({ where }),
      ]);

      return {
        questions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  getQuestion: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      if (user.role !== "SUPER_ADMIN" && user.role !== "COLLEGE_ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }

      const question = await ctx.prisma.libraryQuestion.findUnique({
        where: { id: input.id },
        include: {
          testCases: { orderBy: { order: "asc" } },
          createdBy: { select: { name: true } },
          college: { select: { name: true } },
        },
      });

      if (!question) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });
      }

      // Read access: SUPER_ADMIN=all, COLLEGE_ADMIN=global+own
      if (user.role === "COLLEGE_ADMIN") {
        if (question.collegeId !== null && question.collegeId !== user.collegeId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
        }
      }

      return question;
    }),

  createQuestion: protectedProcedure
    .input(libraryQuestionSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      if (user.role !== "SUPER_ADMIN" && user.role !== "COLLEGE_ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }

      const isCoding = input.questionType === "CODING";

      let collegeId: string | null = null;
      if (input.scope === "private") {
        if (user.role !== "COLLEGE_ADMIN" || !user.collegeId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only college admins can create private questions" });
        }
        collegeId = user.collegeId;
      }

      if (!isCoding && "options" in input && "correctOptionIds" in input) {
        const optionIds = input.options.map((o) => o.id);
        const invalidIds = input.correctOptionIds.filter((id) => !optionIds.includes(id));
        if (invalidIds.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid correct option IDs: ${invalidIds.join(", ")}`,
          });
        }
      }

      return ctx.prisma.$transaction(async (tx) => {
        const created = await tx.libraryQuestion.create({
          data: {
            questionText: input.questionText,
            questionType: input.questionType as QuestionType,
            options: isCoding ? [] : ("options" in input ? input.options : []),
            correctOptionIds: isCoding ? [] : ("correctOptionIds" in input ? input.correctOptionIds : []),
            marks: input.marks,
            negativeMarks: input.negativeMarks,
            explanation: input.explanation,
            categories: input.categories,
            difficulty: input.difficulty as Difficulty,
            collegeId,
            createdById: user.id,
            codeBlock: input.codeBlock ?? null,
            codeLanguage: input.codeLanguage ?? null,
            imageUrls: input.imageUrls ?? undefined,
          },
          include: { testCases: true },
        });

        if (isCoding && "testCases" in input) {
          await tx.libraryTestCase.createMany({
            data: input.testCases.map((tc, idx) => ({
              libraryQuestionId: created.id,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isSample: tc.isSample ?? false,
              order: tc.order ?? idx,
            })),
          });

          return tx.libraryQuestion.findUnique({
            where: { id: created.id },
            include: { testCases: true },
          });
        }

        return created;
      });
    }),

  updateQuestion: protectedProcedure
    .input(z.object({
      id: z.string(),
      questionText: z.string().min(1).optional(),
      questionType: z.enum(["SINGLE_SELECT", "MULTI_SELECT", "CODING"]).optional(),
      options: z.array(z.object({ id: z.string(), text: z.string() })).min(2).optional(),
      correctOptionIds: z.array(z.string()).min(1).optional(),
      testCases: z.array(z.object({
        input: z.string(),
        expectedOutput: z.string().min(1),
        isSample: z.boolean().default(false),
        order: z.number().int().default(0),
      })).optional(),
      marks: z.number().int().positive().optional(),
      negativeMarks: z.number().min(0).optional(),
      explanation: z.string().optional().nullable(),
      categories: z.array(z.string().min(1)).min(1).optional(),
      difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
      codeBlock: z.string().optional().nullable(),
      codeLanguage: z.string().optional().nullable(),
      imageUrls: z.array(z.string()).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, testCases, imageUrls, ...data } = input;

      const existing = await ctx.prisma.libraryQuestion.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });
      }

      if (!canWrite(ctx.user.role, ctx.user.collegeId, existing.collegeId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }

      const questionType = data.questionType ?? existing.questionType;
      const isCoding = questionType === "CODING";

      return ctx.prisma.$transaction(async (tx) => {
        await tx.libraryQuestion.update({
          where: { id },
          data: {
            ...data,
            ...(imageUrls !== undefined && { imageUrls: imageUrls ?? Prisma.JsonNull }),
          },
        });

        if (isCoding && testCases !== undefined) {
          await tx.libraryTestCase.deleteMany({ where: { libraryQuestionId: id } });
          if (testCases.length > 0) {
            await tx.libraryTestCase.createMany({
              data: testCases.map((tc, idx) => ({
                libraryQuestionId: id,
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isSample: tc.isSample,
                order: tc.order ?? idx,
              })),
            });
          }
        }

        return tx.libraryQuestion.findUnique({
          where: { id },
          include: { testCases: { orderBy: { order: "asc" } } },
        });
      });
    }),

  deleteQuestion: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.libraryQuestion.findUnique({ where: { id: input.id } });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });
      }

      if (!canWrite(ctx.user.role, ctx.user.collegeId, existing.collegeId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }

      await ctx.prisma.libraryQuestion.delete({ where: { id: input.id } });
      return { success: true };
    }),

  bulkCreateQuestions: protectedProcedure
    .input(bulkLibraryQuestionSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      if (user.role !== "SUPER_ADMIN" && user.role !== "COLLEGE_ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }

      let collegeId: string | null = null;
      if (input.scope === "private") {
        if (user.role !== "COLLEGE_ADMIN" || !user.collegeId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only college admins can create private questions" });
        }
        collegeId = user.collegeId;
      }

      return ctx.prisma.$transaction(async (tx) => {
        await tx.libraryQuestion.createMany({
          data: input.questions.map((q) => ({
            questionText: q.questionText,
            questionType: q.questionType as QuestionType,
            options: q.options,
            correctOptionIds: q.correctOptionIds,
            marks: q.marks,
            negativeMarks: q.negativeMarks,
            explanation: q.explanation,
            categories: q.categories,
            difficulty: q.difficulty as Difficulty,
            collegeId,
            createdById: user.id,
            codeBlock: q.codeBlock ?? null,
            codeLanguage: q.codeLanguage ?? null,
            imageUrls: q.imageUrls ?? undefined,
          })),
        });

        return { created: input.questions.length };
      });
    }),

  bulkDeleteQuestions: protectedProcedure
    .input(z.object({
      questionIds: z.array(z.string()).min(1).optional(),
      filters: z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        difficulty: z.string().optional(),
        type: z.string().optional(),
        scope: z.enum(["global", "private"]).optional(),
      }).optional(),
    }).refine((d) => d.questionIds || d.filters, {
      message: "Either questionIds or filters must be provided",
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      if (user.role !== "SUPER_ADMIN" && user.role !== "COLLEGE_ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }

      let where: Record<string, unknown>;

      if (input.questionIds) {
        where = { id: { in: input.questionIds } };
        if (user.role === "COLLEGE_ADMIN") {
          where.collegeId = user.collegeId;
        }
      } else {
        const andConditions: Record<string, unknown>[] = [];
        const filters = input.filters!;

        const effectiveScope = filters.scope || "global";
        if (effectiveScope === "global") {
          andConditions.push({ collegeId: { equals: null } });
        } else {
          if (user.role === "COLLEGE_ADMIN") {
            andConditions.push({ collegeId: { equals: user.collegeId } });
          } else {
            andConditions.push({ NOT: { collegeId: { equals: null } } });
          }
        }

        if (filters.category) andConditions.push({ categories: { has: filters.category } });
        if (filters.difficulty) andConditions.push({ difficulty: filters.difficulty });
        if (filters.type) andConditions.push({ questionType: filters.type });
        if (filters.search) {
          andConditions.push({ questionText: { contains: filters.search, mode: "insensitive" } });
        }

        where = andConditions.length > 0 ? { AND: andConditions } : {};
        if (user.role === "COLLEGE_ADMIN") {
          where.collegeId = user.collegeId;
        }
      }

      const result = await ctx.prisma.libraryQuestion.deleteMany({ where });
      return { deleted: result.count };
    }),

  importToTest: collegeAdminProcedure
    .input(importToTestSchema)
    .mutation(async ({ ctx, input }) => {
      const test = await ctx.prisma.test.findUnique({
        where: { id: input.testId },
        include: { drive: { select: { collegeId: true } } },
      });

      if (!test) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Test not found" });
      }
      if (test.drive.collegeId !== ctx.user.collegeId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }

      const libraryQuestions = await ctx.prisma.libraryQuestion.findMany({
        where: { id: { in: input.questionIds } },
        include: { testCases: { orderBy: { order: "asc" } } },
      });

      if (libraryQuestions.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No valid questions found" });
      }

      const lastQuestion = await ctx.prisma.question.findFirst({
        where: { testId: input.testId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const startOrder = (lastQuestion?.order ?? -1) + 1;

      return ctx.prisma.$transaction(async (tx) => {
        let imported = 0;
        for (let i = 0; i < libraryQuestions.length; i++) {
          const lq = libraryQuestions[i];
          const created = await tx.question.create({
            data: {
              testId: input.testId,
              questionText: lq.questionText,
              questionType: lq.questionType,
              options: lq.options as object,
              correctOptionIds: lq.correctOptionIds as object,
              marks: lq.marks,
              negativeMarks: lq.negativeMarks,
              explanation: lq.explanation,
              order: startOrder + i,
              codeBlock: lq.codeBlock,
              codeLanguage: lq.codeLanguage,
              imageUrls: lq.imageUrls ?? undefined,
            },
          });

          if (lq.questionType === "CODING" && lq.testCases.length > 0) {
            await tx.testCase.createMany({
              data: lq.testCases.map((tc) => ({
                questionId: created.id,
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isSample: tc.isSample,
                order: tc.order,
              })),
            });
          }
          imported++;
        }

        const allQuestions = await tx.question.findMany({
          where: { testId: input.testId },
          select: { marks: true },
        });
        const totalMarks = allQuestions.reduce((sum, q) => sum + q.marks, 0);
        await tx.test.update({ where: { id: input.testId }, data: { totalMarks } });

        return { imported, totalMarks };
      });
    }),

  saveFromTest: collegeAdminProcedure
    .input(z.object({
      testId: z.string().min(1),
      questionIds: z.array(z.string()).min(1),
      scope: z.enum(["global", "private"]),
      categories: z.array(z.string().min(1)).min(1),
      difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    }))
    .mutation(async ({ ctx, input }) => {
      let collegeId: string | null = null;
      if (input.scope === "private") {
        collegeId = ctx.user.collegeId;
      }

      const test = await ctx.prisma.test.findUnique({
        where: { id: input.testId },
        include: { drive: { select: { collegeId: true } } },
      });
      if (!test) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Test not found" });
      }
      if (test.drive.collegeId !== ctx.user.collegeId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }

      const questions = await ctx.prisma.question.findMany({
        where: { id: { in: input.questionIds }, testId: input.testId },
        include: { testCases: true },
      });

      if (questions.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No valid questions found" });
      }

      return ctx.prisma.$transaction(async (tx) => {
        let saved = 0;
        for (const q of questions) {
          const created = await tx.libraryQuestion.create({
            data: {
              questionText: q.questionText,
              questionType: q.questionType,
              options: q.options ?? [],
              correctOptionIds: q.correctOptionIds ?? [],
              marks: q.marks,
              negativeMarks: q.negativeMarks,
              explanation: q.explanation,
              codeBlock: q.codeBlock,
              codeLanguage: q.codeLanguage,
              imageUrls: q.imageUrls ?? undefined,
              categories: input.categories,
              difficulty: input.difficulty as Difficulty,
              collegeId,
              createdById: ctx.user.id,
            },
          });

          if (q.questionType === "CODING" && q.testCases.length > 0) {
            await tx.libraryTestCase.createMany({
              data: q.testCases.map((tc) => ({
                libraryQuestionId: created.id,
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isSample: tc.isSample,
                order: tc.order,
              })),
            });
          }
          saved++;
        }
        return { saved };
      });
    }),

  // --- Category procedures ---

  listCategories: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx;
    if (user.role !== "SUPER_ADMIN" && user.role !== "COLLEGE_ADMIN") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
    }

    let where: Prisma.CategoryWhereInput;
    if (user.role === "SUPER_ADMIN") {
      where = { collegeId: { equals: null } };
    } else if (user.collegeId) {
      where = {
        OR: [
          { collegeId: { equals: null } },
          { collegeId: user.collegeId },
        ],
      };
    } else {
      where = { collegeId: { equals: null } };
    }

    const categories = await ctx.prisma.category.findMany({ where, orderBy: { name: "asc" } });

    const allQuestions = await ctx.prisma.libraryQuestion.findMany({
      select: { categories: true },
    });
    const distinctCategoryNames = new Set<string>();
    for (const q of allQuestions) {
      for (const cat of q.categories) {
        if (cat) distinctCategoryNames.add(cat);
      }
    }

    const managedNames = new Set(categories.map((c) => c.name));
    const result = categories.map((c) => ({
      id: c.id,
      name: c.name,
      isGlobal: c.collegeId === null,
    }));

    for (const catName of distinctCategoryNames) {
      if (!managedNames.has(catName)) {
        result.push({ id: catName, name: catName, isGlobal: true });
      }
    }

    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }),

  createCategory: protectedProcedure
    .input(createCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      if (user.role !== "SUPER_ADMIN" && user.role !== "COLLEGE_ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }

      const name = input.name.trim();
      const collegeId = user.role === "SUPER_ADMIN" ? null : (user.collegeId || null);

      const existingWhere: Prisma.CategoryWhereInput = collegeId === null
        ? { name, collegeId: { equals: null } }
        : { name, collegeId };

      const existing = await ctx.prisma.category.findFirst({ where: existingWhere });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Category already exists" });
      }

      if (collegeId !== null) {
        const globalExists = await ctx.prisma.category.findFirst({
          where: { name, collegeId: { equals: null } },
        });
        if (globalExists) {
          throw new TRPCError({ code: "CONFLICT", message: "A global category with this name already exists" });
        }
      }

      const category = await ctx.prisma.category.create({ data: { name, collegeId } });
      return { id: category.id, name: category.name, isGlobal: category.collegeId === null };
    }),

  updateCategory: protectedProcedure
    .input(updateCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.prisma.category.findUnique({ where: { id: input.id } });
      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      }

      if (ctx.user.role === "SUPER_ADMIN" && category.collegeId !== null) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }
      if (ctx.user.role === "COLLEGE_ADMIN") {
        if (category.collegeId === null || category.collegeId !== ctx.user.collegeId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot edit global categories" });
        }
      }

      const newName = input.name.trim();
      const existing = await ctx.prisma.category.findFirst({
        where: {
          name: newName,
          collegeId: category.collegeId === null ? { equals: null } : category.collegeId,
          id: { not: input.id },
        },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "A category with this name already exists" });
      }

      const updated = await ctx.prisma.category.update({
        where: { id: input.id },
        data: { name: newName },
      });
      return { id: updated.id, name: updated.name, isGlobal: updated.collegeId === null };
    }),

  deleteCategory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.prisma.category.findUnique({ where: { id: input.id } });
      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      }

      if (ctx.user.role === "SUPER_ADMIN" && category.collegeId !== null) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }
      if (ctx.user.role === "COLLEGE_ADMIN") {
        if (category.collegeId === null || category.collegeId !== ctx.user.collegeId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete global categories" });
        }
      }

      await ctx.prisma.category.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
