"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
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
import { ArrowLeft, Download, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import {
  parseLibraryQuestionsCSV,
  generateLibraryCSVTemplate,
  type LibraryCSVQuestion,
} from "@/lib/library-csv-parser";
import { parseCSV, type CSVParseError } from "@/lib/csv-parser";
import { fileToCSVText } from "@/lib/spreadsheet";
import { QuestionContent } from "@/components/ui/question-content";

type Phase = "select" | "preview" | "uploading";

const difficultyColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  EASY: "secondary",
  MEDIUM: "default",
  HARD: "destructive",
};

let optionCounter = 0;
function generateOptionId() {
  optionCounter += 1;
  return `opt_${Date.now()}_${optionCounter}`;
}

export default function LibraryBulkUploadPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("select");
  const [questions, setQuestions] = useState<LibraryCSVQuestion[]>([]);
  const [errors, setErrors] = useState<CSVParseError[]>([]);

  // Edit dialog state
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editQ, setEditQ] = useState<LibraryCSVQuestion | null>(null);

  async function handleDownloadTemplate(format: "csv" | "xlsx") {
    const csv = generateLibraryCSVTemplate();
    if (format === "xlsx") {
      const { utils, writeFile } = await import("xlsx");
      const rows = parseCSV(csv);
      const ws = utils.aoa_to_sheet(rows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Questions");
      writeFile(wb, "library_questions_template.xlsx");
    } else {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "library_questions_template.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await fileToCSVText(file);
    const result = parseLibraryQuestionsCSV(text);
    setQuestions(result.questions);
    setErrors(result.errors);
    setPhase("preview");
  }

  async function handleUpload() {
    if (questions.length === 0) return;
    setPhase("uploading");
    try {
      const res = await fetch("/api/library/questions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions, scope: "global" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      const data = await res.json();
      toast.success(`${data.created} questions uploaded to library`);
      router.push("/admin/library");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
      setPhase("preview");
    }
  }

  function handleDeleteQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
    toast.success("Question removed");
  }

  function openEditDialog(index: number) {
    setEditIndex(index);
    setEditQ({ ...questions[index], options: questions[index].options.map((o) => ({ ...o })) });
  }

  function saveEdit() {
    if (editIndex === null || !editQ) return;
    if (!editQ.questionText.trim()) { toast.error("Question text is required"); return; }
    if (editQ.categories.length === 0) { toast.error("At least one category is required"); return; }
    const filledOptions = editQ.options.filter((o) => o.text.trim());
    if (filledOptions.length < 2) { toast.error("At least 2 options with text are required"); return; }
    if (editQ.correctOptionIds.length === 0) { toast.error("Select at least one correct option"); return; }

    setQuestions((prev) => prev.map((q, i) => (i === editIndex ? { ...editQ, options: filledOptions } : q)));
    setEditIndex(null);
    setEditQ(null);
    toast.success("Question updated");
  }

  function addEditOption() {
    if (!editQ) return;
    setEditQ({ ...editQ, options: [...editQ.options, { id: generateOptionId(), text: "" }] });
  }

  function removeEditOption(id: string) {
    if (!editQ) return;
    if (editQ.options.length <= 2) { toast.error("At least 2 options are required"); return; }
    setEditQ({
      ...editQ,
      options: editQ.options.filter((o) => o.id !== id),
      correctOptionIds: editQ.correctOptionIds.filter((cid) => cid !== id),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/admin/library">
            <ArrowLeft />
            Back to Library
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-balance">Bulk Upload Questions</h1>
        <p className="text-muted-foreground">
          Upload MCQ questions to the library from a CSV file.
        </p>
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
              <p className="font-medium text-foreground">CSV Format</p>
              <ul className="space-y-1.5 text-[13px]">
                <li>
                  Same columns as test CSV, plus{" "}
                  <code className="bg-muted px-1 rounded text-xs">categories</code> (required, pipe-separated for multiple e.g. &quot;Math|DSA&quot;) and{" "}
                  <code className="bg-muted px-1 rounded text-xs">difficulty</code> (required: EASY, MEDIUM, or HARD)
                </li>
                <li>
                  <code className="bg-muted px-1 rounded text-xs">option_1</code> to{" "}
                  <code className="bg-muted px-1 rounded text-xs">option_4</code> &mdash; min 2, leave extras blank
                </li>
                <li>
                  <code className="bg-muted px-1 rounded text-xs">correct_answers</code> &mdash; option number(s), e.g.{" "}
                  <code className="bg-muted px-1 rounded text-xs">2</code> or{" "}
                  <code className="bg-muted px-1 rounded text-xs">1;3</code>
                </li>
                <li>
                  <code className="bg-muted px-1 rounded text-xs">question_type</code> &mdash;{" "}
                  <code className="bg-muted px-1 rounded text-xs">SINGLE_SELECT</code> (default) or{" "}
                  <code className="bg-muted px-1 rounded text-xs">MULTI_SELECT</code>
                </li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => handleDownloadTemplate("csv")}>
                <Download />
                Template (.csv)
              </Button>
              <Button variant="outline" onClick={() => handleDownloadTemplate("xlsx")}>
                <Download />
                Template (.xlsx)
              </Button>
              <Button asChild>
                <label className="cursor-pointer">
                  <Upload />
                  Select File
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
            <div className="rounded-lg border border-border shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead className="text-center">Marks</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((q, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{i + 1}</TableCell>
                      <TableCell className="max-w-md">
                        <div className="truncate">
                          {q.questionText.length > 80 ? q.questionText.substring(0, 80) + "..." : q.questionText}
                        </div>
                        {q.codeBlock && (
                          <Badge variant="outline" className="mt-1 text-[10px]">has code</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {q.questionType === "SINGLE_SELECT" ? "Single" : "Multi"}
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
                        <Badge variant={difficultyColor[q.difficulty] ?? "secondary"}>{q.difficulty}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{q.marks}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(i)}>
                            <Pencil className="size-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Question</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Remove this question from the upload list? This won&apos;t affect the original file.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteQuestion(i)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setPhase("select"); setQuestions([]); setErrors([]); }}>
              Choose Different File
            </Button>
            <Button onClick={handleUpload} disabled={questions.length === 0}>
              <Upload />
              Upload {questions.length} Question{questions.length !== 1 ? "s" : ""}
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
              <p className="text-muted-foreground">
                Uploading {questions.length} question{questions.length !== 1 ? "s" : ""}...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Question Dialog */}
      <Dialog open={editIndex !== null} onOpenChange={(open) => { if (!open) { setEditIndex(null); setEditQ(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Question {editIndex !== null ? editIndex + 1 : ""}</DialogTitle>
            <DialogDescription>Modify the question details before uploading.</DialogDescription>
          </DialogHeader>

          {editQ && (
            <div className="space-y-5 py-2">
              {/* Question Text */}
              <div className="space-y-2">
                <Label>Question Text <span className="text-destructive">*</span></Label>
                <Textarea
                  value={editQ.questionText}
                  onChange={(e) => setEditQ({ ...editQ, questionText: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Code Block */}
              <div className="space-y-2">
                <Label>Code Block <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={editQ.codeLanguage || ""}
                  onChange={(e) => setEditQ({ ...editQ, codeLanguage: e.target.value || undefined })}
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
                  onChange={(e) => setEditQ({ ...editQ, codeBlock: e.target.value || undefined })}
                  placeholder="Paste or write code here..."
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>

              {/* Preview */}
              {(editQ.questionText.trim() || editQ.codeBlock?.trim()) && (
                <div className="rounded-lg border p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Preview</p>
                  <QuestionContent
                    questionText={editQ.questionText}
                    codeBlock={editQ.codeBlock || null}
                    codeLanguage={editQ.codeLanguage || null}
                  />
                </div>
              )}

              {/* Category & Difficulty */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Categories <span className="text-destructive">*</span></Label>
                  <Input
                    value={editQ.categories.join(" | ")}
                    onChange={(e) => setEditQ({ ...editQ, categories: e.target.value.split("|").map((c) => c.trim()).filter(Boolean) })}
                    placeholder="e.g. Math | DSA | Logic"
                  />
                  <p className="text-xs text-muted-foreground">Separate multiple categories with |</p>
                </div>
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select
                    value={editQ.difficulty}
                    onValueChange={(v) => setEditQ({ ...editQ, difficulty: v as LibraryCSVQuestion["difficulty"] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EASY">Easy</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HARD">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Question Type */}
              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select
                  value={editQ.questionType}
                  onValueChange={(v) => setEditQ({ ...editQ, questionType: v as LibraryCSVQuestion["questionType"], correctOptionIds: [] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SINGLE_SELECT">Single Select</SelectItem>
                    <SelectItem value="MULTI_SELECT">Multi Select</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Options <span className="text-destructive">*</span></Label>
                  <Button type="button" variant="outline" size="sm" onClick={addEditOption}>
                    <Plus className="size-4" /> Add Option
                  </Button>
                </div>

                {editQ.questionType === "SINGLE_SELECT" ? (
                  <RadioGroup
                    value={editQ.correctOptionIds[0] || ""}
                    onValueChange={(id) => setEditQ({ ...editQ, correctOptionIds: [id] })}
                    className="space-y-2"
                  >
                    {editQ.options.map((opt, oi) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <RadioGroupItem value={opt.id} id={`edit-radio-${opt.id}`} />
                        <Input
                          className="flex-1"
                          placeholder={`Option ${oi + 1}`}
                          value={opt.text}
                          onChange={(e) => setEditQ({
                            ...editQ,
                            options: editQ.options.map((o) => o.id === opt.id ? { ...o, text: e.target.value } : o),
                          })}
                        />
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeEditOption(opt.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="space-y-2">
                    {editQ.options.map((opt, oi) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`edit-check-${opt.id}`}
                          checked={editQ.correctOptionIds.includes(opt.id)}
                          onCheckedChange={(checked) => setEditQ({
                            ...editQ,
                            correctOptionIds: checked
                              ? [...editQ.correctOptionIds, opt.id]
                              : editQ.correctOptionIds.filter((id) => id !== opt.id),
                          })}
                        />
                        <Input
                          className="flex-1"
                          placeholder={`Option ${oi + 1}`}
                          value={opt.text}
                          onChange={(e) => setEditQ({
                            ...editQ,
                            options: editQ.options.map((o) => o.id === opt.id ? { ...o, text: e.target.value } : o),
                          })}
                        />
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeEditOption(opt.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {editQ.questionType === "MULTI_SELECT"
                    ? "Check the boxes next to all correct answers."
                    : "Select the radio button next to the correct answer."}
                </p>
              </div>

              {/* Marks */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Marks</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editQ.marks}
                    onChange={(e) => setEditQ({ ...editQ, marks: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Negative Marks</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.25"
                    value={editQ.negativeMarks}
                    onChange={(e) => setEditQ({ ...editQ, negativeMarks: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Explanation */}
              <div className="space-y-2">
                <Label>Explanation <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  value={editQ.explanation ?? ""}
                  onChange={(e) => setEditQ({ ...editQ, explanation: e.target.value || undefined })}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditIndex(null); setEditQ(null); }}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
