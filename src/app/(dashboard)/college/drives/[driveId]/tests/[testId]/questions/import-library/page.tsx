"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
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
import { ArrowLeft, Loader2, Search, BookOpen } from "lucide-react";

const difficultyColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  EASY: "secondary",
  MEDIUM: "default",
  HARD: "destructive",
};

export default function ImportLibraryPage() {
  const params = useParams<{ driveId: string; testId: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch categories via tRPC
  const categoriesQuery = trpc.library.listCategories.useQuery();
  const categories = categoriesQuery.data ?? [];

  // Fetch library questions via tRPC
  const validDifficulty = difficulty && difficulty !== "all" ? difficulty as "EASY" | "MEDIUM" | "HARD" : undefined;
  const validType = type && type !== "all" ? type as "SINGLE_SELECT" | "MULTI_SELECT" | "CODING" : undefined;
  const questionsQuery = trpc.library.listQuestions.useQuery({
    search: search || undefined,
    category: category && category !== "all" ? category : undefined,
    difficulty: validDifficulty,
    questionType: validType,
    page,
    limit: 20,
  });

  interface QuestionsData {
    questions: { id: string; questionText: string; questionType: string; categories: string[]; difficulty: string; marks: number }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }
  const data: QuestionsData | null = (questionsQuery.data as QuestionsData | undefined) ?? null;
  const isLoading = questionsQuery.isLoading;

  // Reset page when filters change
  const handleSearchChange = (value: string) => { setSearch(value); setPage(1); };
  const handleCategoryChange = (value: string) => { setCategory(value); setPage(1); };
  const handleDifficultyChange = (value: string) => { setDifficulty(value); setPage(1); };
  const handleTypeChange = (value: string) => { setType(value); setPage(1); };

  const importMutation = trpc.library.importToTest.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.imported} question${result.imported !== 1 ? "s" : ""} imported`);
      utils.question.list.invalidate({ testId: params.testId });
      router.push(`/college/drives/${params.driveId}/tests/${params.testId}`);
    },
    onError: (err) => toast.error(err.message),
  });

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!data) return;
    const allIds = data.questions.map((q) => q.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allIds.forEach((id) => next.delete(id));
      } else {
        allIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function handleImport() {
    if (selectedIds.size === 0) return;
    importMutation.mutate({
      testId: params.testId,
      questionIds: Array.from(selectedIds),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href={`/college/drives/${params.driveId}/tests/${params.testId}`}>
            <ArrowLeft />
            Back to Test
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-balance">Import from Library</h1>
        <p className="text-muted-foreground">
          Select questions from the shared library to add to this test.
        </p>
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
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={difficulty} onValueChange={handleDifficultyChange}>
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
            <Select value={type} onValueChange={handleTypeChange}>
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

      {/* Import bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
          <p className="text-sm font-medium">
            {selectedIds.size} question{selectedIds.size !== 1 ? "s" : ""} selected
          </p>
          <Button onClick={handleImport} disabled={importMutation.isPending}>
            {importMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <BookOpen />
            )}
            Import Selected
          </Button>
        </div>
      )}

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
                        data !== null &&
                        data.questions.length > 0 &&
                        data.questions.every((q) => selectedIds.has(q.id))
                      }
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead className="text-center">Marks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data || data.questions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No questions found in the library.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.questions.map((q) => (
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
                          {q.categories.map((cat) => (
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(data.page - 1) * data.limit + 1}–
                {Math.min(data.page * data.limit, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
