import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { validateAttemptSession } from "@/lib/attempt-session";

type RouteParams = { params: Promise<{ attemptId: string }> };

const VIOLATION_TYPES = ["TAB_SWITCH", "FULLSCREEN_EXIT", "COPY_PASTE", "REFRESH"] as const;
type ViolationType = (typeof VIOLATION_TYPES)[number];

const FIELD_MAP: Record<ViolationType, string> = {
  TAB_SWITCH: "tabSwitchCount",
  FULLSCREEN_EXIT: "fullscreenExitCount",
  COPY_PASTE: "copyPasteAttempts",
  REFRESH: "refreshCount",
};

// POST /api/attempts/[attemptId]/violations — log a proctoring violation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    const { attemptId } = await params;

    const body = await request.json();
    const { type } = body as { type: string };

    if (!type || !VIOLATION_TYPES.includes(type as ViolationType)) {
      return NextResponse.json(
        { error: "Invalid violation type. Must be one of: TAB_SWITCH, FULLSCREEN_EXIT, COPY_PASTE" },
        { status: 400 }
      );
    }

    // Fetch the attempt
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    // Only the student who owns the attempt can log violations
    if (attempt.studentId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only allow violations on in-progress attempts
    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Attempt is not in progress" },
        { status: 400 }
      );
    }

    // Validate session — prevent multi-device access
    const sessionError = await validateAttemptSession(attemptId, session.session.id);
    if (sessionError) return sessionError;

    const field = FIELD_MAP[type as ViolationType];

    const updated = await prisma.testAttempt.update({
      where: { id: attemptId },
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

    return NextResponse.json({
      ...updated,
      maxExceeded: updated.totalViolations >= updated.maxViolations,
    });
  } catch (error) {
    console.error("POST /api/attempts/[attemptId]/violations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
