import { getServerTrpc } from "@/lib/trpc-server";
import { Button } from "@/components/ui/button";
import { Building2, Users, Briefcase, ClipboardList, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { StatsCard } from "@/components/shared";

export default async function AdminDashboardPage() {
  const trpc = await getServerTrpc();
  const stats = await trpc.stats.getDashboard();

  if (stats.role !== "SUPER_ADMIN") return null;

  const cards = [
    {
      title: "Total Colleges",
      value: stats.totalColleges,
      icon: Building2,
      description: "Registered institutions",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      description: "Students, admins & super admins",
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
    },
    {
      title: "Total Drives",
      value: stats.totalDrives,
      icon: Briefcase,
      description: "Placement drives across colleges",
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      title: "Total Tests",
      value: stats.totalTests,
      icon: ClipboardList,
      description: "Tests created across drives",
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening across your PrepZero platform.
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
            <Link href="/admin/colleges/new">
              <Plus className="mr-2 size-4" aria-hidden="true" />
              Add College
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/users">
              <Users className="mr-2 size-4" aria-hidden="true" />
              Manage Users
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/colleges">
              <Building2 className="mr-2 size-4" aria-hidden="true" />
              View Colleges
              <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
