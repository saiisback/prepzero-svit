import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { revalidatePath } from "next/cache";
import { Prisma, CodingLanguage } from "@/generated/prisma/client";
import { router, protectedProcedure, collegeAdminProcedure, studentProcedure } from "../trpc";
import { createTestSchema, updateTestSchema } from "../schemas";
import { isStudentEligible, buildEligibleStudentsWhere } from "@/lib/test-eligibility";
import { validateAttemptSession } from "@/lib/attempt-session";
import { executeBatch } from "@/lib/judge0";
import { sendNotificationForTest } from "@/lib/test-notifications";

export const testRouter = router({
  list: protectedProcedure
    .input(z.object({ driveId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};

      if (input?.driveId) {
        where.driveId = input.driveId;
      }

      if (user.role === "COLLEGE_ADMIN") {
        where.drive = { collegeId: user.collegeId };
      } else if (user.role === "STUDENT") {
        const now = new Date();
        where.drive = { collegeId: user.collegeId };
        where.status = "PUBLISHED";
        where.OR = [{ endTime: null }, { endTime: { gte: now } }];
      }

      const allTests = await ctx.prisma.test.findMany({
        where,
        include: {
          drive: {
            select: {
              id: true,
              title: true,
              companyName: true,
              college: { select: { id: true, name: true } },
            },
          },
          _count: { select: { questions: true, attempts: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      if (user.role === "STUDENT") {
        const student = await ctx.prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, departmentId: true, semester: true },
        });
        if (student) {
          return allTests.filter((test) => isStudentEligible(test, student));
        }
      }

      return allTests;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const test = await ctx.prisma.test.findUnique({
        where: { id: input.id },
        include: {
          drive: {
            select: {
              id: true,
              title: true,
              companyName: true,
              collegeId: true,
              college: { select: { id: true, name: true } },
            },
          },
          _count: { select: { questions: true, attempts: true } },
        },
      });

      if (!test) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Test not found" });
      }

      if (
        (ctx.user.role === "COLLEGE_ADMIN" || ctx.user.role === "STUDENT") &&
        test.drive.collegeId !== ctx.user.collegeId
      ) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
      }

      if (ctx.user.role === "STUDENT") {
        const student = await ctx.prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { id: true, departmentId: true, semester: true },
        });
        if (!student || !isStudentEligible(test, student)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not eligible for this test" });
        }
      }

      return test;
    }),

  create: collegeAdminProcedure
    .input(createTestSchema)
    .mutation(async ({ ctx, input }) => {
      const drive = await ctx.prisma.placementDrive.findUnique({
        where: { id: input.driveId },
      });

      if (!drive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Drive not found" });
      }

      if (drive.collegeId !== ctx.user.collegeId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
      }

      const { allowedDepartmentIds, allowedSemesters, allowedStudentIds, ...rest } = input;

      return ctx.prisma.test.create({
        data: {
          ...rest,
          startTime: rest.startTime ? new Date(rest.startTime) : undefined,
          endTime: rest.endTime ? new Date(rest.endTime) : undefined,
          ...(allowedDepartmentIds !== undefined && {
            allowedDepartmentIds: allowedDepartmentIds ?? undefined,
          }),
          ...(allowedSemesters !== undefined && {
            allowedSemesters: allowedSemesters ?? undefined,
          }),
          ...(allowedStudentIds !== undefined && {
            allowedStudentIds: allowedStudentIds ?? undefined,
          }),
        },
        include: {
          drive: {
            select: {
              id: true,
              title: true,
              companyName: true,
              college: { select: { id: true, name: true } },
            },
          },
        },
      });
    }),

  update: collegeAdminProcedure
    .input(z.object({ id: z.string() }).merge(updateTestSchema))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const test = await ctx.prisma.test.findUnique({
        where: { id },
        include: { drive: { select: { collegeId: true } } },
      });

      if (!test) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Test not found" });
      }
      if (test.drive.collegeId !== ctx.user.collegeId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
      }

      const updateData: Record<string, unknown> = { ...data };
      if (data.startTime !== undefined) {
        updateData.startTime = data.startTime ? new Date(data.startTime) : null;
        updateData.notificationSent = false;
      }
      if (data.endTime !== undefined) {
        updateData.endTime = data.endTime ? new Date(data.endTime) : null;
      }
      if (data.allowedDepartmentIds === null) {
        updateData.allowedDepartmentIds = Prisma.DbNull;
      }
      if (data.allowedSemesters === null) {
        updateData.allowedSemesters = Prisma.DbNull;
      }
      if (data.allowedStudentIds === null) {
        updateData.allowedStudentIds = Prisma.DbNull;
      }

      const updated = await ctx.prisma.test.update({
        where: { id },
        data: updateData,
        include: {
          drive: {
            select: {
              id: true,
              title: true,
              companyName: true,
              college: { select: { id: true, name: true } },
            },
          },
          _count: { select: { questions: true, attempts: true } },
        },
      });

      if (updated.status === "PUBLISHED" && updated.startTime) {
        sendNotificationForTest(id).catch((err) =>
          console.error("Background notification error:", err)
        );
      }

      // Invalidate reports cache when test is closed
      if (updated.status === "CLOSED") {
        revalidatePath("/college/reports");
      }

      return updated;
    }),

  delete: collegeAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const test = await ctx.prisma.test.findUnique({
        where: { id: input.id },
        include: { drive: { select: { collegeId: true } } },
      });
      if (!test) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Test not found" });
      }
      if (test.drive.collegeId !== ctx.user.collegeId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
      }

      await ctx.prisma.test.delete({ where: { id: input.id } });
      revalidatePath("/college/reports");
      return { message: "Test deleted successfully" };
    }),

  start: studentProcedure
    .input(z.object({ testId: z.string() }))
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

      const student = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { id: true, departmentId: true, semester: true },
      });
      if (!student || !isStudentEligible(test, student)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not eligible for this test" });
      }

      if (test.status !== "PUBLISHED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Test is not available for taking" });
      }

      const now = new Date();
      if (test.startTime && now < test.startTime) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Test has not started yet" });
      }
      if (test.endTime && now > test.endTime) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Test has ended" });
      }

      const existingAttempt = await ctx.prisma.testAttempt.findUnique({
        where: {
          testId_studentId: { testId: input.testId, studentId: ctx.user.id },
        },
      });

      if (existingAttempt) {
        if (existingAttempt.status === "IN_PROGRESS") {
          const oldSessionId = existingAttempt.activeSessionId;
          const newSessionId = ctx.session.session.id;

          if (oldSessionId && oldSessionId !== newSessionId) {
            const { count } = await ctx.prisma.testAttempt.updateMany({
              where: { id: existingAttempt.id, activeSessionId: oldSessionId },
              data: { activeSessionId: newSessionId, lastHeartbeat: new Date() },
            });

            if (count > 0) {
              const studentInfo = await ctx.prisma.user.findUnique({
                where: { id: ctx.user.id },
                select: { name: true, email: true },
              });

              await ctx.prisma.notification.create({
                data: {
                  collegeId: test.drive.collegeId,
                  type: "SESSION_CONFLICT",
                  title: "Multi-device test attempt detected",
                  message: `${studentInfo?.name ?? "A student"} (${studentInfo?.email ?? ctx.user.id}) opened "${test.title}" on a different device during the test.`,
                  metadata: {
                    studentId: ctx.user.id,
                    studentName: studentInfo?.name,
                    studentEmail: studentInfo?.email,
                    testId: input.testId,
                    testTitle: test.title,
                    attemptId: existingAttempt.id,
                  },
                },
              });
            }
          } else {
            await ctx.prisma.testAttempt.update({
              where: { id: existingAttempt.id },
              data: { activeSessionId: newSessionId, lastHeartbeat: new Date() },
            });
          }

          const updated = await ctx.prisma.testAttempt.findUnique({
            where: { id: existingAttempt.id },
          });
          return updated!;
        }
        throw new TRPCError({ code: "CONFLICT", message: "You have already attempted this test" });
      }

      try {
        return await ctx.prisma.testAttempt.create({
          data: {
            testId: input.testId,
            studentId: ctx.user.id,
            status: "IN_PROGRESS",
            totalMarks: test.totalMarks,
            maxViolations: test.maxViolations,
            activeSessionId: ctx.session.session.id,
            lastHeartbeat: new Date(),
          },
        });
      } catch (createError: unknown) {
        if (
          typeof createError === "object" &&
          createError !== null &&
          "code" in createError &&
          (createError as { code: string }).code === "P2002"
        ) {
          const existing = await ctx.prisma.testAttempt.findUnique({
            where: { testId_studentId: { testId: input.testId, studentId: ctx.user.id } },
          });
          if (existing?.status === "IN_PROGRESS") return existing;
          throw new TRPCError({ code: "CONFLICT", message: "You have already attempted this test" });
        }
        throw createError;
      }
    }),

  submit: studentProcedure
    .input(z.object({ testId: z.string(), autoSubmitted: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const attempt = await ctx.prisma.testAttempt.findUnique({
        where: {
          testId_studentId: { testId: input.testId, studentId: ctx.user.id },
        },
        include: { answers: true },
      });

      if (!attempt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No attempt found for this test" });
      }
      if (attempt.status !== "IN_PROGRESS") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This attempt has already been submitted" });
      }

      const sessionError = await validateAttemptSession(attempt.id, ctx.session.session.id);
      if (sessionError) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Session validation failed" });
      }

      const questions = await ctx.prisma.question.findMany({ where: { testId: input.testId } });
      const questionMap = new Map(questions.map((q) => [q.id, q]));

      const codingQuestionIds = questions
        .filter((q) => q.questionType === "CODING")
        .map((q) => q.id);

      const allTestCases =
        codingQuestionIds.length > 0
          ? await ctx.prisma.testCase.findMany({
              where: { questionId: { in: codingQuestionIds } },
              orderBy: { order: "asc" },
            })
          : [];

      const testCaseMap = new Map<string, Array<{ input: string; expectedOutput: string }>>();
      for (const tc of allTestCases) {
        const list = testCaseMap.get(tc.questionId) || [];
        list.push({ input: tc.input, expectedOutput: tc.expectedOutput });
        testCaseMap.set(tc.questionId, list);
      }

      let totalScore = 0;
      const answerUpdates: Array<{ id: string; isCorrect: boolean; marksAwarded: number }> = [];

      const mcqAnswers: typeof attempt.answers = [];
      const codingAnswers: typeof attempt.answers = [];

      for (const answer of attempt.answers) {
        const question = questionMap.get(answer.questionId);
        if (!question) continue;
        if (question.questionType === "CODING") {
          codingAnswers.push(answer);
        } else {
          mcqAnswers.push(answer);
        }
      }

      for (const answer of mcqAnswers) {
        const question = questionMap.get(answer.questionId)!;
        const selectedIds = answer.selectedOptionIds as string[];
        const correctIds = question.correctOptionIds as string[];

        const isCorrect =
          selectedIds.length === correctIds.length &&
          selectedIds.every((id) => correctIds.includes(id)) &&
          correctIds.every((id) => selectedIds.includes(id));

        let marksAwarded = 0;
        if (selectedIds.length === 0) {
          marksAwarded = 0;
        } else if (isCorrect) {
          marksAwarded = question.marks;
        } else {
          marksAwarded = -question.negativeMarks;
        }

        totalScore += marksAwarded;
        answerUpdates.push({ id: answer.id, isCorrect, marksAwarded });
      }

      if (codingAnswers.length > 0) {
        const codingResults = await Promise.all(
          codingAnswers.map(async (answer) => {
            const question = questionMap.get(answer.questionId)!;
            const code = answer.code;
            const language = answer.language;

            if (!code || !language) {
              return { id: answer.id, isCorrect: false, marksAwarded: 0 };
            }

            const testCases = testCaseMap.get(answer.questionId) || [];
            if (testCases.length === 0) {
              return { id: answer.id, isCorrect: false, marksAwarded: 0 };
            }

            try {
              const results = await executeBatch(code, language as CodingLanguage, testCases);
              const allPassed = results.every((r) => r.passed);
              const marksAwarded = allPassed ? question.marks : -question.negativeMarks;
              return { id: answer.id, isCorrect: allPassed, marksAwarded };
            } catch {
              return { id: answer.id, isCorrect: false, marksAwarded: 0 };
            }
          })
        );

        for (const result of codingResults) {
          totalScore += result.marksAwarded;
          answerUpdates.push(result);
        }
      }

      const finalScore = Math.max(0, totalScore);
      const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
      const percentage = totalMarks > 0 ? (finalScore / totalMarks) * 100 : 0;
      const submittedAt = new Date();
      const timeTakenSeconds = Math.floor(
        (submittedAt.getTime() - attempt.startedAt.getTime()) / 1000
      );

      const updatedAttempt = await ctx.prisma.$transaction(async (tx) => {
        for (const update of answerUpdates) {
          await tx.answer.update({
            where: { id: update.id },
            data: { isCorrect: update.isCorrect, marksAwarded: update.marksAwarded },
          });
        }

        return tx.testAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "SUBMITTED",
            submittedAt,
            score: finalScore,
            totalMarks,
            percentage: Math.round(percentage * 100) / 100,
            timeTakenSeconds,
            autoSubmitted: input.autoSubmitted ?? false,
          },
          include: {
            answers: {
              include: {
                question: {
                  select: { id: true, questionText: true, marks: true, negativeMarks: true },
                },
              },
            },
          },
        });
      });

      return updatedAttempt;
    }),

  monitor: collegeAdminProcedure
    .input(z.object({ testId: z.string() }))
    .query(async ({ ctx, input }) => {
      const test = await ctx.prisma.test.findUnique({
        where: { id: input.testId },
        include: {
          drive: { select: { id: true, title: true, collegeId: true } },
        },
      });

      if (!test) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Test not found" });
      }
      if (test.drive.collegeId !== ctx.user.collegeId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
      }

      const collegeId = test.drive.collegeId;
      const eligibleWhere = buildEligibleStudentsWhere(test, collegeId);

      const [students, attempts] = await Promise.all([
        ctx.prisma.user.findMany({
          where: eligibleWhere,
          select: {
            id: true,
            name: true,
            email: true,
            usn: true,
            department: { select: { name: true } },
          },
          orderBy: { name: "asc" },
        }),
        ctx.prisma.testAttempt.findMany({
          where: { testId: input.testId },
          select: {
            studentId: true,
            status: true,
            startedAt: true,
            submittedAt: true,
            totalViolations: true,
            lastHeartbeat: true,
          },
        }),
      ]);

      const attemptMap = new Map(attempts.map((a) => [a.studentId, a]));
      const now = Date.now();
      const HEARTBEAT_TIMEOUT_MS = 30_000;

      let notStarted = 0;
      let inProgress = 0;
      let submitted = 0;
      let timedOut = 0;
      let left = 0;

      const studentList = students.map((s) => {
        const attempt = attemptMap.get(s.id);
        let status: string;

        if (!attempt) {
          status = "NOT_STARTED";
          notStarted++;
        } else if (attempt.status === "SUBMITTED") {
          status = "SUBMITTED";
          submitted++;
        } else if (attempt.status === "TIMED_OUT") {
          status = "TIMED_OUT";
          timedOut++;
        } else if (
          attempt.status === "IN_PROGRESS" &&
          attempt.lastHeartbeat &&
          now - new Date(attempt.lastHeartbeat).getTime() > HEARTBEAT_TIMEOUT_MS
        ) {
          status = "LEFT";
          left++;
        } else {
          status = "IN_PROGRESS";
          inProgress++;
        }

        return {
          id: s.id,
          name: s.name,
          email: s.email,
          usn: s.usn,
          department: s.department?.name ?? null,
          status,
          startedAt: attempt?.startedAt ?? null,
          submittedAt: attempt?.submittedAt ?? null,
          totalViolations: attempt?.totalViolations ?? 0,
        };
      });

      return {
        test: {
          id: test.id,
          title: test.title,
          status: test.status,
          durationMinutes: test.durationMinutes,
          startTime: test.startTime,
          endTime: test.endTime,
          drive: { id: test.drive.id, title: test.drive.title },
        },
        summary: {
          totalStudents: students.length,
          notStarted,
          inProgress,
          submitted,
          timedOut,
          left,
        },
        students: studentList,
      };
    }),
});
