import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { CodingLanguage } from "@/generated/prisma/client";
import { router, protectedProcedure, studentProcedure } from "../trpc";
import { saveAnswerSchema, runCodeSchema, reportViolationSchema } from "../schemas";
import { validateAttemptSession } from "@/lib/attempt-session";
import { executeBatch } from "@/lib/judge0";

const FIELD_MAP: Record<string, string> = {
  TAB_SWITCH: "tabSwitchCount",
  FULLSCREEN_EXIT: "fullscreenExitCount",
  COPY_PASTE: "copyPasteAttempts",
  REFRESH: "refreshCount",
};

export const attemptRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let where: any = {};

    if (user.role === "STUDENT") {
      where = { studentId: user.id };
    } else if (user.role === "COLLEGE_ADMIN") {
      where = { test: { drive: { collegeId: user.collegeId } } };
    }
    // SUPER_ADMIN: no filter

    return ctx.prisma.testAttempt.findMany({
      where,
      include: {
        test: {
          select: {
            id: true,
            title: true,
            totalMarks: true,
            passingMarks: true,
            durationMinutes: true,
            resultVisibility: true,
            showResults: true,
            drive: {
              select: { id: true, title: true, companyName: true },
            },
          },
        },
        student: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const attempt = await ctx.prisma.testAttempt.findUnique({
        where: { id: input.id },
        include: {
          test: {
            include: {
              drive: {
                select: { id: true, title: true, companyName: true, collegeId: true },
              },
              questions: {
                orderBy: { order: "asc" },
                include: { testCases: true },
              },
            },
          },
          student: { select: { id: true, name: true, email: true } },
          answers: {
            include: { question: true },
            orderBy: { answeredAt: "asc" },
          },
        },
      });

      if (!attempt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Attempt not found" });
      }

      if (ctx.user.role === "STUDENT" && attempt.studentId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }
      if (ctx.user.role === "COLLEGE_ADMIN" && attempt.test.drive.collegeId !== ctx.user.collegeId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }

      // Hide correct answers during in-progress attempt for students
      if (ctx.user.role === "STUDENT" && attempt.status === "IN_PROGRESS") {
        const sanitizedQuestions = attempt.test.questions.map(
          ({ correctOptionIds: _c, explanation: _e, testCases, ...rest }) => ({
            ...rest,
            ...(rest.questionType === "CODING"
              ? { testCases: testCases.filter((tc) => tc.isSample) }
              : {}),
          })
        );
        return {
          ...attempt,
          test: { ...attempt.test, questions: sanitizedQuestions },
        };
      }

      return attempt;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role === "STUDENT") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }

      const attempt = await ctx.prisma.testAttempt.findUnique({
        where: { id: input.id },
        include: { test: { include: { drive: { select: { collegeId: true } } } } },
      });

      if (!attempt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Attempt not found" });
      }

      if (ctx.user.role === "COLLEGE_ADMIN" && attempt.test.drive.collegeId !== ctx.user.collegeId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }

      if (attempt.status === "IN_PROGRESS") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete an in-progress attempt. Wait for submission or timeout.",
        });
      }

      await ctx.prisma.testAttempt.delete({ where: { id: input.id } });
      return { success: true };
    }),

  saveAnswer: studentProcedure
    .input(saveAnswerSchema)
    .mutation(async ({ ctx, input }) => {
      const attempt = await ctx.prisma.testAttempt.findUnique({
        where: { id: input.attemptId },
      });

      if (!attempt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Attempt not found" });
      }
      if (attempt.studentId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }
      if (attempt.status !== "IN_PROGRESS") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot modify a submitted attempt" });
      }

      const sessionError = await validateAttemptSession(input.attemptId, ctx.session.session.id);
      if (sessionError) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Session validation failed" });
      }

      const question = await ctx.prisma.question.findUnique({
        where: { id: input.questionId },
      });
      if (!question || question.testId !== attempt.testId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Question does not belong to this test" });
      }

      if (question.questionType !== "CODING") {
        const optionIds = (question.options as Array<{ id: string }>).map((o) => o.id);
        const invalidIds = input.selectedOptionIds.filter((id) => !optionIds.includes(id));
        if (invalidIds.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid option IDs: ${invalidIds.join(", ")}`,
          });
        }
      }

      return ctx.prisma.answer.upsert({
        where: {
          attemptId_questionId: {
            attemptId: input.attemptId,
            questionId: input.questionId,
          },
        },
        update: {
          selectedOptionIds: input.selectedOptionIds,
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.language !== undefined ? { language: input.language } : {}),
          answeredAt: new Date(),
        },
        create: {
          attemptId: input.attemptId,
          questionId: input.questionId,
          selectedOptionIds: input.selectedOptionIds,
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.language !== undefined ? { language: input.language } : {}),
        },
      });
    }),

  runCode: studentProcedure
    .input(runCodeSchema)
    .mutation(async ({ ctx, input }) => {
      const attempt = await ctx.prisma.testAttempt.findUnique({
        where: { id: input.attemptId },
      });

      if (!attempt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Attempt not found" });
      }
      if (attempt.studentId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }
      if (attempt.status !== "IN_PROGRESS") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot run code on a submitted attempt" });
      }

      const sessionError = await validateAttemptSession(input.attemptId, ctx.session.session.id);
      if (sessionError) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Session validation failed" });
      }

      const question = await ctx.prisma.question.findUnique({
        where: { id: input.questionId },
      });
      if (!question || question.testId !== attempt.testId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Question does not belong to this test" });
      }
      if (question.questionType !== "CODING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This question is not a coding question" });
      }

      const sampleTestCases = await ctx.prisma.testCase.findMany({
        where: { questionId: question.id, isSample: true },
        orderBy: { order: "asc" },
      });

      if (sampleTestCases.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No sample test cases found" });
      }

      const results = await executeBatch(
        input.code,
        input.language as CodingLanguage,
        sampleTestCases.map((tc) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
        }))
      );

      return { results };
    }),

  reportViolation: studentProcedure
    .input(reportViolationSchema)
    .mutation(async ({ ctx, input }) => {
      const attempt = await ctx.prisma.testAttempt.findUnique({
        where: { id: input.attemptId },
      });

      if (!attempt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Attempt not found" });
      }
      if (attempt.studentId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }
      if (attempt.status !== "IN_PROGRESS") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Attempt is not in progress" });
      }

      const sessionError = await validateAttemptSession(input.attemptId, ctx.session.session.id);
      if (sessionError) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Session validation failed" });
      }

      const field = FIELD_MAP[input.type];

      const updated = await ctx.prisma.testAttempt.update({
        where: { id: input.attemptId },
        data: {
          [field]: { increment: 1 },
          totalViolations: { increment: 1 },
        },
        select: {
          tabSwitchCount: true,
          fullscreenExitCount: true,
          copyPasteAttempts: true,
          totalViolations: true,
          maxViolations: true,
        },
      });

      return {
        ...updated,
        maxExceeded: updated.totalViolations >= updated.maxViolations,
      };
    }),

  checkSession: studentProcedure
    .input(z.object({ attemptId: z.string() }))
    .query(async ({ ctx, input }) => {
      const attempt = await ctx.prisma.testAttempt.findUnique({
        where: { id: input.attemptId },
        select: { activeSessionId: true, studentId: true, status: true },
      });

      if (!attempt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Attempt not found" });
      }
      if (attempt.studentId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }

      if (attempt.status !== "IN_PROGRESS") {
        return { active: true };
      }

      const isActive = !attempt.activeSessionId || attempt.activeSessionId === ctx.session.session.id;

      if (isActive) {
        await ctx.prisma.testAttempt.update({
          where: { id: input.attemptId },
          data: { lastHeartbeat: new Date() },
        });
      }

      return { active: isActive };
    }),
});
