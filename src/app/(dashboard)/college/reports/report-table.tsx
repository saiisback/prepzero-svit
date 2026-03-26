"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Search,
  Trash2,
} from "lucide-react";
import { DownloadButton } from "./download-button";
import { EmailButton } from "./email-button";

interface StudentData {
  name: string;
  email: string;
  status: string;
  score: number | null;
  totalMarks: number | null;
  percentage: number | null;
  totalViolations: number;
  autoSubmitted: boolean;
}

export interface TestReportData {
  id: string;
  title: string;
  driveTitle: string;
  totalMarks: number;
  passingMarks: number;
  eligibleCount: number;
  presentCount: number;
  submittedCount: number;
  passedCount: number | null;
  failedCount: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  violationCount: number;
  absentCount: number;
  students: StudentData[];
}

const PAGE_SIZE = 10;

export function ReportTable({ reports }: { reports: TestReportData[] }) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [driveFilter, setDriveFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteMutation = trpc.test.delete.useMutation();

  // Unique drive names for filter dropdown
  const driveNames = Array.from(
    new Set(reports.map((r) => r.driveTitle))
  ).sort();

  // Apply search and filter
  const filteredReports = reports.filter((r) => {
    if (driveFilter !== "ALL" && r.driveTitle !== driveFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.driveTitle.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const paginatedReports = filteredReports.slice(startIdx, startIdx + PAGE_SIZE);

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function goToPage(page: number) {
    setCurrentPage(page);
    setExpandedId(null);
  }

  function handleSearch(value: string) {
    setSearch(value);
    setCurrentPage(1);
    setExpandedId(null);
  }

  function handleDriveFilter(value: string) {
    setDriveFilter(value);
    setCurrentPage(1);
    setExpandedId(null);
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    const pageIds = paginatedReports.map((r) => r.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function handleDeleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsDeleting(true);
    try {
      await Promise.all(ids.map((id) => deleteMutation.mutateAsync({ id })));
      toast.success(`${ids.length} report${ids.length !== 1 ? "s" : ""} deleted`);
      setSelectedIds(new Set());
      router.refresh();
    } catch {
      toast.error("Failed to delete some reports");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by test or drive name..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {driveNames.length > 1 && (
          <Select value={driveFilter} onValueChange={handleDriveFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by drive" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Drives</SelectItem>
              {driveNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {(search || driveFilter !== "ALL") && (
          <p className="text-sm text-muted-foreground">
            {filteredReports.length} result{filteredReports.length !== 1 ? "s" : ""}
          </p>
        )}
        {selectedIds.size > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="size-4" />
                Delete {selectedIds.size} Report{selectedIds.size !== 1 ? "s" : ""}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {selectedIds.size} Report{selectedIds.size !== 1 ? "s" : ""}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the selected test{selectedIds.size !== 1 ? "s" : ""} and all associated attempts, answers, and report data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Report cards */}
      {paginatedReports.length === 0 ? (
        <div className="rounded-lg border border-border py-12 text-center text-muted-foreground">
          No tests match your search.
        </div>
      ) : (
        <div className="flex items-center gap-2 px-1">
          <Checkbox
            checked={paginatedReports.length > 0 && paginatedReports.every((r) => selectedIds.has(r.id))}
            onCheckedChange={toggleAllOnPage}
          />
          <span className="text-xs text-muted-foreground">Select all on page</span>
        </div>
      )}

      {paginatedReports.map((report) => {
        const isExpanded = expandedId === report.id;

        return (
          <div
            key={report.id}
            className="rounded-lg border border-border shadow-sm overflow-hidden"
          >
            {/* Summary row */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggle(report.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(report.id); } }}
              className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-accent/40 transition-colors cursor-pointer"
            >
              <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                <Checkbox
                  checked={selectedIds.has(report.id)}
                  onCheckedChange={() => toggleSelection(report.id)}
                />
              </div>
              {isExpanded ? (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )}

              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{report.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {report.driveTitle}
                </p>
              </div>

              <div className="hidden md:flex items-center gap-3 text-xs shrink-0">
                <Stat label="Eligible" value={report.eligibleCount} />
                <Stat label="Present" value={report.presentCount} />
                <Stat label="Submitted" value={report.submittedCount} />
                <Stat
                  label="Absent"
                  value={report.absentCount}
                  warn={report.absentCount > 0}
                />
                {report.passedCount !== null ? (
                  <>
                    <Stat label="Passed" value={report.passedCount} />
                    <Stat
                      label="Failed"
                      value={report.failedCount ?? 0}
                      warn={(report.failedCount ?? 0) > 0}
                    />
                  </>
                ) : null}
                <Stat
                  label="Highest"
                  value={
                    report.highestScore !== null
                      ? `${report.highestScore}/${report.totalMarks}`
                      : "--"
                  }
                />
                <Stat
                  label="Lowest"
                  value={
                    report.lowestScore !== null
                      ? `${report.lowestScore}/${report.totalMarks}`
                      : "--"
                  }
                />
                {report.violationCount > 0 && (
                  <span className="text-red-600 font-medium">
                    {report.violationCount} violation
                    {report.violationCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 ml-2 flex items-center gap-2"
              >
                <DownloadButton
                  testId={report.id}
                  testTitle={report.title}
                />
                <EmailButton testId={report.id} />
              </div>
            </div>

            {/* Mobile stats (visible on small screens) */}
            {isExpanded && (
              <div className="md:hidden px-4 pb-3 flex flex-wrap gap-3 text-xs border-b">
                <Stat label="Eligible" value={report.eligibleCount} />
                <Stat label="Present" value={report.presentCount} />
                <Stat label="Submitted" value={report.submittedCount} />
                <Stat
                  label="Absent"
                  value={report.absentCount}
                  warn={report.absentCount > 0}
                />
                {report.passedCount !== null && (
                  <>
                    <Stat label="Passed" value={report.passedCount} />
                    <Stat
                      label="Failed"
                      value={report.failedCount ?? 0}
                      warn={(report.failedCount ?? 0) > 0}
                    />
                  </>
                )}
                <Stat
                  label="Highest"
                  value={
                    report.highestScore !== null
                      ? `${report.highestScore}/${report.totalMarks}`
                      : "--"
                  }
                />
                <Stat
                  label="Lowest"
                  value={
                    report.lowestScore !== null
                      ? `${report.lowestScore}/${report.totalMarks}`
                      : "--"
                  }
                />
              </div>
            )}

            {/* Expanded student table */}
            {isExpanded && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead className="text-center">
                        Total Marks
                      </TableHead>
                      <TableHead className="text-center">Percentage</TableHead>
                      <TableHead className="text-center">Result</TableHead>
                      <TableHead className="text-center">Violations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.students.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="h-16 text-center text-muted-foreground"
                        >
                          No eligible students found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.students.map((student, i) => {
                        const isAbsent = student.status === "ABSENT";
                        const isSubmitted =
                          student.status === "SUBMITTED" ||
                          student.status === "TIMED_OUT";

                        let result: "PASS" | "FAIL" | null = null;
                        if (
                          isSubmitted &&
                          report.passingMarks > 0 &&
                          student.score !== null
                        ) {
                          result =
                            student.score >= report.passingMarks
                              ? "PASS"
                              : "FAIL";
                        }

                        return (
                          <TableRow
                            key={i}
                            className={isAbsent ? "bg-muted/30" : undefined}
                          >
                            <TableCell
                              className={`font-medium ${isAbsent ? "text-muted-foreground" : ""}`}
                            >
                              {student.name}
                            </TableCell>
                            <TableCell
                              className={
                                isAbsent ? "text-muted-foreground" : ""
                              }
                            >
                              {student.email}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  isAbsent
                                    ? "outline"
                                    : student.status === "SUBMITTED"
                                      ? "default"
                                      : student.status === "TIMED_OUT"
                                        ? "destructive"
                                        : "secondary"
                                }
                                className={
                                  isAbsent
                                    ? "border-amber-300 text-amber-700"
                                    : ""
                                }
                              >
                                {student.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {student.score !== null ? student.score : "--"}
                            </TableCell>
                            <TableCell className="text-center">
                              {student.totalMarks !== null
                                ? student.totalMarks
                                : "--"}
                            </TableCell>
                            <TableCell className="text-center">
                              {student.percentage !== null
                                ? `${student.percentage.toFixed(1)}%`
                                : "--"}
                            </TableCell>
                            <TableCell className="text-center">
                              {isAbsent ? (
                                <Badge
                                  variant="outline"
                                  className="border-amber-300 text-amber-700"
                                >
                                  Absent
                                </Badge>
                              ) : result === "PASS" ? (
                                <Badge variant="default">Pass</Badge>
                              ) : result === "FAIL" ? (
                                <Badge variant="destructive">Fail</Badge>
                              ) : !isSubmitted ? (
                                <Badge variant="outline">Pending</Badge>
                              ) : (
                                <Badge variant="outline">N/A</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {student.totalViolations > 0 ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge
                                        variant="destructive"
                                        className="cursor-help"
                                      >
                                        {student.totalViolations}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {student.autoSubmitted
                                        ? "Auto-submitted due to violations"
                                        : "Proctoring violations detected"}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : isAbsent ? (
                                <span className="text-muted-foreground">
                                  --
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  0
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Showing {startIdx + 1}&ndash;
            {Math.min(startIdx + PAGE_SIZE, filteredReports.length)} of{" "}
            {filteredReports.length} tests
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => goToPage(1)}
              disabled={safePage === 1}
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage === 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-3 text-sm font-medium tabular-nums">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage === totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => goToPage(totalPages)}
              disabled={safePage === totalPages}
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <span className={warn ? "text-amber-700 font-medium" : ""}>
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="font-medium">{value}</span>
    </span>
  );
}
