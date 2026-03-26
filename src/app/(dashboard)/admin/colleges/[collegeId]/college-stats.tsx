"use client";

import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  GraduationCap,
  Building2,
  ClipboardList,
  Target,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface CollegeStatsData {
  students: number;
  collegeAdmins: number;
  departments: number;
  totalDrives: number;
  totalTests: number;
  totalAttempts: number;
  totalQuestions: number;
  drivesByStatus: Record<string, number>;
  testsByStatus: Record<string, number>;
  studentsByDepartment: { name: string; count: number }[];
  averageScore: number;
  completionRate: number;
  passRate: number;
}

const DRIVE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",
  UPCOMING: "#60a5fa",
  ACTIVE: "#34d399",
  COMPLETED: "#a78bfa",
  CANCELLED: "#f87171",
};

const TEST_STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",
  PUBLISHED: "#34d399",
  CLOSED: "#f87171",
};

const BAR_COLOR = "#6366f1";

export function CollegeStats({ collegeId }: { collegeId: string }) {
  const { data: stats, isLoading } = trpc.college.getStats.useQuery({ id: collegeId });

  if (isLoading) {
    return <StatsLoadingSkeleton />;
  }

  if (!stats) {
    return null;
  }

  const drivesPieData = Object.entries(stats.drivesByStatus)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const testsPieData = Object.entries(stats.testsByStatus)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      {/* Section A — Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<GraduationCap className="size-5 text-muted-foreground" />}
          label="Students"
          value={stats.students}
        />
        <SummaryCard
          icon={<Users className="size-5 text-muted-foreground" />}
          label="College Admins"
          value={stats.collegeAdmins}
        />
        <SummaryCard
          icon={<Building2 className="size-5 text-muted-foreground" />}
          label="Departments"
          value={stats.departments}
        />
        <SummaryCard
          icon={<ClipboardList className="size-5 text-muted-foreground" />}
          label="Total Attempts"
          value={stats.totalAttempts}
        />
      </div>

      {/* Section B — Performance Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <PerformanceCard
          icon={<Target className="size-5 text-muted-foreground" />}
          label="Average Score"
          value={stats.averageScore}
          suffix="%"
        />
        <PerformanceCard
          icon={<CheckCircle className="size-5 text-muted-foreground" />}
          label="Completion Rate"
          value={stats.completionRate}
          suffix="%"
        />
        <PerformanceCard
          icon={<TrendingUp className="size-5 text-muted-foreground" />}
          label="Pass Rate"
          value={stats.passRate}
          suffix="%"
        />
      </div>

      {/* Section C — Pie Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Drives by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {drivesPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={drivesPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {drivesPieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={DRIVE_STATUS_COLORS[entry.name] ?? "#8884d8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">
                No drives yet
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tests by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {testsPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={testsPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {testsPieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={TEST_STATUS_COLORS[entry.name] ?? "#8884d8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">
                No tests yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section D — Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Students by Department</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.studentsByDepartment.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.studentsByDepartment}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">
              No students assigned to departments
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function PerformanceCard({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-bold">
          {value}
          {suffix}
        </div>
        <Progress value={value} />
      </CardContent>
    </Card>
  );
}

function StatsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[250px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
