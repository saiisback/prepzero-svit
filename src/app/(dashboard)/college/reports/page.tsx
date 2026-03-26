import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import { buildEligibleStudentsWhere } from "@/lib/test-eligibility";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReportTable, type TestReportData } from "./report-table";

export default async function ReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = session.user as { id: string; role: string; collegeId: string };
  const collegeId = user.collegeId;

  const tests = await prisma.test.findMany({
    where: {
      drive: { collegeId },
      status: "CLOSED",
    },
    include: {
      drive: { select: { id: true, title: true } },
      attempts: {
        include: {
          student: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const testReports: TestReportData[] = await Promise.all(
    tests.map(async (test) => {
      const eligibleWhere = buildEligibleStudentsWhere(test, collegeId);
      const eligibleStudents = await prisma.user.findMany({
        where: eligibleWhere,
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      });
      const eligibleCount = eligibleStudents.length;

      const attempts = test.attempts;
      const submittedAttempts = attempts.filter(
        (a) => a.status === "SUBMITTED" || a.status === "TIMED_OUT"
      );

      const passedCount =
        test.passingMarks > 0
          ? submittedAttempts.filter(
              (a) => a.score !== null && a.score >= test.passingMarks
            ).length
          : null;

      const scores = submittedAttempts
        .filter((a) => a.score !== null)
        .map((a) => a.score!);

      const highestScore = scores.length > 0 ? Math.max(...scores) : null;
      const lowestScore = scores.length > 0 ? Math.min(...scores) : null;

      const violationCount = attempts.filter(
        (a) => a.totalViolations > 0
      ).length;

      // Build student-level data
      const attemptStudentIds = new Set(attempts.map((a) => a.studentId));

      const students: TestReportData["students"] = [];

      // Present students (from attempts)
      for (const attempt of attempts) {
        students.push({
          name: attempt.student.name,
          email: attempt.student.email,
          status: attempt.status,
          score: attempt.score,
          totalMarks: attempt.totalMarks,
          percentage: attempt.percentage,
          totalViolations: attempt.totalViolations,
          autoSubmitted: attempt.autoSubmitted,
        });
      }

      // Absent students (eligible but no attempt)
      for (const s of eligibleStudents) {
        if (!attemptStudentIds.has(s.id)) {
          students.push({
            name: s.name,
            email: s.email,
            status: "ABSENT",
            score: null,
            totalMarks: null,
            percentage: null,
            totalViolations: 0,
            autoSubmitted: false,
          });
        }
      }

      return {
        id: test.id,
        title: test.title,
        driveTitle: test.drive.title,
        totalMarks: test.totalMarks,
        passingMarks: test.passingMarks,
        eligibleCount,
        presentCount: attempts.length,
        submittedCount: submittedAttempts.length,
        passedCount,
        failedCount:
          passedCount !== null ? submittedAttempts.length - passedCount : null,
        highestScore,
        lowestScore,
        violationCount,
        absentCount: Math.max(0, eligibleCount - attempts.length),
        students,
      };
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <Badge variant="secondary" className="tabular-nums">
          {testReports.length} completed
        </Badge>
      </div>

      {testReports.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center text-muted-foreground">
            No completed tests yet. Tests will appear here once they are closed.
          </CardContent>
        </Card>
      ) : (
        <ReportTable reports={testReports} />
      )}
    </div>
  );
}
