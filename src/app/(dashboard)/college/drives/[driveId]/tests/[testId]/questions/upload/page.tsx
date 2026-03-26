"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Download, Globe, Loader2, Lock, Pencil, Plus, Trash2, Upload } from "lucide-react";
import {
  parseCSV,
  parseQuestionsCSV,
  generateCSVTemplate,
  type CSVQuestion,
  type CSVParseError,
} from "@/lib/csv-parser";
import { fileToCSVText } from "@/lib/spreadsheet";

type Phase = "select" | "preview" | "uploading" | "save-to-library";

let optCounter = 0;
function newOptId() { optCounter += 1; return `opt_${Date.now()}_${optCounter}`; }

export default function BulkUploadPage() {
  const params = useParams<{ driveId: string; testId: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [phase, setPhase] = useState<Phase>("select");
  const [questions, setQuestions] = useState<CSVQuestion[]>([]);
  const [errors, setErrors] = useState<CSVParseError[]>([]);

  // Edit dialog state
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editQ, setEditQ] = useState<CSVQuestion | null>(null);

  // Save to library state
  const [uploadedQuestionIds, setUploadedQuestionIds] = useState<string[]>([]);
  const [selectedForLibrary, setSelectedForLibrary] = useState<Set<number>>(new Set());
  const [libraryScope, setLibraryScope] = useState<"global" | "private">("private");
  const [libraryCategory, setLibraryCategory] = useState("");
  const [libraryDifficulty, setLibraryDifficulty] = useState("MEDIUM");
  const [isSavingToLibrary, setIsSavingToLibrary] = useState(false);

  // Fetch categories via tRPC for the library save dialog
  const categoriesQuery = trpc.library.listCategories.useQuery(undefined, {
    enabled: phase === "save-to-library",
  });
  const categories = categoriesQuery.data ?? [];

  const bulkCreateMutation = trpc.question.bulkCreate.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.created} questions uploaded successfully`);
      utils.question.list.invalidate({ testId: params.testId });

      // Store the created question IDs for potential library save
      if (data.questionIds && data.questionIds.length > 0) {
        setUploadedQuestionIds(data.questionIds);
      }

      setPhase("save-to-library");
    },
    onError: (err) => {
      toast.error(err.message);
      setPhase("preview");
    },
  });

  const saveFromTestMutation = trpc.library.saveFromTest.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.saved} question${data.saved !== 1 ? "s" : ""} saved to ${libraryScope} library`);
      utils.library.listQuestions.invalidate();
      router.push(`/college/drives/${params.driveId}/tests/${params.testId}`);
    },
    onError: (err) => toast.error(err.message),
  });

  async function handleDownloadTemplate(format: "csv" | "xlsx") {
    const csv = generateCSVTemplate();
    if (format === "xlsx") {
      const { utils, writeFile } = await import("xlsx");
      const rows = parseCSV(csv);
      const ws = utils.aoa_to_sheet(rows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Questions");
      writeFile(wb, "questions_template.xlsx");
    } else {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "questions_template.csv"; a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await fileToCSVText(file);
    const result = parseQuestionsCSV(text);
    setQuestions(result.questions);
    setErrors(result.errors);
    setPhase("preview");
  }

  function handleUpload() {
    if (questions.length === 0) return;
    setPhase("uploading");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bulkCreateMutation.mutate({
      testId: params.testId,
      questions: questions as any,
    });
  }

  function toggleLibrarySelection(idx: number) {
    setSelectedForLibrary((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function toggleAllForLibrary() {
    if (selectedForLibrary.size === questions.length) {
      setSelectedForLibrary(new Set());
    } else {
      setSelectedForLibrary(new Set(questions.map((_, i) => i)));
    }
  }

  function handleSaveToLibrary() {
    if (selectedForLibrary.size === 0 || !libraryCategory.trim()) {
      toast.error("Select questions and enter a category");
      return;
    }

    // Use the uploaded question IDs if available, otherwise skip
    const selectedIds = uploadedQuestionIds.length > 0
      ? Array.from(selectedForLibrary).map((i) => uploadedQuestionIds[i]).filter(Boolean)
      : [];

    if (selectedIds.length === 0) {
      toast.error("Could not identify uploaded questions. Please add them to the library manually.");
      router.push(`/college/drives/${params.driveId}/tests/${params.testId}`);
      return;
    }

    setIsSavingToLibrary(true);
    saveFromTestMutation.mutate(
      {
        testId: params.testId,
        questionIds: selectedIds,
        scope: libraryScope,
        categories: [libraryCategory],
        difficulty: libraryDifficulty as "EASY" | "MEDIUM" | "HARD",
      },
      {
        onSettled: () => setIsSavingToLibrary(false),
      }
    );
  }

  function deleteQuestion(i: number) {
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function openEdit(i: number) {
    setEditIdx(i);
    setEditQ(JSON.parse(JSON.stringify(questions[i]))); // deep clone
  }

  function saveEdit() {
    if (editIdx === null || !editQ) return;
    setQuestions((prev) => prev.map((q, i) => (i === editIdx ? editQ : q)));
    setEditIdx(null);
    setEditQ(null);
  }

  // Edit helpers
  function setEQ<K extends keyof CSVQuestion>(key: K, val: CSVQuestion[K]) {
    setEditQ((prev) => prev ? { ...prev, [key]: val } : prev);
  }

  function updateOption(id: string, text: string) {
    setEditQ((prev) => prev ? {
      ...prev,
      options: prev.options.map((o) => o.id === id ? { ...o, text } : o),
    } : prev);
  }

  function removeOption(id: string) {
    if (!editQ || editQ.options.length <= 2) { toast.error("At least 2 options required"); return; }
    setEditQ((prev) => prev ? {
      ...prev,
      options: prev.options.filter((o) => o.id !== id),
      correctOptionIds: prev.correctOptionIds.filter((cid) => cid !== id),
    } : prev);
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href={`/college/drives/${params.driveId}/tests/${params.testId}`}>
            <ArrowLeft />Back to Test
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-balance">Bulk Upload Questions</h1>
        <p className="text-muted-foreground">Upload MCQ and coding questions from a CSV or Excel file.</p>
      </div>

      {/* Phase 1: File Selection */}
      {phase === "select" && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>
              Upload a CSV or Excel (.xlsx) file with your questions. Download the template to see the expected format.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border p-4 text-sm text-muted-foreground space-y-3">
              <p className="font-medium text-foreground">File Format</p>
              <ul className="space-y-1.5 text-[13px]">
                <li><code className="bg-muted px-1 rounded text-xs">question_type</code> — <code className="bg-muted px-1 rounded text-xs">SINGLE_SELECT</code>, <code className="bg-muted px-1 rounded text-xs">MULTI_SELECT</code>, or <code className="bg-muted px-1 rounded text-xs">CODING</code></li>
                <li><code className="bg-muted px-1 rounded text-xs">option_1</code>–<code className="bg-muted px-1 rounded text-xs">option_4</code> &amp; <code className="bg-muted px-1 rounded text-xs">correct_answers</code> — for MCQ only</li>
                <li>CODING questions expect a plain-text answer from students (no code execution)</li>
                <li><code className="bg-muted px-1 rounded text-xs">marks</code>, <code className="bg-muted px-1 rounded text-xs">negative_marks</code>, <code className="bg-muted px-1 rounded text-xs">explanation</code>, <code className="bg-muted px-1 rounded text-xs">image_url</code> — optional</li>
              </ul>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => handleDownloadTemplate("csv")}><Download />Template (.csv)</Button>
              <Button variant="outline" onClick={() => handleDownloadTemplate("xlsx")}><Download />Template (.xlsx)</Button>
              <Button asChild>
                <label className="cursor-pointer">
                  <Upload />Select File
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
                </label>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase 2: Preview */}
      {phase === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant="default">{questions.length} valid</Badge>
            {errors.length > 0 && <Badge variant="destructive">{errors.length} errors</Badge>}
          </div>

          {errors.length > 0 && (
            <Card className="border-destructive">
              <CardHeader className="pb-3">
                <CardTitle className="text-destructive text-base">Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1">
                  {errors.map((err, i) => (
                    <li key={i} className="text-destructive">Row {err.row}: {err.message}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {questions.length > 0 && (
            <div className="space-y-3">
              {questions.map((q, i) =>
                (
                  <div key={i} className="rounded-lg border border-border shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="text-sm font-medium text-muted-foreground w-6">{i + 1}</span>
                      <Badge variant="outline" className="text-xs">
                        {q.questionType === "SINGLE_SELECT" ? "Single" : q.questionType === "MULTI_SELECT" ? "Multi" : "Coding"}
                      </Badge>
                      <span className="text-sm flex-1 truncate">
                        {q.questionText.length > 100 ? q.questionText.substring(0, 100) + "..." : q.questionText}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">{q.options.length} opts</span>
                      <span className="text-xs text-muted-foreground shrink-0">{q.marks} mark{q.marks !== 1 ? "s" : ""}</span>
                      {q.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={q.imageUrl} alt="preview" className="h-7 w-7 object-cover rounded shrink-0"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(i)}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteQuestion(i)}><Trash2 className="size-4" /></Button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setPhase("select"); setQuestions([]); setErrors([]); }}>
              Choose Different File
            </Button>
            <Button onClick={handleUpload} disabled={questions.length === 0}>
              <Upload />Upload {questions.length} Question{questions.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      )}

      {/* Phase 3: Uploading */}
      {phase === "uploading" && (
        <Card className="max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="size-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Uploading {questions.length} question{questions.length !== 1 ? "s" : ""}...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase 4: Save to Library */}
      {phase === "save-to-library" && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Save to Question Library?</CardTitle>
            <CardDescription>
              Would you like to save some of the uploaded questions to the question library for future reuse?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Question selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Select Questions</Label>
                <Button type="button" variant="outline" size="sm" onClick={toggleAllForLibrary}>
                  {selectedForLibrary.size === questions.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1 rounded-md border p-2">
                {questions.map((q, i) => (
                  <label key={i} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={selectedForLibrary.has(i)}
                      onCheckedChange={() => toggleLibrarySelection(i)}
                    />
                    <span className="text-sm truncate flex-1">{q.questionText.length > 80 ? q.questionText.substring(0, 80) + "..." : q.questionText}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {q.questionType === "CODING" ? "Coding" : q.questionType === "SINGLE_SELECT" ? "Single" : "Multi"}
                    </Badge>
                  </label>
                ))}
              </div>
              {selectedForLibrary.size > 0 && (
                <p className="text-xs text-muted-foreground">{selectedForLibrary.size} question{selectedForLibrary.size !== 1 ? "s" : ""} selected</p>
              )}
            </div>

            {selectedForLibrary.size > 0 && (
              <>
                {/* Scope */}
                <div className="space-y-2">
                  <Label>Library Scope</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant={libraryScope === "global" ? "default" : "outline"} size="sm" onClick={() => setLibraryScope("global")}>
                      <Globe className="size-3.5 mr-1.5" />Global
                    </Button>
                    <Button type="button" variant={libraryScope === "private" ? "default" : "outline"} size="sm" onClick={() => setLibraryScope("private")}>
                      <Lock className="size-3.5 mr-1.5" />Private
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {libraryScope === "global" ? "Visible to all college admins." : "Only visible to your college."}
                  </p>
                </div>

                {/* Category & Difficulty */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Category <span className="text-destructive">*</span></Label>
                    {categories.length > 0 ? (
                      <Select value={libraryCategory} onValueChange={setLibraryCategory}>
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={libraryCategory} onChange={(e) => setLibraryCategory(e.target.value)} placeholder="e.g. Math, DSA" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Difficulty <span className="text-destructive">*</span></Label>
                    <Select value={libraryDifficulty} onValueChange={setLibraryDifficulty}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EASY">Easy</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HARD">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/college/drives/${params.driveId}/tests/${params.testId}`)}
              >
                Skip
              </Button>
              {selectedForLibrary.size > 0 && (
                <Button onClick={handleSaveToLibrary} disabled={isSavingToLibrary || !libraryCategory.trim()}>
                  {isSavingToLibrary && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Save {selectedForLibrary.size} to Library
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editIdx !== null} onOpenChange={(open) => { if (!open) { setEditIdx(null); setEditQ(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Question {editIdx !== null ? editIdx + 1 : ""}</DialogTitle>
          </DialogHeader>

          {editQ && (
            <div className="space-y-5 py-2">
              {/* Question Text (Header) */}
              <div className="space-y-2">
                <Label>Question Text</Label>
                <Textarea value={editQ.questionText} onChange={(e) => setEQ("questionText", e.target.value)} rows={3} className="text-sm" />
              </div>

              {/* Code Block */}
              <div className="space-y-2">
                <Label>Code Block <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={editQ.codeLanguage || ""}
                  onChange={(e) => setEQ("codeLanguage", e.target.value || undefined)}
                >
                  <option value="">No language</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="c">C</option>
                  <option value="cpp">C++</option>
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="sql">SQL</option>
                </select>
                <Textarea
                  value={editQ.codeBlock || ""}
                  onChange={(e) => setEQ("codeBlock", e.target.value || undefined)}
                  placeholder="Paste or write code here..."
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>

              {/* Type + Marks */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2 col-span-1">
                  <Label>Type</Label>
                  <Select value={editQ.questionType} onValueChange={(v) => setEQ("questionType", v as CSVQuestion["questionType"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SINGLE_SELECT">Single Select</SelectItem>
                      <SelectItem value="MULTI_SELECT">Multi Select</SelectItem>
                      <SelectItem value="CODING">Coding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Marks</Label>
                  <Input type="number" min={1} value={editQ.marks} onChange={(e) => setEQ("marks", parseInt(e.target.value) || 1)} />
                </div>
                <div className="space-y-2">
                  <Label>Neg. Marks</Label>
                  <Input type="number" min={0} step="0.25" value={editQ.negativeMarks} onChange={(e) => setEQ("negativeMarks", parseFloat(e.target.value) || 0)} />
                </div>
              </div>

              {/* Options (all types including CODING) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Options</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    const id = newOptId();
                    setEditQ((prev) => prev ? { ...prev, options: [...prev.options, { id, text: "" }] } : prev);
                  }}>
                    <Plus className="size-4" />Add
                  </Button>
                </div>
                {editQ.questionType === "MULTI_SELECT" ? (
                  <div className="space-y-2">
                    {editQ.options.map((opt, oi) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`edit-c-${opt.id}`}
                          checked={editQ.correctOptionIds.includes(opt.id)}
                          onCheckedChange={(checked) => {
                            setEQ("correctOptionIds", checked
                              ? [...editQ.correctOptionIds, opt.id]
                              : editQ.correctOptionIds.filter((id) => id !== opt.id));
                          }}
                        />
                        <Input className="flex-1" placeholder={`Option ${oi + 1}`} value={opt.text} onChange={(e) => updateOption(opt.id, e.target.value)} />
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeOption(opt.id)} className="text-destructive hover:text-destructive"><Trash2 className="size-4" /></Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <RadioGroup value={editQ.correctOptionIds[0] || ""} onValueChange={(id) => setEQ("correctOptionIds", [id])} className="space-y-2">
                    {editQ.options.map((opt, oi) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <RadioGroupItem value={opt.id} id={`edit-r-${opt.id}`} />
                        <Input className="flex-1" placeholder={`Option ${oi + 1}`} value={opt.text} onChange={(e) => updateOption(opt.id, e.target.value)} />
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeOption(opt.id)} className="text-destructive hover:text-destructive"><Trash2 className="size-4" /></Button>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </div>

              {/* Explanation */}
              <div className="space-y-2">
                <Label>Explanation <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea value={editQ.explanation ?? ""} onChange={(e) => setEQ("explanation", e.target.value)} rows={2} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditIdx(null); setEditQ(null); }}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
