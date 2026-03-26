import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-guard";
import { generateTestReportCsv } from "@/lib/report-csv";

// GET /api/reports/download?testId=xxx
export async function GET(request: NextRequest) {
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

    if (user.role !== "COLLEGE_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const testId = request.nextUrl.searchParams.get("testId");
    if (!testId) {
      return NextResponse.json(
        { error: "testId is required" },
        { status: 400 }
      );
    }

    const report = await generateTestReportCsv(testId, user.collegeId!);

    return new NextResponse(report.csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${report.filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/download error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
