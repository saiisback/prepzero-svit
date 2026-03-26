"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Users,
  Clock,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  LogOut,
} from "lucide-react";

type StudentStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "TIMED_OUT" | "LEFT";

const statusBadge: Record<
  StudentStatus,
  { label: string; variant: "outline" | "secondary" | "default" | "destructive" }
> = {
  NOT_STARTED: { label: "Absent", variant: "outline" },
  IN_PROGRESS: { label: "In Progress", variant: "secondary" },
  SUBMITTED: { label: "Submitted", variant: "default" },
  TIMED_OUT: { label: "Timed Out", variant: "destructive" },
  LEFT: { label: "Left", variant: "destructive" },
};

export default function TestMonitorPage() {
  const params = useParams<{ driveId: string; testId: string }>();

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const { data, isLoading, dataUpdatedAt, refetch } =
    trpc.test.monitor.useQuery(
      { testId: params.testId },
      { refetchInterval: autoRefresh ? 10000 : false }
    );

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { test, summary } = data;

  // Client-side filtering
  const filteredStudents = data.students.filter((s) => {
    if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.usn && s.usn.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const participationPercent =
    summary.totalStudents > 0
      ? Math.round(
          ((summary.totalStudents - summary.notStarted) /
            summary.totalStudents) *
            100
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link
            href={`/college/drives/${params.driveId}/tests/${params.testId}`}
          >
            <ArrowLeft />
            Back to Test
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-balance">Live Monitor</h1>
        <p className="text-muted-foreground">
          {test.title} &mdash; {test.drive.title}
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id="auto-refresh"
            checked={autoRefresh}
            onCheckedChange={setAutoRefresh}
          />
          <label htmlFor="auto-refresh" className="text-sm">
            Auto-refresh
          </label>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="size-4" />
          Refresh Now
        </Button>
        {lastUpdated && (
          <span className="text-xs text-muted-foreground">
            Last updated: {format(lastUpdated, "hh:mm:ss a")}
          </span>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Students
            </CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalStudents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Absent</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.notStarted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <PlayCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Left</CardTitle>
            <LogOut className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{summary.left}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Submitted</CardTitle>
            <CheckCircle2 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.submitted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Timed Out</CardTitle>
            <AlertTriangle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.timedOut}</div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Participation</span>
          <span className="font-medium">{participationPercent}%</span>
        </div>
        <Progress value={participationPercent} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="NOT_STARTED">Absent</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="LEFT">Left</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="TIMED_OUT">Timed Out</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Search by name or USN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Student Table */}
      <div className="rounded-lg border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>USN</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started At</TableHead>
              <TableHead>Submitted At</TableHead>
              <TableHead className="text-center">Violations</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No students found.
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((student) => {
                const badge = statusBadge[student.status as StudentStatus];
                return (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {student.name}
                    </TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell>{student.usn ?? "—"}</TableCell>
                    <TableCell>{student.department ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {student.startedAt
                        ? format(new Date(student.startedAt), "hh:mm:ss a")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {student.submittedAt
                        ? format(new Date(student.submittedAt), "hh:mm:ss a")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {student.totalViolations > 0 ? (
                        <Badge variant="destructive">
                          {student.totalViolations}
                        </Badge>
                      ) : (
                        "0"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
