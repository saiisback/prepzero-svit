import { prisma } from "@/lib/prisma";
import { buildEligibleStudentsWhere } from "@/lib/test-eligibility";
import { format } from "date-fns";

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

interface ReportSummary {
  totalEligible: number;
  totalPresent: number;
  totalSubmitted: number;
  totalAbsent: number;
  totalPassed: number | null;
  totalFailed: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  totalViolations: number;
}

export interface GeneratedReport {
  csv: string;
  filename: string;
  summary: ReportSummary;
  testTitle: string;
  driveTitle: string;
}

export async function generateTestReportCsv(
  testId: string,
  collegeId: string
): Promise<GeneratedReport> {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      drive: { select: { id: true, title: true, collegeId: true } },
    },
  });

  if (!test || test.drive.collegeId !== collegeId) {
    throw new Error("Test not found");
  }

  const eligibleWhere = buildEligibleStudentsWhere(test, collegeId);
  const [eligibleStudents, attempts] = await Promise.all([
    prisma.user.findMany({
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
    prisma.testAttempt.findMany({
      where: { testId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            usn: true,
            department: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const attemptMap = new Map(attempts.map((a) => [a.studentId, a]));

  const headers = [
    "Student Name",
    "Email",
    "USN",
    "Department",
    "Status",
    "Score",
    "Total Marks",
    "Percentage",
    "Result",
    "Total Violations",
    "Tab Switches",
    "Fullscreen Exits",
    "Copy/Paste Attempts",
    "Auto Submitted",
    "Time Taken (min)",
    "Submitted At",
  ];

  const rows: string[][] = [];

  for (const student of eligibleStudents) {
    const attempt = attemptMap.get(student.id);

    if (!attempt) {
      rows.push([
        student.name, student.email, student.usn || "",
        student.department?.name || "", "ABSENT",
        "", "", "", "", "", "", "", "", "", "", "",
      ]);
    } else {
      const isSubmitted = attempt.status === "SUBMITTED" || attempt.status === "TIMED_OUT";
      let result = "";
      if (isSubmitted && test.passingMarks > 0 && attempt.score !== null) {
        result = attempt.score >= test.passingMarks ? "PASS" : "FAIL";
      }

      const timeTaken = attempt.timeTakenSeconds !== null
        ? (attempt.timeTakenSeconds / 60).toFixed(1) : "";

      rows.push([
        attempt.student.name, attempt.student.email,
        attempt.student.usn || "", attempt.student.department?.name || "",
        attempt.status,
        attempt.score !== null ? String(attempt.score) : "",
        attempt.totalMarks !== null ? String(attempt.totalMarks) : "",
        attempt.percentage !== null ? `${attempt.percentage.toFixed(1)}%` : "",
        result,
        String(attempt.totalViolations), String(attempt.tabSwitchCount),
        String(attempt.fullscreenExitCount), String(attempt.copyPasteAttempts),
        attempt.autoSubmitted ? "Yes" : "No", timeTaken,
        attempt.submittedAt
          ? format(new Date(attempt.submittedAt), "yyyy-MM-dd HH:mm:ss") : "",
      ]);

      attemptMap.delete(student.id);
    }
  }

  for (const [, attempt] of attemptMap) {
    const isSubmitted = attempt.status === "SUBMITTED" || attempt.status === "TIMED_OUT";
    let result = "";
    if (isSubmitted && test.passingMarks > 0 && attempt.score !== null) {
      result = attempt.score >= test.passingMarks ? "PASS" : "FAIL";
    }

    const timeTaken = attempt.timeTakenSeconds !== null
      ? (attempt.timeTakenSeconds / 60).toFixed(1) : "";

    rows.push([
      attempt.student.name, attempt.student.email,
      attempt.student.usn || "", attempt.student.department?.name || "",
      attempt.status,
      attempt.score !== null ? String(attempt.score) : "",
      attempt.totalMarks !== null ? String(attempt.totalMarks) : "",
      attempt.percentage !== null ? `${attempt.percentage.toFixed(1)}%` : "",
      result,
      String(attempt.totalViolations), String(attempt.tabSwitchCount),
      String(attempt.fullscreenExitCount), String(attempt.copyPasteAttempts),
      attempt.autoSubmitted ? "Yes" : "No", timeTaken,
      attempt.submittedAt
        ? format(new Date(attempt.submittedAt), "yyyy-MM-dd HH:mm:ss") : "",
    ]);
  }

  rows.sort((a, b) => {
    if (a[4] === "ABSENT" && b[4] !== "ABSENT") return 1;
    if (a[4] !== "ABSENT" && b[4] === "ABSENT") return -1;
    return a[0].localeCompare(b[0]);
  });

  // Compute summary
  const submittedAttempts = attempts.filter(
    (a) => a.status === "SUBMITTED" || a.status === "TIMED_OUT"
  );
  const scores = submittedAttempts
    .filter((a) => a.score !== null)
    .map((a) => a.score!);
  const passedCount = test.passingMarks > 0
    ? submittedAttempts.filter((a) => a.score !== null && a.score >= test.passingMarks).length
    : null;

  const summary: ReportSummary = {
    totalEligible: eligibleStudents.length,
    totalPresent: attempts.length,
    totalSubmitted: submittedAttempts.length,
    totalAbsent: Math.max(0, eligibleStudents.length - attempts.length),
    totalPassed: passedCount,
    totalFailed: passedCount !== null ? submittedAttempts.length - passedCount : null,
    highestScore: scores.length > 0 ? Math.max(...scores) : null,
    lowestScore: scores.length > 0 ? Math.min(...scores) : null,
    totalViolations: attempts.filter((a) => a.totalViolations > 0).length,
  };

  const csv = [
    `Test: ${test.title}`,
    `Drive: ${test.drive.title}`,
    `Total Marks: ${test.totalMarks}`,
    `Passing Marks: ${test.passingMarks}`,
    "",
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\n");

  const filename = `${test.title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_")}_report.csv`;

  return {
    csv,
    filename,
    summary,
    testTitle: test.title,
    driveTitle: test.drive.title,
  };
}
