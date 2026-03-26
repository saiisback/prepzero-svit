import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { validateAttemptSession } from "@/lib/attempt-session";
import { executeBatch } from "@/lib/judge0";
import { CodingLanguage } from "@/generated/prisma/client";

const runCodeSchema = z.object({
  questionId: z.string().min(1),
  code: z.string().min(1, "Code is required").max(50000),
  language: z.enum(["PYTHON", "JAVA", "C", "CPP"]),
});

type RouteParams = { params: Promise<{ attemptId: string }> };

// POST /api/attempts/[attemptId]/run — run code against sample test cases
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as {
      id: string;
      role: string;
    };

    if (user.role !== "STUDENT") {
      return NextResponse.json(
        { error: "Only students can run code" },
        { status: 403 }
      );
    }

    const { attemptId } = await params;

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }

    if (attempt.studentId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Cannot run code on a submitted attempt" },
        { status: 400 }
      );
    }

    // Validate session — prevent multi-device access
    const sessionError = await validateAttemptSession(attemptId, session.session.id);
    if (sessionError) return sessionError;

    const body = await request.json();
    const parsed = runCodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify question belongs to test and is CODING type
    const question = await prisma.question.findUnique({
      where: { id: parsed.data.questionId },
    });

    if (!question || question.testId !== attempt.testId) {
      return NextResponse.json(
        { error: "Question does not belong to this test" },
        { status: 400 }
      );
    }

    if (question.questionType !== "CODING") {
      return NextResponse.json(
        { error: "This question is not a coding question" },
        { status: 400 }
      );
    }

    // Fetch only sample test cases
    const sampleTestCases = await prisma.testCase.findMany({
      where: { questionId: question.id, isSample: true },
      orderBy: { order: "asc" },
    });

    if (sampleTestCases.length === 0) {
      return NextResponse.json(
        { error: "No sample test cases found" },
        { status: 400 }
      );
    }

    const results = await executeBatch(
      parsed.data.code,
      parsed.data.language as CodingLanguage,
      sampleTestCases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
      }))
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("POST /api/attempts/[attemptId]/run error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
