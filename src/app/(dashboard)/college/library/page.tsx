"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import Link from "next/link";
import { Loader2, Search, BookOpen, Pencil, Trash2, Tag, Plus, Check, X, Upload, Globe, Lock, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface LibraryQuestion {
  id: string;
  questionText: string;
  codeBlock?: string | null;
  codeLanguage?: string | null;
  questionType: string;
  categories: string[];
  difficulty: string;
  marks: number;
  collegeId: string | null;
}

interface TestOption {
  id: string;
  title: string;
  drive: { title: string };
}

interface CategoryItem {
  id: string;
  name: string;
  isGlobal: boolean;
}

const difficultyColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  EASY: "secondary",
  MEDIUM: "default",
  HARD: "destructive",
};

export default function CollegeLibraryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  // Import to test state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tests, setTests] = useState<TestOption[]>([]);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Derive filter + pagination state from URL
  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const difficulty = searchParams.get("difficulty") ?? "";
  const type = searchParams.get("type") ?? "";
  const scope = searchParams.get("scope") ?? "global";
  const page = Number(searchParams.get("page") ?? "1");

  const isGlobalScope = scope === "global";

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

  // tRPC query for questions
  const questionsInput = {
    scope: (isGlobalScope ? "global" : "college") as "global" | "college",
    search: search || undefined,
    category: category || undefined,
    difficulty: (difficulty || undefined) as "EASY" | "MEDIUM" | "HARD" | undefined,
    questionType: (type || undefined) as "SINGLE_SELECT" | "MULTI_SELECT" | "CODING" | undefined,
    page,
    limit: 10,
  };
  const { data, isLoading } = trpc.library.listQuestions.useQuery(
    questionsInput as Parameters<typeof trpc.library.listQuestions.useQuery>[0],
    {
      keepPreviousData: true,
    } as never
  );

  // tRPC query for categories
  const { data: categories = [] } = trpc.library.listCategories.useQuery();

  // tRPC mutations
  const createCategoryMutation = trpc.library.createCategory.useMutation({
    onSuccess: () => {
      toast.success("Category added");
      setNewCategoryName("");
      utils.library.listCategories.invalidate();
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || "Something went wrong");
    },
  });

  const updateCategoryMutation = trpc.library.updateCategory.useMutation({
    onSuccess: () => {
      toast.success("Category updated");
      setEditingCategoryId(null);
      utils.library.listCategories.invalidate();
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || "Something went wrong");
    },
  });

  const deleteCategoryMutation = trpc.library.deleteCategory.useMutation({
    onSuccess: () => {
      toast.success("Category deleted");
      utils.library.listCategories.invalidate();
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || "Something went wrong");
    },
    onSettled: () => {
      setDeletingCategoryId(null);
    },
  });

  const deleteQuestionMutation = trpc.library.deleteQuestion.useMutation({
    onSuccess: () => {
      toast.success("Question deleted");
      utils.library.listQuestions.invalidate();
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || "Something went wrong");
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const bulkDeleteMutation = trpc.library.bulkDeleteQuestions.useMutation({
    onSuccess: (result: { deleted: number }) => {
      toast.success(`${result.deleted} question${result.deleted !== 1 ? "s" : ""} deleted`);
      setSelectedIds(new Set());
      utils.library.listQuestions.invalidate();
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || "Something went wrong");
    },
    onSettled: () => {
      setIsBulkDeleting(false);
    },
  });

  function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    createCategoryMutation.mutate({ name: newCategoryName.trim() });
  }

  function handleDeleteCategory(categoryId: string) {
    setDeletingCategoryId(categoryId);
    deleteCategoryMutation.mutate({ id: categoryId });
  }

  function startEditingCategory(cat: CategoryItem) {
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.name);
  }

  function handleSaveCategory() {
    if (!editingCategoryId || !editingCategoryName.trim()) return;
    updateCategoryMutation.mutate({ id: editingCategoryId, name: editingCategoryName.trim() });
  }

  // Fetch tests when import dialog opens
  useEffect(() => {
    if (!dialogOpen) return;
    fetch("/api/tests")
      .then((res) => res.json())
      .then((data: TestOption[]) => setTests(data))
      .catch(() => {});
  }, [dialogOpen]);

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!data) return;
    const allIds = data.questions.map((q: LibraryQuestion) => q.id);
    const allSelected = allIds.every((id: string) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) allIds.forEach((id: string) => next.delete(id));
      else allIds.forEach((id: string) => next.add(id));
      return next;
    });
  }

  function handleDelete(questionId: string) {
    setDeletingId(questionId);
    deleteQuestionMutation.mutate({ id: questionId });
  }

  async function handleImport() {
    if (!selectedTestId || selectedIds.size === 0) return;
    setIsImporting(true);
    try {
      const res = await fetch("/api/library/questions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId: selectedTestId, questionIds: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Import failed");
      }
      const result = await res.json();
      toast.success(`${result.imported} question${result.imported !== 1 ? "s" : ""} imported`);
      setSelectedIds(new Set());
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsImporting(false);
    }
  }

  function getActiveFilters() {
    const filters: Record<string, string> = {};
    if (search) filters.search = search;
    if (category) filters.category = category;
    if (difficulty) filters.difficulty = difficulty;
    if (type) filters.type = type;
    filters.scope = scope;
    return filters;
  }

  const hasActiveFilter = !!(search || category || difficulty || type);
  const totalQuestions = data?.total ?? 0;

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    bulkDeleteMutation.mutate({ questionIds: Array.from(selectedIds) });
  }

  function handleFilteredDelete() {
    setIsBulkDeleting(true);
    bulkDeleteMutation.mutate({ filters: getActiveFilters() });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-balance">Question Library</h1>
          <p className="text-muted-foreground">
            Browse, create, and import questions into your tests.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Tag />
                Categories
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manage Categories</DialogTitle>
                <DialogDescription>
                  Global categories (from super admin) are shared. You can add your own college-specific categories.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex gap-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New category name"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); } }}
                  />
                  <Button onClick={handleAddCategory} disabled={createCategoryMutation.isPending || !newCategoryName.trim()}>
                    {createCategoryMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Add
                  </Button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No categories yet.</p>
                  ) : (
                    categories.map((cat: CategoryItem) => (
                      <div key={cat.id} className="flex items-center justify-between rounded-md border px-3 py-2 gap-2">
                        {editingCategoryId === cat.id ? (
                          <>
                            <Input
                              value={editingCategoryName}
                              onChange={(e) => setEditingCategoryName(e.target.value)}
                              className="h-7 text-sm"
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveCategory(); } if (e.key === "Escape") setEditingCategoryId(null); }}
                              autoFocus
                            />
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleSaveCategory} disabled={updateCategoryMutation.isPending || !editingCategoryName.trim()}>
                                {updateCategoryMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingCategoryId(null)}>
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{cat.name}</span>
                              {cat.isGlobal && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Global</Badge>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {!cat.isGlobal && (
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEditingCategory(cat)}>
                                  <Pencil className="size-3.5" />
                                </Button>
                              )}
                              {!cat.isGlobal && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 w-7 p-0">
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Category</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Delete &quot;{cat.name}&quot;? Existing questions with this category won&apos;t be affected.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteCategory(cat.id)}
                                        disabled={deletingCategoryId === cat.id}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        {deletingCategoryId === cat.id && <Loader2 className="mr-2 size-4 animate-spin" />}
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          {selectedIds.size > 0 && !isGlobalScope && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 />
                  Delete {selectedIds.size}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedIds.size} Question{selectedIds.size !== 1 ? "s" : ""}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove the selected questions from the library. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isBulkDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {hasActiveFilter && !isGlobalScope && totalQuestions > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 />
                  Delete All Filtered ({totalQuestions})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete all filtered questions?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {totalQuestions} question{totalQuestions !== 1 ? "s" : ""} matching the current filters (across all pages). This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleFilteredDelete}
                    disabled={isBulkDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isBulkDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Delete All ({totalQuestions})
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {selectedIds.size > 0 && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <BookOpen />
                  Import {selectedIds.size} to Test
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Questions to Test</DialogTitle>
                  <DialogDescription>
                    Select a test to import {selectedIds.size} question{selectedIds.size !== 1 ? "s" : ""} into.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-4">
                  <Label>Select Test</Label>
                  <Select value={selectedTestId} onValueChange={setSelectedTestId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a test..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tests.map((t: TestOption) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title} ({t.drive.title})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleImport} disabled={!selectedTestId || isImporting}>
                    {isImporting && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Import
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" asChild>
            <Link href={`/college/library/upload?scope=${scope}`}>
              <Upload />
              Upload CSV
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/college/library/new?scope=${scope}`}>
              <Plus />
              Add Question
            </Link>
          </Button>
        </div>
      </div>

      {/* Scope Tabs */}
      <div className="flex gap-1 rounded-lg border border-border p-1 w-fit">
        <button
          onClick={() => setParam("scope", "global")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            isGlobalScope
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Globe className="size-3.5" />
          Global
        </button>
        <button
          onClick={() => setParam("scope", "private")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            !isGlobalScope
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Lock className="size-3.5" />
          Private
        </button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search questions..."
                value={search}
                onChange={(e) => setParam("search", e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={(v) => setParam("category", v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat: CategoryItem) => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={difficulty} onValueChange={(v) => setParam("difficulty", v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Difficulty</SelectItem>
                <SelectItem value="EASY">Easy</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HARD">Hard</SelectItem>
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(v) => setParam("type", v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="SINGLE_SELECT">Single Select</SelectItem>
                <SelectItem value="MULTI_SELECT">Multi Select</SelectItem>
                <SelectItem value="CODING">Coding</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Questions Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        !!data &&
                        data.questions.length > 0 &&
                        data.questions.every((q: LibraryQuestion) => selectedIds.has(q.id))
                      }
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead className="text-center">Marks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data || data.questions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {isGlobalScope
                        ? "No global questions found in the library."
                        : "No private questions found. Add your own college-specific questions."}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.questions.map((q: LibraryQuestion) => (
                    <TableRow key={q.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(q.id)}
                          onCheckedChange={() => toggleSelection(q.id)}
                        />
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {q.questionText.length > 80
                          ? q.questionText.substring(0, 80) + "..."
                          : q.questionText}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {q.questionType === "CODING"
                            ? "Coding"
                            : q.questionType === "SINGLE_SELECT"
                              ? "Single"
                              : "Multi"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {q.categories.map((cat: string) => (
                            <Badge key={cat} variant="secondary">{cat}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={difficultyColor[q.difficulty] ?? "secondary"}>
                          {q.difficulty}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{q.marks}</TableCell>
                      <TableCell className="text-right">
                        {q.collegeId !== null ? (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/college/library/${q.id}`}>
                                <Pencil className="size-4" />
                              </Link>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                  <Trash2 className="size-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Question</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure? This will permanently remove this question from the library.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(q.id)}
                                    disabled={deletingId === q.id}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {deletingId === q.id && <Loader2 className="mr-2 size-4 animate-spin" />}
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">View only</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {data && data.total > 0 && (() => {
            const { totalPages } = data;
            const pages: (number | "ellipsis")[] = [];

            if (totalPages <= 7) {
              for (let i = 1; i <= totalPages; i++) pages.push(i);
            } else {
              pages.push(1);
              if (page > 3) pages.push("ellipsis");
              for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
                pages.push(i);
              }
              if (page < totalPages - 2) pages.push("ellipsis");
              pages.push(totalPages);
            }

            return (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(data.page - 1) * data.limit + 1}–
                  {Math.min(data.page * data.limit, data.total)} of {data.total}
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => setParam("page", "1")}
                      disabled={page <= 1}
                    >
                      <ChevronsLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => setParam("page", String(page - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    {pages.map((p, i) =>
                      p === "ellipsis" ? (
                        <span key={`e-${i}`} className="px-1 text-muted-foreground">...</span>
                      ) : (
                        <Button
                          key={p}
                          variant={p === page ? "default" : "outline"}
                          size="icon"
                          className="size-8 text-xs"
                          onClick={() => setParam("page", String(p))}
                        >
                          {p}
                        </Button>
                      )
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => setParam("page", String(page + 1))}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => setParam("page", String(totalPages))}
                      disabled={page >= totalPages}
                    >
                      <ChevronsRight className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
