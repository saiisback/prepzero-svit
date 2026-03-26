import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import { buildEligibleStudentsWhere } from "@/lib/test-eligibility";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { RetakeButton } from "./retake-button";
import { format } from "date-fns";

const PAGE_SIZE = 20;

export default async function TestResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ driveId: string; testId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { driveId, testId } = await params;
  const { page: pageParam } = await searchParams;
  const session = await getSession();

  if (!session) redirect("/login");

  const user = session.user as {
    id: string;
    role: string;
    collegeId: string;
  };

  // Verify the test belongs to the college admin's college
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      drive: {
        select: { id: true, title: true, collegeId: true },
      },
    },
  });

  if (!test || test.drive.collegeId !== user.collegeId) {
    redirect("/college/drives");
  }

  const [attempts, eligibleStudents] = await Promise.all([
    prisma.testAttempt.findMany({
      where: { testId },
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: buildEligibleStudentsWhere(test, user.collegeId),
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const attemptStudentIds = new Set(attempts.map((a) => a.studentId));
  const absentStudents = eligibleStudents.filter(
    (s) => !attemptStudentIds.has(s.id)
  );

  // Combine all rows: attempts first, then absent students
  const allRows = [
    ...attempts.map((a) => ({ type: "attempt" as const, data: a })),
    ...absentStudents.map((s) => ({ type: "absent" as const, data: s })),
  ];

  const totalRows = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const currentPage = Math.max(1, Math.min(Number(pageParam) || 1, totalPages));
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageRows = allRows.slice(startIdx, startIdx + PAGE_SIZE);

  function formatDuration(seconds: number | null): string {
    if (!seconds) return "--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  const HEARTBEAT_TIMEOUT_MS = 30_000;
  const now = Date.now();

  function getDisplayStatus(attempt: { status: string; lastHeartbeat: Date | null }) {
    if (
      attempt.status === "IN_PROGRESS" &&
      attempt.lastHeartbeat &&
      now - new Date(attempt.lastHeartbeat).getTime() > HEARTBEAT_TIMEOUT_MS
    ) {
      return "LEFT";
    }
    return attempt.status;
  }

  function pageUrl(page: number) {
    if (page <= 1) return `?`;
    return `?page=${page}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href={`/college/drives/${driveId}/tests/${testId}`}>
            <ArrowLeft />
            Back to Test
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-balance">Test Results</h1>
        <p className="text-muted-foreground">
          Results for <span className="font-medium">{test.title}</span> in{" "}
          <span className="font-medium">{test.drive.title}</span>.
          {" "}
          <span className="text-xs">
            ({attempts.length} submitted, {absentStudents.length} absent)
          </span>
        </p>
      </div>

      <div className="rounded-lg border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead>Student Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead className="text-center">Total Marks</TableHead>
              <TableHead className="text-center">Percentage</TableHead>
              <TableHead>Time Taken</TableHead>
              <TableHead>Submitted At</TableHead>
              <TableHead className="text-center">Violations</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {totalRows === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={12}
                  className="h-24 text-center text-muted-foreground"
                >
                  No attempts yet. Students have not taken this test.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row, idx) => {
                if (row.type === "attempt") {
                  const attempt = row.data;
                  const passed =
                    test.passingMarks > 0 &&
                    attempt.score !== null &&
                    attempt.score >= test.passingMarks;
                  const failed =
                    test.passingMarks > 0 &&
                    attempt.score !== null &&
                    attempt.score < test.passingMarks;

                  return (
                    <TableRow key={attempt.id}>
                      <TableCell className="text-center text-muted-foreground tabular-nums text-xs">
                        {startIdx + idx + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={`/college/students/${attempt.student.id}`}
                          className="hover:underline text-primary"
                        >
                          {attempt.student.name}
                        </Link>
                      </TableCell>
                      <TableCell>{attempt.student.email}</TableCell>
                      <TableCell>
                        {(() => {
                          const displayStatus = getDisplayStatus(attempt);
                          return (
                            <Badge
                              variant={
                                displayStatus === "SUBMITTED"
                                  ? "default"
                                  : displayStatus === "TIMED_OUT" || displayStatus === "LEFT"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {displayStatus === "LEFT" ? "LEFT" : attempt.status}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {attempt.score !== null
                          ? attempt.score
                          : "--"}
                      </TableCell>
                      <TableCell className="text-center">
                        {attempt.totalMarks !== null
                          ? attempt.totalMarks
                          : "--"}
                      </TableCell>
                      <TableCell className="text-center">
                        {attempt.percentage !== null
                          ? `${attempt.percentage.toFixed(1)}%`
                          : "--"}
                      </TableCell>
                      <TableCell>
                        {formatDuration(attempt.timeTakenSeconds)}
                      </TableCell>
                      <TableCell>
                        {attempt.submittedAt
                          ? format(
                              new Date(attempt.submittedAt),
                              "MMM d, yyyy HH:mm"
                            )
                          : "--"}
                      </TableCell>
                      <TableCell className="text-center">
                        {attempt.totalViolations > 0 ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge
                                  variant="destructive"
                                  className="cursor-help"
                                >
                                  {attempt.totalViolations}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs space-y-1">
                                  <p>Tab switches: {attempt.tabSwitchCount}</p>
                                  <p>Fullscreen exits: {attempt.fullscreenExitCount}</p>
                                  <p>Copy/paste attempts: {attempt.copyPasteAttempts}</p>
                                  <p>Refreshes: {attempt.refreshCount}</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                        {attempt.autoSubmitted && (
                          <Badge variant="outline" className="ml-1 text-xs border-red-300 text-red-600">
                            Auto
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {attempt.status !== "SUBMITTED" &&
                        attempt.status !== "TIMED_OUT" ? (
                          <Badge variant="outline">Pending</Badge>
                        ) : passed ? (
                          <Badge variant="default">Pass</Badge>
                        ) : failed ? (
                          <Badge variant="destructive">Fail</Badge>
                        ) : (
                          <Badge variant="outline">N/A</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {(attempt.status === "SUBMITTED" ||
                            attempt.status === "TIMED_OUT") && (
                            <>
                              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                                <Link href={`/college/drives/${driveId}/tests/${testId}/results/${attempt.id}`}>
                                  <Eye className="size-3.5" />
                                  Answers
                                </Link>
                              </Button>
                              <RetakeButton
                                attemptId={attempt.id}
                                studentName={attempt.student.name}
                              />
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }

                // Absent student row
                const student = row.data;
                return (
                  <TableRow key={student.id} className="bg-muted/30">
                    <TableCell className="text-center text-muted-foreground tabular-nums text-xs">
                      {startIdx + idx + 1}
                    </TableCell>
                    <TableCell className="font-medium text-muted-foreground">
                      <Link
                        href={`/college/students/${student.id}`}
                        className="hover:underline"
                      >
                        {student.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-amber-300 text-amber-700"
                      >
                        ABSENT
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      --
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      --
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      --
                    </TableCell>
                    <TableCell className="text-muted-foreground">--</TableCell>
                    <TableCell className="text-muted-foreground">--</TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      --
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-amber-300 text-amber-700"
                      >
                        Absent
                      </Badge>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startIdx + 1}&ndash;{Math.min(startIdx + PAGE_SIZE, totalRows)} of{" "}
            {totalRows} results
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              asChild
              disabled={currentPage === 1}
            >
              {currentPage === 1 ? (
                <span><ChevronsLeft className="size-4" /></span>
              ) : (
                <Link href={pageUrl(1)}><ChevronsLeft className="size-4" /></Link>
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              asChild
              disabled={currentPage === 1}
            >
              {currentPage === 1 ? (
                <span><ChevronLeft className="size-4" /></span>
              ) : (
                <Link href={pageUrl(currentPage - 1)}><ChevronLeft className="size-4" /></Link>
              )}
            </Button>
            <span className="px-3 text-sm font-medium tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              asChild
              disabled={currentPage === totalPages}
            >
              {currentPage === totalPages ? (
                <span><ChevronRight className="size-4" /></span>
              ) : (
                <Link href={pageUrl(currentPage + 1)}><ChevronRight className="size-4" /></Link>
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              asChild
              disabled={currentPage === totalPages}
            >
              {currentPage === totalPages ? (
                <span><ChevronsRight className="size-4" /></span>
              ) : (
                <Link href={pageUrl(totalPages)}><ChevronsRight className="size-4" /></Link>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
