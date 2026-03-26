import { getServerTrpc } from "@/lib/trpc-server";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  CheckCircle,
  TrendingUp,
  Clock,
  ArrowRight,
} from "lucide-react";
import { StatsCard } from "@/components/shared";

export default async function StudentDashboardPage() {
  const trpc = await getServerTrpc();
  const dashStats = await trpc.stats.getDashboard();

  if (dashStats.role !== "STUDENT") return null;

  // Fetch eligible tests (test.list already filters by eligibility for students)
  const allTests = await trpc.test.list();
  // Tests the student hasn't attempted yet
  const attempts = await trpc.attempt.list();
  const attemptedTestIds = new Set(attempts.map((a: { testId: string }) => a.testId));
  const upcomingTests = allTests
    .filter((t: { id: string }) => !attemptedTestIds.has(t.id))
    .slice(0, 5);

  const stats = [
    {
      title: "Available Tests",
      value: dashStats.availableTests,
      icon: ClipboardList,
      description: "Tests waiting for you",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      title: "Completed Tests",
      value: dashStats.completedTests,
      icon: CheckCircle,
      description: "Tests you have finished",
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      title: "Average Score",
      value: `${dashStats.averageScore}%`,
      icon: TrendingUp,
      description: dashStats.completedTests > 0
        ? `Across ${dashStats.completedTests} test${dashStats.completedTests !== 1 ? "s" : ""}`
        : "No tests completed yet",
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Student Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here is an overview of your test activity.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {stats.map((stat) => (
          <StatsCard key={stat.title} {...stat} />
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Upcoming Tests</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/student/tests">
              View All <ArrowRight className="ml-1 size-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {upcomingTests.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No tests available right now.
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingTests.map((test: any) => (
                <div
                  key={test.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium leading-none">
                      {test.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {test.drive?.title}
                      {test.drive?.companyName
                        ? `\u00a0\u2013\u00a0${test.drive.companyName}`
                        : ""}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3" aria-hidden="true" />
                      <span>{test.durationMinutes}&nbsp;min</span>
                      <span aria-hidden="true">&middot;</span>
                      <span>{test._count?.questions}&nbsp;questions</span>
                      <span aria-hidden="true">&middot;</span>
                      <span>{test.totalMarks}&nbsp;marks</span>
                    </div>
                  </div>
                  <Button size="sm" asChild className="ml-3 shrink-0">
                    <Link href={`/test/${test.id}/attempt`} aria-label={`Start test: ${test.title}`}>
                      Start
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
