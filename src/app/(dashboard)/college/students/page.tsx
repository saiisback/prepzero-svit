"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  Trash2,
  Pencil,
  Search,
  ArrowUpCircle,
  GraduationCap,
  Users,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PAGE_SIZE = 15;

interface Student {
  id: string;
  name: string;
  email: string;
  usn: string | null;
  semester: number | null;
  isGraduated: boolean;
  department: { id: string; name: string; code: string | null } | null;
  createdAt: string | Date;
  testsTaken: number;
  averageScore: number | null;
}

interface EditForm {
  name: string;
  email: string;
  usn: string;
  semester: string;
  departmentId: string;
}

interface AddForm {
  name: string;
  email: string;
  usn: string;
  departmentId: string;
  semester: string;
  password: string;
}

export default function StudentsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteFilteredDialogOpen, setDeleteFilteredDialogOpen] = useState(false);
  const [deleteSingleStudent, setDeleteSingleStudent] = useState<Student | null>(null);

  // Derive filter state from URL
  const departmentFilter = searchParams.get("dept") ?? "all";
  const semesterFilter = searchParams.get("sem") ?? "all";
  const graduatedFilter = searchParams.get("graduated") ?? "all";
  const usnSearch = searchParams.get("q") ?? "";
  const currentPage = Number(searchParams.get("page") ?? "1");

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    if (key !== "page") params.delete("page");
    router.replace(`?${params.toString()}`);
  }

  // Build tRPC query input
  const studentsInput = useMemo(() => {
    const input: Record<string, unknown> = {
      page: currentPage,
      limit: PAGE_SIZE,
    };
    if (departmentFilter !== "all") input.departmentId = departmentFilter;
    if (semesterFilter !== "all") input.semester = parseInt(semesterFilter, 10);
    if (graduatedFilter !== "all") input.graduated = graduatedFilter;
    if (usnSearch) input.search = usnSearch;
    return input;
  }, [departmentFilter, semesterFilter, graduatedFilter, usnSearch, currentPage]);

  const { data: studentsData, isLoading: loading } = trpc.student.list.useQuery(
    studentsInput as Parameters<typeof trpc.student.list.useQuery>[0],
    {
      keepPreviousData: true,
      onError: () => toast.error("Failed to load students"),
    } as never
  );

  const students = (studentsData?.students ?? []) as Student[];
  const totalStudents = studentsData?.total ?? 0;
  const totalPages = studentsData?.totalPages ?? 1;

  // Departments
  const { data: departments = [] } = trpc.department.list.useQuery();

  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [promoteFilteredDialogOpen, setPromoteFilteredDialogOpen] = useState(false);

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    email: "",
    usn: "",
    semester: "none",
    departmentId: "none",
  });

  // Add student state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({
    name: "",
    email: "",
    usn: "",
    departmentId: "",
    semester: "",
    password: "",
  });

  // Clear selection when filters change
  useEffect(() => {
    setSelected(new Set());
  }, [departmentFilter, semesterFilter, graduatedFilter, usnSearch, currentPage]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(students.map((s) => s.id)));
    }
  }

  // Build the current filter params for server-side filtered operations
  function getActiveFilters() {
    const filters: Record<string, string | number> = {};
    if (departmentFilter !== "all") filters.departmentId = departmentFilter;
    if (semesterFilter !== "all") filters.semester = parseInt(semesterFilter, 10);
    if (graduatedFilter !== "all") filters.graduated = graduatedFilter;
    if (usnSearch) filters.search = usnSearch;
    return filters;
  }

  // Mutations
  const bulkDeleteMutation = trpc.student.bulkDelete.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Deleted ${data.deleted} student${data.deleted !== 1 ? "s" : ""}`
      );
      setSelected(new Set());
      utils.student.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete students");
    },
    onSettled: () => {
      setDeleteDialogOpen(false);
      setDeleteFilteredDialogOpen(false);
      setDeleteSingleStudent(null);
    },
  });

  const bulkPromoteMutation = trpc.student.bulkPromote.useMutation({
    onSuccess: (data) => {
      const parts: string[] = [];
      if (data.promoted > 0) parts.push(`${data.promoted} promoted`);
      if (data.graduated > 0) parts.push(`${data.graduated} graduated`);
      toast.success(parts.join(", ") || "No eligible students to promote");
      setSelected(new Set());
      utils.student.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to promote students");
    },
    onSettled: () => {
      setPromoteDialogOpen(false);
      setPromoteFilteredDialogOpen(false);
    },
  });

  const updateMutation = trpc.student.update.useMutation({
    onSuccess: () => {
      toast.success("Student updated successfully");
      setEditDialogOpen(false);
      utils.student.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update student");
    },
  });

  const createMutation = trpc.student.create.useMutation({
    onSuccess: () => {
      toast.success("Student added successfully");
      setAddDialogOpen(false);
      setAddForm({ name: "", email: "", usn: "", departmentId: "", semester: "", password: "" });
      utils.student.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add student");
    },
  });

  function handleBulkDelete(ids: string[]) {
    bulkDeleteMutation.mutate({ studentIds: ids });
  }

  function handleFilteredDelete() {
    bulkDeleteMutation.mutate({ filters: getActiveFilters() as Record<string, string> });
  }

  function handleBulkPromote(ids: string[]) {
    bulkPromoteMutation.mutate({ studentIds: ids });
  }

  function handleFilteredPromote() {
    bulkPromoteMutation.mutate({ filters: getActiveFilters() as Record<string, string> });
  }

  function openEditDialog(student: Student) {
    setEditingStudent(student);
    setEditForm({
      name: student.name,
      email: student.email,
      usn: student.usn || "",
      semester: student.semester ? String(student.semester) : "none",
      departmentId: student.department?.id || "none",
    });
    setEditDialogOpen(true);
  }

  function handleSaveEdit() {
    if (!editingStudent) return;

    const payload: Record<string, unknown> = { id: editingStudent.id };

    if (editForm.name !== editingStudent.name) payload.name = editForm.name;
    if (editForm.email !== editingStudent.email)
      payload.email = editForm.email;

    const newUsn = editForm.usn || null;
    if (newUsn !== editingStudent.usn) payload.usn = newUsn;

    const newSemester =
      editForm.semester !== "none" ? parseInt(editForm.semester, 10) : null;
    if (newSemester !== editingStudent.semester)
      payload.semester = newSemester;

    const newDeptId =
      editForm.departmentId !== "none" ? editForm.departmentId : null;
    if (newDeptId !== (editingStudent.department?.id || null))
      payload.departmentId = newDeptId;

    if (Object.keys(payload).length === 1) {
      // Only 'id' is in payload, no changes
      setEditDialogOpen(false);
      return;
    }

    updateMutation.mutate(payload as Parameters<typeof updateMutation.mutate>[0]);
  }

  function handleAddStudent() {
    if (!addForm.name || !addForm.email || !addForm.departmentId || !addForm.semester || !addForm.password) {
      return;
    }
    createMutation.mutate({
      name: addForm.name,
      email: addForm.email,
      usn: addForm.usn || undefined,
      departmentId: addForm.departmentId,
      semester: parseInt(addForm.semester, 10),
      password: addForm.password,
    });
  }

  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;

  const allSelected =
    students.length > 0 && selected.size === students.length;
  const someSelected =
    selected.size > 0 && selected.size < students.length;
  const hasActiveFilter =
    departmentFilter !== "all" ||
    semesterFilter !== "all" ||
    usnSearch !== "" ||
    graduatedFilter !== "all";

  const deleting = bulkDeleteMutation.isPending;
  const promoting = bulkPromoteMutation.isPending;
  const saving = updateMutation.isPending;
  const adding = createMutation.isPending;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-balance">
            Students
          </h1>
          <p className="text-sm text-muted-foreground">
            All registered students in your college.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
            <UserPlus className="size-4" aria-hidden="true" />
            Add Student
          </Button>
          <Button asChild>
            <Link href="/college/students/upload">
              <Upload className="size-4" aria-hidden="true" />
              Upload Students
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div
        role="group"
        aria-label="Filter students"
        className="flex flex-wrap items-center gap-3"
      >
        <div className="relative">
          <Search
            className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Search by USN"
            placeholder="Search by USN…"
            value={usnSearch}
            onChange={(e) => {
              setParam("q", e.target.value);
              setSelected(new Set());
            }}
            className="w-[200px] pl-8"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <Select
          value={departmentFilter}
          onValueChange={(v) => {
            setParam("dept", v);
            setSelected(new Set());
          }}
        >
          <SelectTrigger className="w-[180px]" aria-label="Filter by department">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.code || dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={semesterFilter}
          onValueChange={(v) => {
            setParam("sem", v);
            setSelected(new Set());
          }}
        >
          <SelectTrigger className="w-[150px]" aria-label="Filter by semester">
            <SelectValue placeholder="Semester" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Semesters</SelectItem>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <SelectItem key={sem} value={String(sem)}>
                Semester {sem}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={graduatedFilter}
          onValueChange={(v) => {
            setParam("graduated", v);
            setSelected(new Set());
          }}
        >
          <SelectTrigger className="w-[150px]" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Students</SelectItem>
            <SelectItem value="false">Active</SelectItem>
            <SelectItem value="true">Graduated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {(selected.size > 0 || (hasActiveFilter && students.length > 0)) && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-4 py-2"
          aria-live="polite"
        >
          {selected.size > 0 && (
            <>
              <span className="text-sm font-medium tabular-nums">
                {selected.size} student{selected.size !== 1 ? "s" : ""} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete Selected
              </Button>
              <Button size="sm" onClick={() => setPromoteDialogOpen(true)}>
                <ArrowUpCircle className="size-4" aria-hidden="true" />
                Promote Selected
              </Button>
            </>
          )}
          {hasActiveFilter && totalStudents > 0 && (
            <>
              {selected.size > 0 && (
                <span
                  aria-hidden="true"
                  className="mx-1 h-4 w-px shrink-0 bg-border"
                />
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteFilteredDialogOpen(true)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete All Filtered ({totalStudents})
              </Button>
              <Button
                size="sm"
                onClick={() => setPromoteFilteredDialogOpen(true)}
              >
                <ArrowUpCircle className="size-4" aria-hidden="true" />
                Promote All Filtered ({totalStudents})
              </Button>
            </>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div
            className="flex h-24 items-center justify-center gap-2"
            aria-live="polite"
          >
            <Loader2
              className="size-5 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
            <span className="sr-only">Loading students…</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[48px] px-4">
                  <Checkbox
                    checked={
                      allSelected ? true : someSelected ? "indeterminate" : false
                    }
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="px-4">Name</TableHead>
                <TableHead className="px-4">Email</TableHead>
                <TableHead className="px-4">USN</TableHead>
                <TableHead className="px-4">Department</TableHead>
                <TableHead className="px-4">Semester</TableHead>
                <TableHead className="px-4 text-center">Tests</TableHead>
                <TableHead className="w-[88px] px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-3 py-6">
                      <div className="rounded-full bg-muted p-3">
                        <Users
                          className="size-6 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {usnSearch
                            ? `No students match "${usnSearch}"`
                            : "No students found"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {usnSearch
                            ? "Try a different USN or clear the search."
                            : "Students appear here once they register or are uploaded via CSV."}
                        </p>
                      </div>
                      {!usnSearch && (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="mt-1"
                        >
                          <Link href="/college/students/upload">
                            <Upload className="size-4" aria-hidden="true" />
                            Upload Students
                          </Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="px-4">
                      <Checkbox
                        checked={selected.has(student.id)}
                        onCheckedChange={() => toggleSelect(student.id)}
                        aria-label={`Select ${student.name}`}
                      />
                    </TableCell>
                    <TableCell className="px-4 font-medium">
                      <Link
                        href={`/college/students/${student.id}`}
                        className="hover:underline text-primary"
                      >
                        {student.name}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 text-muted-foreground">
                      {student.email}
                    </TableCell>
                    <TableCell className="px-4 font-mono text-sm tabular-nums">
                      {student.usn ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4">
                      {student.department ? (
                        <Badge variant="outline">
                          {student.department.code || student.department.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4">
                      {student.isGraduated ? (
                        <Badge variant="default" className="bg-success">
                          <GraduationCap
                            className="size-3"
                            aria-hidden="true"
                          />
                          Graduated
                        </Badge>
                      ) : student.semester ? (
                        <Badge variant="secondary">
                          Sem {student.semester}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 text-center tabular-nums">
                      {student.testsTaken}
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(student)}
                          aria-label={`Edit ${student.name}`}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteSingleStudent(student)}
                          aria-label={`Delete ${student.name}`}
                        >
                          <Trash2
                            className="size-4 text-destructive"
                            aria-hidden="true"
                          />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startIdx + 1}&ndash;
            {Math.min(startIdx + PAGE_SIZE, totalStudents)} of{" "}
            {totalStudents} students
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setParam("page", "1")}
              disabled={safePage === 1}
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setParam("page", String(safePage - 1))}
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
              onClick={() => setParam("page", String(safePage + 1))}
              disabled={safePage === totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setParam("page", String(totalPages))}
              disabled={safePage === totalPages}
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Selected Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete students?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selected.size} student
              {selected.size !== 1 ? "s" : ""} and all their test attempts. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleBulkDelete(Array.from(selected))}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Single Student Dialog */}
      <AlertDialog
        open={!!deleteSingleStudent}
        onOpenChange={(open) => {
          if (!open) setDeleteSingleStudent(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete student?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong>{deleteSingleStudent?.name}</strong> (
              {deleteSingleStudent?.email}) and all their test attempts. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteSingleStudent)
                  handleBulkDelete([deleteSingleStudent.id]);
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Filtered Dialog */}
      <AlertDialog
        open={deleteFilteredDialogOpen}
        onOpenChange={setDeleteFilteredDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all filtered students?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {totalStudents} student
              {totalStudents !== 1 ? "s" : ""} matching the current
              filters (across all pages) and all their test attempts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFilteredDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
              Delete All ({totalStudents})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Promote Selected Dialog */}
      <AlertDialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote students?</AlertDialogTitle>
            <AlertDialogDescription>
              This will increment the semester for {selected.size} selected
              student{selected.size !== 1 ? "s" : ""}. Students in semester 8
              will be marked as graduated. Students without a semester or already
              graduated will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={promoting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleBulkPromote(Array.from(selected))}
              disabled={promoting}
            >
              {promoting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowUpCircle className="size-4" aria-hidden="true" />
              )}
              Promote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Promote All Filtered Dialog */}
      <AlertDialog
        open={promoteFilteredDialogOpen}
        onOpenChange={setPromoteFilteredDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote all filtered students?</AlertDialogTitle>
            <AlertDialogDescription>
              This will increment the semester for all {totalStudents}{" "}
              student{totalStudents !== 1 ? "s" : ""} matching the
              current filters (across all pages). Students in semester 8 will be marked as
              graduated. Students without a semester or already graduated will be
              skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={promoting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFilteredPromote}
              disabled={promoting}
            >
              {promoting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowUpCircle className="size-4" aria-hidden="true" />
              )}
              Promote All ({totalStudents})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Student Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update the student&apos;s details below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
                autoComplete="name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, email: e.target.value }))
                }
                autoComplete="email"
                spellCheck={false}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-usn">USN</Label>
              <Input
                id="edit-usn"
                value={editForm.usn}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, usn: e.target.value }))
                }
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-department">Department</Label>
              <Select
                value={editForm.departmentId}
                onValueChange={(val) =>
                  setEditForm((f) => ({ ...f, departmentId: val }))
                }
              >
                <SelectTrigger id="edit-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.code ? `${dept.code} – ${dept.name}` : dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-semester">Semester</Label>
              <Select
                value={editForm.semester}
                onValueChange={(val) =>
                  setEditForm((f) => ({ ...f, semester: val }))
                }
              >
                <SelectTrigger id="edit-semester">
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not Set</SelectItem>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                    <SelectItem key={sem} value={String(sem)}>
                      Semester {sem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving && (
                <Loader2
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Student Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => {
        setAddDialogOpen(open);
        if (!open) setAddForm({ name: "", email: "", usn: "", departmentId: "", semester: "", password: "" });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>
              Create a new student account. The student can log in using the password you set.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-name">Name</Label>
              <Input
                id="add-name"
                placeholder="Student name"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                autoComplete="name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                placeholder="student@example.com"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                autoComplete="email"
                spellCheck={false}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-usn">USN <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="add-usn"
                placeholder="e.g. 1SI22CS001"
                value={addForm.usn}
                onChange={(e) => setAddForm((f) => ({ ...f, usn: e.target.value }))}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-department">Department</Label>
              <Select
                value={addForm.departmentId}
                onValueChange={(val) => setAddForm((f) => ({ ...f, departmentId: val }))}
              >
                <SelectTrigger id="add-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.code ? `${dept.code} – ${dept.name}` : dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-semester">Semester</Label>
              <Select
                value={addForm.semester}
                onValueChange={(val) => setAddForm((f) => ({ ...f, semester: val }))}
              >
                <SelectTrigger id="add-semester">
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                    <SelectItem key={sem} value={String(sem)}>
                      Semester {sem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-password">Password</Label>
              <Input
                id="add-password"
                type="password"
                placeholder="Min 8 characters"
                value={addForm.password}
                onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
              />
              {addForm.password.length > 0 && addForm.password.length < 8 && (
                <p className="text-xs text-destructive">Password must be at least 8 characters</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button
              onClick={handleAddStudent}
              disabled={adding || !addForm.name || !addForm.email || !addForm.departmentId || !addForm.semester || addForm.password.length < 8}
            >
              {adding && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
