import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * Validates that the current session matches the active session for the attempt.
 * Returns null if valid, or a NextResponse error if invalid.
 */
export async function validateAttemptSession(
  attemptId: string,
  sessionId: string
): Promise<NextResponse | null> {
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    select: { activeSessionId: true, status: true },
  });

  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  if (attempt.status !== "IN_PROGRESS") {
    return null; // Don't block non-active attempts
  }

  if (attempt.activeSessionId && attempt.activeSessionId !== sessionId) {
    return NextResponse.json(
      { error: "SESSION_CONFLICT", message: "This test is active on another device. Only one device is allowed at a time." },
      { status: 409 }
    );
  }

  return null;
}
