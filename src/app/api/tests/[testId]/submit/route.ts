import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { validateAttemptSession } from "@/lib/attempt-session";
import { executeBatch } from "@/lib/judge0";
import { CodingLanguage } from "@/generated/prisma/client";

type RouteParams = { params: Promise<{ testId: string }> };

// POST /api/tests/[testId]/submit — student submits a test
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as {
      id: string;
      role: string;
      collegeId: string | null;
    };

    if (user.role !== "STUDENT") {
      return NextResponse.json(
        { error: "Only students can submit tests" },
        { status: 403 }
      );
    }

    const { testId } = await params;

    // Check if this is an auto-submit due to violations
    let autoSubmitted = false;
    try {
      const body = await request.json();
      autoSubmitted = body?.autoSubmitted === true;
    } catch {
      // No body or invalid JSON — manual submit
    }

    // Find the student's in-progress attempt
    const attempt = await prisma.testAttempt.findUnique({
      where: {
        testId_studentId: {
          testId,
          studentId: user.id,
        },
      },
      include: {
        answers: true,
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "No attempt found for this test" },
        { status: 404 }
      );
    }

    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "This attempt has already been submitted" },
        { status: 400 }
      );
    }

    // Validate session — prevent multi-device access
    const sessionError = await validateAttemptSession(attempt.id, session.session.id);
    if (sessionError) return sessionError;

    // Fetch all questions for this test
    const questions = await prisma.question.findMany({
      where: { testId },
    });

    // Build a map of questionId -> question for quick lookup
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    // Pre-fetch all test cases for coding questions in one query
    const codingQuestionIds = questions
      .filter((q) => q.questionType === "CODING")
      .map((q) => q.id);

    const allTestCases =
      codingQuestionIds.length > 0
        ? await prisma.testCase.findMany({
            where: { questionId: { in: codingQuestionIds } },
            orderBy: { order: "asc" },
          })
        : [];

    // Group test cases by questionId
    const testCaseMap = new Map<
      string,
      Array<{ input: string; expectedOutput: string }>
    >();
    for (const tc of allTestCases) {
      const list = testCaseMap.get(tc.questionId) || [];
      list.push({ input: tc.input, expectedOutput: tc.expectedOutput });
      testCaseMap.set(tc.questionId, list);
    }

    // Auto-grade each answer
    let totalScore = 0;
    const answerUpdates: Array<{
      id: string;
      isCorrect: boolean;
      marksAwarded: number;
    }> = [];

    // Separate MCQ and coding answers
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

    // Grade MCQ answers synchronously
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

    // Grade coding answers in parallel
    if (codingAnswers.length > 0) {
      const codingResults = await Promise.all(
        codingAnswers.map(async (answer) => {
          const question = questionMap.get(answer.questionId)!;
          const code = answer.code;
          const language = answer.language;

          if (!code || !language) {
            return {
              id: answer.id,
              isCorrect: false,
              marksAwarded: 0,
            };
          }

          const testCases = testCaseMap.get(answer.questionId) || [];
          if (testCases.length === 0) {
            return {
              id: answer.id,
              isCorrect: false,
              marksAwarded: 0,
            };
          }

          try {
            const results = await executeBatch(
              code,
              language as CodingLanguage,
              testCases
            );

            const allPassed = results.every((r) => r.passed);
            const marksAwarded = allPassed
              ? question.marks
              : -question.negativeMarks;

            return {
              id: answer.id,
              isCorrect: allPassed,
              marksAwarded,
            };
          } catch {
            return {
              id: answer.id,
              isCorrect: false,
              marksAwarded: 0,
            };
          }
        })
      );

      for (const result of codingResults) {
        totalScore += result.marksAwarded;
        answerUpdates.push(result);
      }
    }

    // Floor total score at 0
    const finalScore = Math.max(0, totalScore);

    // Calculate total marks and percentage
    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    const percentage = totalMarks > 0 ? (finalScore / totalMarks) * 100 : 0;

    // Calculate time taken from server timestamps
    const submittedAt = new Date();
    const timeTakenSeconds = Math.floor(
      (submittedAt.getTime() - attempt.startedAt.getTime()) / 1000
    );

    // Update everything in a transaction
    const updatedAttempt = await prisma.$transaction(async (tx) => {
      // Update each answer with grading results
      for (const update of answerUpdates) {
        await tx.answer.update({
          where: { id: update.id },
          data: {
            isCorrect: update.isCorrect,
            marksAwarded: update.marksAwarded,
          },
        });
      }

      // Update the attempt
      const result = await tx.testAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "SUBMITTED",
          submittedAt,
          score: finalScore,
          totalMarks,
          percentage: Math.round(percentage * 100) / 100,
          timeTakenSeconds,
          autoSubmitted,
        },
        include: {
          answers: {
            include: {
              question: {
                select: {
                  id: true,
                  questionText: true,
                  marks: true,
                  negativeMarks: true,
                },
              },
            },
          },
        },
      });

      return result;
    });

    return NextResponse.json(updatedAttempt);
  } catch (error) {
    console.error("POST /api/tests/[testId]/submit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
