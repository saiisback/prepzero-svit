import { getServerTrpc } from "@/lib/trpc-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  ChevronRight,
  Clock,
  Trophy,
  AlertTriangle,
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

export default async function StudentResultsPage() {
  const trpc = await getServerTrpc();

  const allAttempts = await trpc.attempt.list();

  // Filter to only completed attempts
  const completedAttempts = allAttempts.filter(
    (a) => a.status === "SUBMITTED" || a.status === "TIMED_OUT"
  );

  // Filter out attempts where results haven't been released yet
  const visibleAttempts = completedAttempts.filter(
    (a) =>
      a.test.resultVisibility !== "MANUAL_RELEASE" || a.test.showResults
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Results</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your completed test scores and performance.
        </p>
      </div>

      {visibleAttempts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <div className="flex items-center justify-center size-12 rounded-xl bg-muted mb-4">
            <FileText className="size-5 text-muted-foreground" />
          </div>
          <p className="font-medium">No results yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Complete a test to see your results here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleAttempts.map((attempt) => {
            const passed =
              attempt.test.passingMarks > 0 &&
              (attempt.score ?? 0) >= attempt.test.passingMarks;
            const failed =
              attempt.test.passingMarks > 0 &&
              (attempt.score ?? 0) < attempt.test.passingMarks;
            const percentage =
              attempt.percentage !== null
                ? Math.round(attempt.percentage)
                : null;
            const timedOut = attempt.status === "TIMED_OUT";

            return (
              <Link
                key={attempt.id}
                href={`/student/results/${attempt.id}`}
                className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50"
              >
                {/* Score circle */}
                <div
                  className={cn(
                    "flex items-center justify-center size-12 rounded-xl shrink-0 font-bold text-sm tabular-nums",
                    passed
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : failed
                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {percentage !== null ? `${percentage}%` : "\u2014"}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm truncate">
                      {attempt.test.title}
                    </span>
                    {passed && (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-800 text-[10px] px-1.5 py-0">
                        Passed
                      </Badge>
                    )}
                    {failed && (
                      <Badge className="bg-red-500/10 text-red-600 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800 text-[10px] px-1.5 py-0">
                        Failed
                      </Badge>
                    )}
                    {timedOut && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800">
                        <AlertTriangle className="size-2.5 mr-0.5" />
                        Timed Out
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="truncate">
                      {attempt.test.drive.title}
                      {attempt.test.drive.companyName
                        ? ` \u00b7 ${attempt.test.drive.companyName}`
                        : ""}
                    </span>
                  </div>
                </div>

                {/* Right side stats */}
                <div className="hidden sm:flex items-center gap-5 shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                      <Trophy className="size-3" />
                      Score
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {attempt.score ?? 0}
                      <span className="text-muted-foreground font-normal">
                        /{attempt.test.totalMarks}
                      </span>
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                      <Clock className="size-3" />
                      Time
                    </div>
                    <span className="text-sm tabular-nums">
                      {formatDuration(attempt.timeTakenSeconds)}
                    </span>
                  </div>
                  <div className="text-right min-w-[80px]">
                    <div className="text-xs text-muted-foreground mb-0.5">Date</div>
                    <span className="text-sm tabular-nums">
                      {attempt.submittedAt
                        ? format(new Date(attempt.submittedAt), "MMM d, yyyy")
                        : "N/A"}
                    </span>
                  </div>
                </div>

                <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
