import { getServerTrpc } from "@/lib/trpc-server";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  ClipboardList,
  Users,
  CheckCircle,
  Plus,
  Upload,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { StatsCard } from "@/components/shared";

export default async function CollegeDashboardPage() {
  const trpc = await getServerTrpc();
  const stats = await trpc.stats.getDashboard();

  if (stats.role !== "COLLEGE_ADMIN") return null;

  const cards = [
    {
      title: "Total Drives",
      value: stats.totalDrives,
      icon: Briefcase,
      description: "Placement drives created",
      iconBg: "bg-amber-50 dark:bg-amber-500/20",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Total Tests",
      value: stats.totalTests,
      icon: ClipboardList,
      description: "Tests across all drives",
      iconBg: "bg-blue-50 dark:bg-blue-500/20",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Total Students",
      value: stats.totalStudents,
      icon: Users,
      description: "Registered students",
      iconBg: "bg-violet-50 dark:bg-violet-500/20",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      title: "Active Tests",
      value: stats.activeTests,
      icon: CheckCircle,
      description: "Published and available",
      iconBg: "bg-emerald-50 dark:bg-emerald-500/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          College Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your college placement activities.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((stat) => (
          <StatsCard key={stat.title} {...stat} />
        ))}
      </div>

      <div>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/college/drives/new">
              <Plus className="mr-2 size-4" aria-hidden="true" />
              Create Drive
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/college/students/upload">
              <Upload className="mr-2 size-4" aria-hidden="true" />
              Import Students
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/college/drives">
              <Briefcase className="mr-2 size-4" aria-hidden="true" />
              View Drives
              <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
