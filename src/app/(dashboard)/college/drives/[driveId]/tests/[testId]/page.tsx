"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Clock, Loader2, Plus, Trash2, BarChart3, Upload, Eye, X, Search, Users, BookOpen, FileUp, Pencil, Download, ChevronDown, ShieldAlert } from "lucide-react";
import { parseCSV, parseEligibilityCSV, generateCSVTemplate } from "@/lib/csv-parser";
import { fileToCSVText } from "@/lib/spreadsheet";

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function formatEndTime(startLocal: string, durationMins: number): string | null {
  if (!startLocal || durationMins <= 0) return null;
  const end = new Date(new Date(startLocal).getTime() + durationMins * 60000);
  return end.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface StudentSearchResult {
  id: string;
  name: string;
  usn: string | null;
  department: { name: string } | null;
}

interface QuestionData {
  id: string;
  questionText: string;
  codeBlock?: string | null;
  codeLanguage?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  questionType: string;
  marks: number;
  order: number;
  options: { id: string; text: string }[];
  correctOptionIds: string[];
}

const testStatusVariant: Record<string, "default" | "secondary" | "outline"> = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  CLOSED: "outline",
};

export default function TestDetailPage() {
  const params = useParams<{ driveId: string; testId: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [passingMarks, setPassingMarks] = useState(0);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [status, setStatus] = useState("DRAFT");
  const [startTime, setStartTime] = useState("");
  const [resultVisibility, setResultVisibility] = useState("AFTER_SUBMISSION");
  const [showResults, setShowResults] = useState(false);
  const [isTogglingResults, setIsTogglingResults] = useState(false);
  const [maxViolations, setMaxViolations] = useState(5);
  const [enableTabSwitch, setEnableTabSwitch] = useState(true);
  const [enableFullscreen, setEnableFullscreen] = useState(true);
  const [enableCopyPaste, setEnableCopyPaste] = useState(true);
  const [enableRefresh, setEnableRefresh] = useState(true);

  const computedEndTime = formatEndTime(startTime, durationMinutes);

  // Eligibility state
  const [allowedDepartmentIds, setAllowedDepartmentIds] = useState<string[]>([]);
  const [allowedSemesters, setAllowedSemesters] = useState<number[]>([]);
  const [allowedStudentIds, setAllowedStudentIds] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<StudentSearchResult[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [isProcessingCSV, setIsProcessingCSV] = useState(false);
  const [csvResult, setCsvResult] = useState<{
    added: number;
    created: number;
    existing: number;
    alreadySelected: number;
    errors: string[];
    parseErrors: string[];
  } | null>(null);

  // tRPC queries
  const testQuery = trpc.test.getById.useQuery(
    { id: params.testId },
    {
      onError: (err: { message: string }) => {
        toast.error(err.message || "Failed to load test");
        router.push(`/college/drives/${params.driveId}`);
      },
    } as never
  );

  const questionsQuery = trpc.question.list.useQuery(
    { testId: params.testId },
    {
      onError: (err: { message: string }) => {
        toast.error(err.message || "Failed to load questions");
      },
    } as never
  );

  const departmentsQuery = trpc.department.list.useQuery(undefined, {
    onError: (err: { message: string }) => {
      toast.error(err.message || "Failed to load departments");
    },
  } as never);

  const test = testQuery.data ?? null;
  const questions: QuestionData[] = (questionsQuery.data as unknown as QuestionData[] | undefined) ?? [];
  const departments = departmentsQuery.data ?? [];
  const isLoading = testQuery.isLoading;

  // Sync form state when test data loads
  useEffect(() => {
    if (test) {
      setTitle(test.title);
      setDescription(test.description || "");
      setInstructions(test.instructions || "");
      setDurationMinutes(test.durationMinutes);
      setPassingMarks(test.passingMarks);
      setShuffleQuestions(test.shuffleQuestions);
      setStatus(test.status);
      setStartTime(test.startTime ? toDatetimeLocal(test.startTime as unknown as string) : "");
      setResultVisibility(test.resultVisibility || "AFTER_SUBMISSION");
      setShowResults(test.showResults ?? false);
      setMaxViolations(test.maxViolations ?? 5);
      setEnableTabSwitch(test.enableTabSwitchDetection ?? true);
      setEnableFullscreen(test.enableFullscreenDetection ?? true);
      setEnableCopyPaste(test.enableCopyPasteDetection ?? true);
      setEnableRefresh(test.enableRefreshDetection ?? true);

      // Initialize eligibility state
      setAllowedDepartmentIds((test.allowedDepartmentIds as string[] | null) ?? []);
      setAllowedSemesters((test.allowedSemesters as number[] | null) ?? []);
      const studentIds = (test.allowedStudentIds as string[] | null) ?? [];
      setAllowedStudentIds(studentIds);

      // Fetch details for pre-selected students
      if (studentIds.length > 0) {
        fetch(`/api/students?limit=1000`)
          .then((res) => res.ok ? res.json() : null)
          .then((data) => {
            if (data) {
              const allStudents: StudentSearchResult[] = data.students ?? [];
              setSelectedStudents(
                allStudents.filter((s) => studentIds.includes(s.id))
              );
            }
          })
          .catch(() => {});
      }
    }
  }, [test]);

  // tRPC mutations
  // @ts-expect-error -- tRPC deep type instantiation
  const updateTest = trpc.test.update.useMutation({
    onSuccess: () => {
      toast.success("Test updated successfully");
      utils.test.getById.invalidate({ id: params.testId });
      utils.test.list.invalidate({ driveId: params.driveId });
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong");
    },
  });

  const deleteQuestion = trpc.question.delete.useMutation({
    onSuccess: () => {
      toast.success("Question deleted successfully");
      utils.question.list.invalidate({ testId: params.testId });
      setDeletingId(null);
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong");
      setDeletingId(null);
    },
  });

  const deleteTestMutation = trpc.test.delete.useMutation({
    onSuccess: () => {
      toast.success("Test deleted successfully");
      utils.test.list.invalidate({ driveId: params.driveId });
      router.push(`/college/drives/${params.driveId}`);
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong");
    },
  });

  const toggleResultsMutation = trpc.test.update.useMutation({
    onSuccess: () => {
      setShowResults(!showResults);
      toast.success(
        showResults
          ? "Results hidden from students"
          : "Results released to students"
      );
      setIsTogglingResults(false);
      utils.test.getById.invalidate({ id: params.testId });
    },
    onError: () => {
      toast.error("Failed to toggle result visibility");
      setIsTogglingResults(false);
    },
  });

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateTest.mutate({
      id: params.testId,
      title,
      description: description || undefined,
      instructions: instructions || undefined,
      durationMinutes,
      passingMarks,
      shuffleQuestions,
      status: status as "DRAFT" | "PUBLISHED" | "CLOSED",
      startTime: startTime ? new Date(startTime).toISOString() : null,
      endTime: startTime
        ? new Date(new Date(startTime).getTime() + durationMinutes * 60000).toISOString()
        : null,
      resultVisibility: resultVisibility as "AFTER_SUBMISSION" | "MANUAL_RELEASE",
      showResults,
      maxViolations,
      enableTabSwitchDetection: enableTabSwitch,
      enableFullscreenDetection: enableFullscreen,
      enableCopyPasteDetection: enableCopyPaste,
      enableRefreshDetection: enableRefresh,
      allowedDepartmentIds: allowedDepartmentIds.length > 0 ? allowedDepartmentIds : null,
      allowedSemesters: allowedSemesters.length > 0 ? allowedSemesters : null,
      allowedStudentIds: allowedStudentIds.length > 0 ? allowedStudentIds : null,
    });
  }

  function handleDeleteQuestion(questionId: string) {
    setDeletingId(questionId);
    deleteQuestion.mutate({ id: questionId, testId: params.testId });
  }

  function handleDeleteTest() {
    deleteTestMutation.mutate({ id: params.testId });
  }

  // Debounced student search (still uses fetch since student search with query params isn't a simple tRPC query)
  const searchStudents = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/students?search=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data: StudentSearchResult[] = await res.json();
        // Exclude already-selected students
        setSearchResults(data.filter((s) => !allowedStudentIds.includes(s.id)));
      }
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  }, [allowedStudentIds]);

  useEffect(() => {
    const timer = setTimeout(() => searchStudents(studentSearch), 300);
    return () => clearTimeout(timer);
  }, [studentSearch, searchStudents]);

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingCSV(true);
    setCsvResult(null);

    try {
      const text = await fileToCSVText(file);
      const { students: parsedStudents, errors: parseErrors } = parseEligibilityCSV(text);

      if (parsedStudents.length === 0) {
        setCsvResult({ added: 0, created: 0, existing: 0, alreadySelected: 0, errors: [], parseErrors });
        return;
      }

      const res = await fetch("/api/students/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: parsedStudents }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to process students");
      }

      const data = await res.json();
      const { found, created, existing, errors: apiErrors } = data;

      const existingIds = new Set(allowedStudentIds);
      let alreadySelected = 0;
      const newStudents: StudentSearchResult[] = [];

      for (const student of found) {
        if (existingIds.has(student.id)) {
          alreadySelected++;
        } else {
          newStudents.push({
            id: student.id,
            name: student.name,
            usn: student.usn,
            department: student.department,
          });
        }
      }

      if (newStudents.length > 0) {
        const updatedIds = [...allowedStudentIds, ...newStudents.map((s) => s.id)];
        setAllowedStudentIds(updatedIds);
        setSelectedStudents((prev) => [...prev, ...newStudents]);

        // Auto-save eligibility so it persists when navigating away
        updateTest.mutate({
          id: params.testId,
          allowedStudentIds: updatedIds,
          allowedDepartmentIds: allowedDepartmentIds.length > 0 ? allowedDepartmentIds : null,
          allowedSemesters: allowedSemesters.length > 0 ? allowedSemesters : null,
        });
      }

      setCsvResult({
        added: newStudents.length,
        created,
        existing,
        alreadySelected,
        errors: apiErrors || [],
        parseErrors,
      });

      if (newStudents.length > 0) {
        toast.success(`${newStudents.length} student${newStudents.length !== 1 ? "s" : ""} added to eligibility (${created} newly created)`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process CSV");
    } finally {
      setIsProcessingCSV(false);
      e.target.value = "";
    }
  }

  // Fetch eligible count when eligibility criteria change
  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch(`/api/students?limit=1000`);
        if (!res.ok) return;
        const data = await res.json();
        const allStudents: { id: string; department: { id: string } | null; semester: number | null }[] = data.students ?? [];

        const deptIds = allowedDepartmentIds;
        const sems = allowedSemesters;
        const stuIds = allowedStudentIds;

        if (deptIds.length === 0 && sems.length === 0 && stuIds.length === 0) {
          setEligibleCount(data.total ?? allStudents.length);
          return;
        }

        const count = allStudents.filter((s) => {
          if (stuIds.includes(s.id)) return true;
          const deptMatch = deptIds.length === 0 || (s.department?.id != null && deptIds.includes(s.department.id));
          const semMatch = sems.length === 0 || (s.semester != null && sems.includes(s.semester));
          return deptMatch && semMatch;
        }).length;
        setEligibleCount(count);
      } catch {
        // ignore
      }
    }
    if (!isLoading) fetchCount();
  }, [allowedDepartmentIds, allowedSemesters, allowedStudentIds, isLoading]);

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

  if (!test) return null;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href={`/college/drives/${params.driveId}`}>
            <ArrowLeft />
            Back to Drive
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-balance min-w-0">{test.title}</h1>
          <Badge variant={testStatusVariant[test.status] ?? "secondary"}>
            {test.status}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Manage test details and questions.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Edit Test</CardTitle>
          <CardDescription>
            Update the test details below and save your changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passingMarks">Passing Marks</Label>
              <Input
                id="passingMarks"
                type="number"
                min={0}
                value={passingMarks}
                onChange={(e) =>
                  setPassingMarks(parseInt(e.target.value) || 0)
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Date & Time</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="durationMinutes">Duration (minutes)</Label>
                <Input
                  id="durationMinutes"
                  inputMode="numeric"
                  value={durationMinutes}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setDurationMinutes(v === "" ? 0 : parseInt(v));
                  }}
                />
              </div>
            </div>

            {computedEndTime && (
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Clock className="size-4 shrink-0" />
                Test ends at: <span className="font-medium text-foreground">{computedEndTime}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Switch
                id="shuffleQuestions"
                checked={shuffleQuestions}
                onCheckedChange={setShuffleQuestions}
              />
              <Label htmlFor="shuffleQuestions">Shuffle questions</Label>
            </div>

            {/* Proctoring Configuration */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Proctoring Settings</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxViolations">Max Violations (auto-submit after)</Label>
                <Input
                  id="maxViolations"
                  inputMode="numeric"
                  value={maxViolations}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setMaxViolations(v === "" ? 0 : parseInt(v));
                  }}
                  className="w-32"
                />
                {maxViolations === 0 && (
                  <p className="text-xs text-muted-foreground">0 = unlimited violations (no auto-submit)</p>
                )}
              </div>

              <div className="space-y-2.5">
                <Label className="text-xs text-muted-foreground">Violation types to track</Label>
                <div className="flex items-center gap-2">
                  <Checkbox id="ev-tab" checked={enableTabSwitch} onCheckedChange={(v) => setEnableTabSwitch(!!v)} />
                  <Label htmlFor="ev-tab" className="text-sm font-normal">Tab switch detection</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="ev-fs" checked={enableFullscreen} onCheckedChange={(v) => setEnableFullscreen(!!v)} />
                  <Label htmlFor="ev-fs" className="text-sm font-normal">Fullscreen exit detection</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="ev-cp" checked={enableCopyPaste} onCheckedChange={(v) => setEnableCopyPaste(!!v)} />
                  <Label htmlFor="ev-cp" className="text-sm font-normal">Copy/paste detection</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="ev-rf" checked={enableRefresh} onCheckedChange={(v) => setEnableRefresh(!!v)} />
                  <Label htmlFor="ev-rf" className="text-sm font-normal">Page refresh detection</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resultVisibility">Result Visibility</Label>
              <Select value={resultVisibility} onValueChange={setResultVisibility}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AFTER_SUBMISSION">Immediately after submission</SelectItem>
                  <SelectItem value="MANUAL_RELEASE">Manually released by admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-3 pt-4">
              <Button type="submit" disabled={updateTest.isPending}>
                {updateTest.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save Changes
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link
                  href={`/college/drives/${params.driveId}/tests/${params.testId}/results`}
                >
                  <BarChart3 />
                  View Results
                </Link>
              </Button>
              {resultVisibility === "MANUAL_RELEASE" && (
                <Button
                  type="button"
                  variant={showResults ? "destructive" : "default"}
                  disabled={isTogglingResults}
                  onClick={() => {
                    setIsTogglingResults(true);
                    toggleResultsMutation.mutate({
                      id: params.testId,
                      showResults: !showResults,
                    });
                  }}
                >
                  {isTogglingResults && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  <Eye />
                  {showResults ? "Hide Results" : "Release Results"}
                </Button>
              )}
              <Button type="button" variant="outline" asChild>
                <Link
                  href={`/college/drives/${params.driveId}/tests/${params.testId}/monitor`}
                >
                  <Eye />
                  Live Monitor
                </Link>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive">
                    <Trash2 />
                    Delete Test
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Test</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this test and all its
                      questions and attempts. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteTest}
                      disabled={deleteTestMutation.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteTestMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Eligibility Card */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Eligibility
          </CardTitle>
          <CardDescription>
            Restrict which students can take this test. Leave all empty to allow all students.
            {eligibleCount !== null && (
              <span className="ml-2 font-medium text-foreground">
                ({eligibleCount} student{eligibleCount !== 1 ? "s" : ""} eligible)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Departments */}
          <div className="space-y-3">
            <Label>Departments</Label>
            {departments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No departments configured.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {departments.map((dept) => (
                  <label
                    key={dept.id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={allowedDepartmentIds.includes(dept.id)}
                      onCheckedChange={(checked) => {
                        setAllowedDepartmentIds((prev) =>
                          checked
                            ? [...prev, dept.id]
                            : prev.filter((id) => id !== dept.id)
                        );
                      }}
                    />
                    {dept.name}
                    {dept.code && (
                      <span className="text-muted-foreground">({dept.code})</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Semesters */}
          <div className="space-y-3">
            <Label>Semesters</Label>
            <div className="flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <label
                  key={sem}
                  className="flex items-center gap-1.5 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={allowedSemesters.includes(sem)}
                    onCheckedChange={(checked) => {
                      setAllowedSemesters((prev) =>
                        checked
                          ? [...prev, sem]
                          : prev.filter((s) => s !== sem)
                      );
                    }}
                  />
                  Sem {sem}
                </label>
              ))}
            </div>
          </div>

          {/* Specific Students */}
          <div className="space-y-3">
            <Label>Specific Students</Label>
            <p className="text-xs text-muted-foreground">
              These students are always eligible regardless of department or semester filters.
            </p>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or USN..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* CSV Upload */}
            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileUp className="size-4" />
                Bulk Add via CSV
              </div>
              <p className="text-xs text-muted-foreground">
                Upload a CSV with columns: <span className="font-mono">name, usn, email, department</span>.
                Existing students are matched by USN/email. New students are created with their USN as the default password.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const csv = `name,usn,email,department\nJohn Doe,1AB21CS001,john@example.com,CS\nJane Smith,1AB21EC002,jane@example.com,EC`;
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "eligibility_template.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-2 rounded-md border px-3 h-8 text-xs font-medium cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Download className="size-3.5" />
                  Template (.csv)
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const { utils, writeFile } = await import("xlsx");
                    const rows = [
                      ["name", "usn", "email", "department"],
                      ["John Doe", "1AB21CS001", "john@example.com", "CS"],
                      ["Jane Smith", "1AB21EC002", "jane@example.com", "EC"],
                    ];
                    const ws = utils.aoa_to_sheet(rows);
                    const wb = utils.book_new();
                    utils.book_append_sheet(wb, ws, "Eligibility");
                    writeFile(wb, "eligibility_template.xlsx");
                  }}
                  className="inline-flex items-center gap-2 rounded-md border px-3 h-8 text-xs font-medium cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Download className="size-3.5" />
                  Template (.xlsx)
                </button>
                <label className={`inline-flex w-fit items-center gap-2 rounded-md border px-4 h-9 text-sm font-medium cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors ${isProcessingCSV ? "opacity-50 pointer-events-none" : ""}`}>
                  {isProcessingCSV ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {isProcessingCSV ? "Processing..." : "Upload CSV / Excel"}
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleCSVUpload}
                    disabled={isProcessingCSV}
                  />
                </label>
              </div>
            </div>

            {/* CSV Import Results */}
            {csvResult && (
              <div className="rounded-md border p-3 text-sm space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium">CSV Import Results</span>
                  <button
                    type="button"
                    onClick={() => setCsvResult(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                {csvResult.added > 0 && (
                  <p className="text-green-600">
                    {csvResult.added} student{csvResult.added !== 1 ? "s" : ""} added to eligibility
                    {csvResult.created > 0 && ` (${csvResult.created} newly created)`}
                  </p>
                )}
                {csvResult.alreadySelected > 0 && (
                  <p className="text-muted-foreground">
                    {csvResult.alreadySelected} already selected (skipped)
                  </p>
                )}
                {csvResult.errors.length > 0 && (
                  <div>
                    <p className="text-destructive">Errors:</p>
                    <ul className="text-xs text-destructive/80 list-disc list-inside">
                      {csvResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {csvResult.errors.length > 5 && (
                        <li>...and {csvResult.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
                {csvResult.parseErrors.length > 0 && (
                  <div>
                    <p className="text-destructive">Parse errors:</p>
                    <ul className="text-xs text-destructive/80 list-disc list-inside">
                      {csvResult.parseErrors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {csvResult.parseErrors.length > 5 && (
                        <li>...and {csvResult.parseErrors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
                {csvResult.added === 0 && csvResult.errors.length === 0 && csvResult.alreadySelected === 0 && csvResult.parseErrors.length === 0 && (
                  <p className="text-muted-foreground">No students found in CSV.</p>
                )}
              </div>
            )}

            {/* Search Results Dropdown */}
            {studentSearch && (
              <div className="rounded-md border max-h-48 overflow-y-auto">
                {isSearching ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">
                    <Loader2 className="size-4 animate-spin inline mr-2" />
                    Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">
                    No students found.
                  </div>
                ) : (
                  searchResults.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between"
                      onClick={() => {
                        setAllowedStudentIds((prev) => [...prev, student.id]);
                        setSelectedStudents((prev) => [...prev, student]);
                        setStudentSearch("");
                        setSearchResults([]);
                      }}
                    >
                      <span>
                        {student.name}
                        {student.usn && (
                          <span className="text-muted-foreground ml-2">
                            {student.usn}
                          </span>
                        )}
                      </span>
                      {student.department && (
                        <span className="text-xs text-muted-foreground">
                          {student.department.name}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Selected Students */}
            {selectedStudents.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedStudents.map((student) => (
                  <Badge key={student.id} variant="secondary" className="gap-1">
                    {student.name}
                    {student.usn && ` (${student.usn})`}
                    <button
                      type="button"
                      onClick={() => {
                        setAllowedStudentIds((prev) =>
                          prev.filter((id) => id !== student.id)
                        );
                        setSelectedStudents((prev) =>
                          prev.filter((s) => s.id !== student.id)
                        );
                      }}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Questions</h2>
            <p className="text-sm text-muted-foreground">
              {questions.length} question{questions.length !== 1 ? "s" : ""} in
              this test.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link
                href={`/college/drives/${params.driveId}/tests/${params.testId}/questions/import-library`}
              >
                <BookOpen />
                Import from Library
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Upload className="size-4" />
                  Upload CSV / Excel
                  <ChevronDown className="size-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    const csv = generateCSVTemplate();
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "questions_template.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="size-4" />
                  Download Template (.csv)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    const { utils, writeFile } = await import("xlsx");
                    const csv = generateCSVTemplate();
                    const rows = parseCSV(csv);
                    const ws = utils.aoa_to_sheet(rows);
                    const wb = utils.book_new();
                    utils.book_append_sheet(wb, ws, "Questions");
                    writeFile(wb, "questions_template.xlsx");
                  }}
                >
                  <Download className="size-4" />
                  Download Template (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/college/drives/${params.driveId}/tests/${params.testId}/questions/upload`}>
                    <Upload className="size-4" />
                    Upload CSV / Excel
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild>
              <Link
                href={`/college/drives/${params.driveId}/tests/${params.testId}/questions/new`}
              >
                <Plus />
                Add Question
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Question</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Marks</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No questions yet. Add questions to this test.
                  </TableCell>
                </TableRow>
              ) : (
                questions.map((question, index) => (
                  <TableRow key={question.id}>
                    <TableCell className="font-medium">
                      {question.order || index + 1}
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {question.questionText.length > 80
                        ? question.questionText.substring(0, 80) + "\u2026"
                        : question.questionText}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {question.questionType === "CODING"
                          ? "Coding"
                          : question.questionType === "SINGLE_SELECT"
                            ? "Single"
                            : "Multi"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {question.marks}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={`/college/drives/${params.driveId}/tests/${params.testId}/questions/${question.id}/edit`}
                          aria-label="Edit question"
                        >
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete Question
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this question?
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleDeleteQuestion(question.id)
                              }
                              disabled={deletingId === question.id}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deletingId === question.id && (
                                <Loader2 className="mr-2 size-4 animate-spin" />
                              )}
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
