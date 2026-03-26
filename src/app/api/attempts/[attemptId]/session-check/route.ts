import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

type RouteParams = { params: Promise<{ attemptId: string }> };

// GET /api/attempts/[attemptId]/session-check — verify current session owns this attempt & update heartbeat
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { attemptId } = await params;

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      select: { activeSessionId: true, studentId: true, status: true },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    if (attempt.studentId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If attempt is no longer in progress, no conflict
    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json({ active: true });
    }

    const isActive =
      !attempt.activeSessionId ||
      attempt.activeSessionId === session.session.id;

    // Update heartbeat if this is the active session
    if (isActive) {
      await prisma.testAttempt.update({
        where: { id: attemptId },
        data: { lastHeartbeat: new Date() },
      });
    }

    return NextResponse.json({ active: isActive });
  } catch (error) {
    console.error("GET /api/attempts/[attemptId]/session-check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
