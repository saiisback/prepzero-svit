import { getServerTrpc } from "@/lib/trpc-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  Clock,
  Play,
  RotateCcw,
  CheckCircle,
  HelpCircle,
  Building2,
  ArrowRight,
  LockKeyhole,
  CalendarClock,
} from "lucide-react";

const statusConfig = {
  completed: {
    label: "Completed",
    dotClass: "bg-emerald-500",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/50",
    textClass: "text-emerald-700 dark:text-emerald-400",
  },
  in_progress: {
    label: "In Progress",
    dotClass: "bg-amber-500",
    bgClass: "bg-amber-50 dark:bg-amber-950/50",
    textClass: "text-amber-700 dark:text-amber-400",
  },
  not_started: {
    label: "Not Started",
    dotClass: "bg-gray-400",
    bgClass: "bg-gray-100 dark:bg-gray-800/50",
    textClass: "text-gray-600 dark:text-gray-400",
  },
} as const;

function TestStatusPill({ status }: { status: keyof typeof statusConfig }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.bgClass,
        config.textClass
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dotClass)} aria-hidden="true" />
      {config.label}
    </span>
  );
}

export default async function StudentTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ driveId?: string }>;
}) {
  const trpc = await getServerTrpc();
  const { driveId } = await searchParams;

  // Fetch tests (already filtered by eligibility for students) and attempts in parallel
  const [tests, attempts] = await Promise.all([
    trpc.test.list(driveId ? { driveId } : undefined),
    trpc.attempt.list(),
  ]);

  // Build attempt lookup by testId
  const attemptByTestId = new Map(
    attempts.map((a) => [a.test.id, a])
  );

  // Get drive title if filtering by driveId
  let driveTitle: string | null = null;
  if (driveId) {
    try {
      const drive = await trpc.drive.getById({ id: driveId });
      driveTitle = drive.title;
    } catch {
      driveTitle = null;
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {driveTitle ? `Tests \u2013 ${driveTitle}` : "Available Tests"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {driveTitle
            ? "Tests for this placement drive."
            : "All published tests available for you."}
        </p>
        {driveId && (
          <Button variant="link" size="sm" asChild className="px-0 mt-1 h-auto">
            <Link href="/student/tests">View all tests</Link>
          </Button>
        )}
      </div>

      {tests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <div className="rounded-full bg-muted p-4">
              <ClipboardList className="size-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium">No tests available</p>
              <p className="text-sm text-muted-foreground">
                There are no published tests at the moment.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tests.map((test) => {
            const attempt = attemptByTestId.get(test.id) ?? null;
            const isInProgress = attempt?.status === "IN_PROGRESS";
            const isCompleted =
              attempt?.status === "SUBMITTED" ||
              attempt?.status === "TIMED_OUT";
            const testStatus: keyof typeof statusConfig = isCompleted
              ? "completed"
              : isInProgress
                ? "in_progress"
                : "not_started";

            return (
              <Card
                key={test.id}
                className="shadow-sm transition-[shadow,background-color] duration-200 hover:shadow-md hover:bg-accent/30"
              >
                <CardContent className="p-5 flex flex-col gap-4">
                  {/* Header: title + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium leading-snug">
                        {test.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="size-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {test.drive.title}
                          {test.drive.companyName ? ` \u2013 ${test.drive.companyName}` : ""}
                        </span>
                      </div>
                    </div>
                    <TestStatusPill status={testStatus} />
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3 shrink-0" aria-hidden="true" />
                      <span className="tabular-nums">{test.durationMinutes} min</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <HelpCircle className="size-3 shrink-0" aria-hidden="true" />
                      <span className="tabular-nums">{test._count.questions} {test._count.questions === 1 ? "question" : "questions"}</span>
                    </div>
                    <span className="tabular-nums">{test.totalMarks} marks</span>
                  </div>

                  {/* Start time */}
                  {test.startTime && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="size-3 shrink-0" aria-hidden="true" />
                      <span>
                        Starts: {new Date(test.startTime).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Asia/Kolkata",
                        })}
                      </span>
                    </div>
                  )}

                  {/* Action */}
                  {isCompleted ? (
                    test.resultVisibility === "MANUAL_RELEASE" && !test.showResults ? (
                      <Button variant="outline" size="sm" disabled className="w-full">
                        <LockKeyhole className="size-4 mr-2" aria-hidden="true" />
                        Results Pending
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" asChild className="w-full">
                        <Link href={`/student/results/${attempt!.id}`}>
                          <CheckCircle className="size-4 mr-2" aria-hidden="true" />
                          View Result
                          <ArrowRight className="size-4 ml-auto" aria-hidden="true" />
                        </Link>
                      </Button>
                    )
                  ) : isInProgress ? (
                    <Button variant="secondary" size="sm" asChild className="w-full">
                      <Link href={`/test/${test.id}/attempt`}>
                        <RotateCcw className="size-4 mr-2" aria-hidden="true" />
                        Continue Test
                        <ArrowRight className="size-4 ml-auto" aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : (
                    <Button size="sm" asChild className="w-full">
                      <Link href={`/test/${test.id}/attempt`}>
                        <Play className="size-4 mr-2" aria-hidden="true" />
                        Start Test
                        <ArrowRight className="size-4 ml-auto" aria-hidden="true" />
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
