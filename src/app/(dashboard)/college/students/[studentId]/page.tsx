import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Trophy,
  TrendingUp,
  Target,
  Clock,
  BookOpen,
  GraduationCap,
  Mail,
  Hash,
  Building2,
  ShieldAlert,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "N/A";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const user = session.user as {
    id: string;
    role: string;
    collegeId: string;
  };

  if (user.role !== "COLLEGE_ADMIN" && user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    include: {
      department: { select: { name: true } },
      college: { select: { id: true, name: true } },
    },
  });

  if (!student || student.role !== "STUDENT") notFound();

  // College admin can only view students from their own college
  if (user.role === "COLLEGE_ADMIN" && student.collegeId !== user.collegeId) {
    redirect("/college/students");
  }

  const attempts = await prisma.testAttempt.findMany({
    where: {
      studentId,
      status: { in: ["SUBMITTED", "TIMED_OUT"] },
    },
    include: {
      test: {
        include: {
          drive: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  // Analytics
  const totalTests = attempts.length;
  const totalScore = attempts.reduce((sum, a) => sum + (a.score ?? 0), 0);
  const totalMaxMarks = attempts.reduce((sum, a) => sum + (a.totalMarks ?? 0), 0);
  const avgPercentage =
    totalTests > 0
      ? Math.round(
          attempts.reduce((sum, a) => sum + (a.percentage ?? 0), 0) / totalTests
        )
      : 0;
  const passedCount = attempts.filter(
    (a) => a.test.passingMarks > 0 && (a.score ?? 0) >= a.test.passingMarks
  ).length;
  const passRate =
    totalTests > 0 ? Math.round((passedCount / totalTests) * 100) : 0;
  const totalViolations = attempts.reduce(
    (sum, a) => sum + a.totalViolations,
    0
  );
  const avgTimeSecs =
    totalTests > 0
      ? Math.round(
          attempts.reduce((sum, a) => sum + (a.timeTakenSeconds ?? 0), 0) /
            totalTests
        )
      : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="mt-0.5 size-8 shrink-0" asChild>
          <Link href="/college/students">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight truncate">
            {student.name}
          </h1>
          <p className="text-sm text-muted-foreground">Student Profile</p>
        </div>
      </div>

      {/* Student Info */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-card px-5 py-3 text-sm">
        <div className="flex items-center gap-1.5">
          <Mail className="size-3.5 text-muted-foreground" />
          <span>{student.email}</span>
        </div>
        {student.usn && (
          <div className="flex items-center gap-1.5">
            <Hash className="size-3.5 text-muted-foreground" />
            <span className="font-mono text-xs">{student.usn}</span>
          </div>
        )}
        {student.department && (
          <div className="flex items-center gap-1.5">
            <Building2 className="size-3.5 text-muted-foreground" />
            <span>{student.department.name}</span>
          </div>
        )}
        {student.semester && (
          <div className="flex items-center gap-1.5">
            <GraduationCap className="size-3.5 text-muted-foreground" />
            <span>Semester {student.semester}</span>
          </div>
        )}
        {student.isGraduated && (
          <Badge variant="outline" className="border-emerald-300 text-emerald-600 text-xs">
            Graduated
          </Badge>
        )}
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center size-7 rounded-lg bg-blue-500/10">
              <BookOpen className="size-3.5 text-blue-500" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Tests</span>
          </div>
          <span className="text-2xl font-bold tabular-nums">{totalTests}</span>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center size-7 rounded-lg bg-amber-500/10">
              <Trophy className="size-3.5 text-amber-500" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Total Score</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums">{totalScore}</span>
            <span className="text-sm text-muted-foreground">/ {totalMaxMarks}</span>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center size-7 rounded-lg bg-indigo-500/10">
              <TrendingUp className="size-3.5 text-indigo-500" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Avg %</span>
          </div>
          <span className="text-2xl font-bold tabular-nums">{avgPercentage}%</span>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center size-7 rounded-lg bg-emerald-500/10">
              <Target className="size-3.5 text-emerald-500" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Pass Rate</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums">{passRate}%</span>
            <span className="text-xs text-muted-foreground">({passedCount}/{totalTests})</span>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center size-7 rounded-lg bg-violet-500/10">
              <Clock className="size-3.5 text-violet-500" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Avg Time</span>
          </div>
          <span className="text-2xl font-bold tabular-nums">
            {formatDuration(avgTimeSecs)}
          </span>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className={cn(
              "flex items-center justify-center size-7 rounded-lg",
              totalViolations > 0 ? "bg-red-500/10" : "bg-muted"
            )}>
              <ShieldAlert className={cn(
                "size-3.5",
                totalViolations > 0 ? "text-red-500" : "text-muted-foreground"
              )} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Violations</span>
          </div>
          <span className={cn(
            "text-2xl font-bold tabular-nums",
            totalViolations > 0 && "text-red-600 dark:text-red-400"
          )}>
            {totalViolations}
          </span>
        </div>
      </div>

      {/* Test History */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Test History
        </h2>
        {attempts.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            No tests taken yet.
          </div>
        ) : (
          <div className="rounded-lg border border-border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test</TableHead>
                  <TableHead>Drive</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Percentage</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-center">Violations</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((attempt) => {
                  const passed =
                    attempt.test.passingMarks > 0 &&
                    (attempt.score ?? 0) >= attempt.test.passingMarks;
                  const failed =
                    attempt.test.passingMarks > 0 &&
                    (attempt.score ?? 0) < attempt.test.passingMarks;

                  return (
                    <TableRow key={attempt.id}>
                      <TableCell className="font-medium">
                        {attempt.test.title}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {attempt.test.drive.title}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {attempt.score ?? 0} / {attempt.totalMarks ?? 0}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {attempt.percentage !== null
                          ? `${Math.round(attempt.percentage)}%`
                          : "--"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDuration(attempt.timeTakenSeconds)}
                      </TableCell>
                      <TableCell className="text-center">
                        {attempt.totalViolations > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            {attempt.totalViolations}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {passed ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-800 text-xs">
                            Pass
                          </Badge>
                        ) : failed ? (
                          <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800 text-xs">
                            Fail
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">N/A</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {attempt.submittedAt
                          ? format(attempt.submittedAt, "MMM d, yyyy")
                          : "--"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                          <Link
                            href={`/college/drives/${attempt.test.drive.id}/tests/${attempt.testId}/results/${attempt.id}`}
                          >
                            View Answers
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
