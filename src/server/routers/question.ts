import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma, QuestionType } from "@/generated/prisma/client";
import { router, protectedProcedure, collegeAdminProcedure } from "../trpc";
import { questionSchema, bulkQuestionSchema } from "../schemas";

async function recalculateTestTotalMarks(
  tx: Prisma.TransactionClient,
  testId: string
) {
  const questions = await tx.question.findMany({
    where: { testId },
    select: { marks: true },
  });
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
  await tx.test.update({ where: { id: testId }, data: { totalMarks } });
  return totalMarks;
}

async function verifyTestAccess(
  prisma: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
  testId: string,
  userRole: string,
  userCollegeId: string | null
) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { drive: { select: { collegeId: true } } },
  });

  if (!test) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Test not found" });
  }

  if (userRole === "COLLEGE_ADMIN" && test.drive.collegeId !== userCollegeId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }

  return test;
}

export const questionRouter = router({
  list: protectedProcedure
    .input(z.object({ testId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyTestAccess(ctx.prisma, input.testId, ctx.user.role, ctx.user.collegeId);

      const questions = await ctx.prisma.question.findMany({
        where: { testId: input.testId },
        orderBy: { order: "asc" },
        include: { testCases: true },
      });

      if (ctx.user.role === "STUDENT") {
        return questions.map(
          ({ correctOptionIds: _c, explanation: _e, testCases, ...rest }) => ({
            ...rest,
            ...(rest.questionType === "CODING"
              ? { testCases: testCases.filter((tc) => tc.isSample) }
              : {}),
          })
        );
      }

      return questions;
    }),

  create: collegeAdminProcedure
    .input(z.object({
      testId: z.string(),
      question: questionSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const { testId, question: data } = input;
      await verifyTestAccess(ctx.prisma, testId, ctx.user.role, ctx.user.collegeId);

      const isCoding = data.questionType === "CODING";

      // Validate correctOptionIds for MCQ
      if (!isCoding && "options" in data && "correctOptionIds" in data) {
        const optionIds = data.options.map((o: { id: string }) => o.id);
        const invalidIds = (data as { correctOptionIds: string[] }).correctOptionIds.filter(
          (id: string) => !optionIds.includes(id)
        );
        if (invalidIds.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid correct option IDs: ${invalidIds.join(", ")}`,
          });
        }
      }

      const created = await ctx.prisma.$transaction(async (tx) => {
        const q = await tx.question.create({
          data: {
            testId,
            questionText: data.questionText,
            imageUrl: data.imageUrl || null,
            questionType: data.questionType as QuestionType,
            options: isCoding ? [] : ("options" in data ? (data as any).options : []),
            correctOptionIds: isCoding ? [] : ("correctOptionIds" in data ? (data as any).correctOptionIds : []),
            marks: data.marks,
            negativeMarks: data.negativeMarks,
            explanation: data.explanation,
            order: data.order,
            codeBlock: data.codeBlock ?? null,
            codeLanguage: data.codeLanguage ?? null,
            imageUrls: data.imageUrls ?? undefined,
          },
          include: { testCases: true },
        });

        if (isCoding && "testCases" in data && (data as any).testCases.length > 0) {
          await tx.testCase.createMany({
            data: (data as any).testCases.map((tc: any, idx: number) => ({
              questionId: q.id,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isSample: tc.isSample ?? false,
              order: tc.order ?? idx,
            })),
          });
        }

        await recalculateTestTotalMarks(tx, testId);

        return tx.question.findUnique({
          where: { id: q.id },
          include: { testCases: true },
        });
      });

      return created;
    }),

  update: collegeAdminProcedure
    .input(
      z.object({
        id: z.string(),
        testId: z.string(),
        questionText: z.string().min(1).optional(),
        imageUrl: z.string().optional().nullable(),
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
        order: z.number().int().min(0).optional(),
        codeBlock: z.string().optional().nullable(),
        codeLanguage: z.string().optional().nullable(),
        imageUrls: z.array(z.string()).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, testId, testCases, imageUrls, ...questionData } = input;

      await verifyTestAccess(ctx.prisma, testId, ctx.user.role, ctx.user.collegeId);

      const existing = await ctx.prisma.question.findUnique({
        where: { id },
        include: { test: { include: { drive: { select: { collegeId: true } } } } },
      });

      if (!existing || existing.testId !== testId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });
      }

      if (questionData.options && questionData.correctOptionIds) {
        const optionIds = questionData.options.map((o) => o.id);
        const invalidIds = questionData.correctOptionIds.filter((id) => !optionIds.includes(id));
        if (invalidIds.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid correct option IDs: ${invalidIds.join(", ")}`,
          });
        }
      }

      return ctx.prisma.$transaction(async (tx) => {
        await tx.question.update({
          where: { id },
          data: {
            ...questionData,
            ...(imageUrls !== undefined && { imageUrls: imageUrls ?? Prisma.JsonNull }),
          },
        });

        if (testCases !== undefined) {
          await tx.testCase.deleteMany({ where: { questionId: id } });
          if (testCases.length > 0) {
            await tx.testCase.createMany({
              data: testCases.map((tc, idx) => ({
                questionId: id,
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isSample: tc.isSample,
                order: tc.order ?? idx,
              })),
            });
          }
        }

        await recalculateTestTotalMarks(tx, testId);

        return tx.question.findUnique({
          where: { id },
          include: { testCases: true },
        });
      });
    }),

  delete: collegeAdminProcedure
    .input(z.object({ id: z.string(), testId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTestAccess(ctx.prisma, input.testId, ctx.user.role, ctx.user.collegeId);

      const existing = await ctx.prisma.question.findUnique({ where: { id: input.id } });
      if (!existing || existing.testId !== input.testId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });
      }

      await ctx.prisma.$transaction(async (tx) => {
        await tx.question.delete({ where: { id: input.id } });
        await recalculateTestTotalMarks(tx, input.testId);
      });

      return { message: "Question deleted successfully" };
    }),

  bulkCreate: collegeAdminProcedure
    .input(bulkQuestionSchema)
    .mutation(async ({ ctx, input }) => {
      await verifyTestAccess(ctx.prisma, input.testId, ctx.user.role, ctx.user.collegeId);

      const lastQuestion = await ctx.prisma.question.findFirst({
        where: { testId: input.testId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const startOrder = (lastQuestion?.order ?? -1) + 1;

      return ctx.prisma.$transaction(async (tx) => {
        const createdIds: string[] = [];
        for (let idx = 0; idx < input.questions.length; idx++) {
          const q = input.questions[idx];
          const isCoding = q.questionType === "CODING";
          const created = await tx.question.create({
            data: {
              testId: input.testId,
              questionText: q.questionText,
              imageUrl: q.imageUrl || null,
              questionType: q.questionType as QuestionType,
              options: isCoding ? [] : ("options" in q ? q.options : []),
              correctOptionIds: isCoding ? [] : ("correctOptionIds" in q ? q.correctOptionIds : []),
              marks: q.marks,
              negativeMarks: q.negativeMarks,
              explanation: q.explanation,
              order: startOrder + idx,
              codeBlock: q.codeBlock ?? null,
              codeLanguage: q.codeLanguage ?? null,
              imageUrls: q.imageUrls ?? undefined,
            },
            select: { id: true },
          });

          if (isCoding && "testCases" in q && q.testCases.length > 0) {
            await tx.testCase.createMany({
              data: q.testCases.map((tc, tcIdx) => ({
                questionId: created.id,
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isSample: tc.isSample ?? false,
                order: tc.order ?? tcIdx,
              })),
            });
          }

          createdIds.push(created.id);
        }

        const totalMarks = await recalculateTestTotalMarks(tx, input.testId);
        return { created: input.questions.length, totalMarks, questionIds: createdIds };
      });
    }),
});
