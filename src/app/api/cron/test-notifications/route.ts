import { NextRequest, NextResponse } from "next/server";
import { sendTestNotifications } from "@/lib/test-notifications";

// GET /api/cron/test-notifications
// Called by system cron (every 5 min) or manually.
// Finds published tests starting within the next 15 minutes that haven't been notified yet,
// and sends email notifications to eligible students.
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await sendTestNotifications();
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/cron/test-notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
