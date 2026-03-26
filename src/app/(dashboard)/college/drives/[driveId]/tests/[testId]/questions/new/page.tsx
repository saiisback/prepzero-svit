"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, Loader2, Plus, Trash2, X } from "lucide-react";
import { QuestionContent } from "@/components/ui/question-content";

interface Option {
  id: string;
  text: string;
}

let optionCounter = 0;
function generateOptionId() {
  optionCounter += 1;
  return `opt_${Date.now()}_${optionCounter}`;
}

export default function NewQuestionPage() {
  const params = useParams<{ driveId: string; testId: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [questionText, setQuestionText] = useState("");
  const [codeBlock, setCodeBlock] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [questionType, setQuestionType] = useState("SINGLE_SELECT");
  const [options, setOptions] = useState<Option[]>([
    { id: generateOptionId(), text: "" },
    { id: generateOptionId(), text: "" },
    { id: generateOptionId(), text: "" },
    { id: generateOptionId(), text: "" },
  ]);
  const [correctOptionIds, setCorrectOptionIds] = useState<string[]>([]);
  const [marks, setMarks] = useState(1);
  const [negativeMarks, setNegativeMarks] = useState(0);
  const [explanation, setExplanation] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMutation = (trpc.question.create as any).useMutation({
    onSuccess: () => {
      toast.success("Question added successfully");
      utils.question.list.invalidate({ testId: params.testId });
      router.push(
        `/college/drives/${params.driveId}/tests/${params.testId}`
      );
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  function addOption() {
    setOptions((prev) => [...prev, { id: generateOptionId(), text: "" }]);
  }

  function removeOption(id: string) {
    if (options.length <= 2) {
      toast.error("At least 2 options are required");
      return;
    }
    setOptions((prev) => prev.filter((o) => o.id !== id));
    setCorrectOptionIds((prev) => prev.filter((cid) => cid !== id));
  }

  function updateOptionText(id: string, text: string) {
    setOptions((prev) =>
      prev.map((o) => (o.id === id ? { ...o, text } : o))
    );
  }

  function handleSingleSelectChange(optionId: string) {
    setCorrectOptionIds([optionId]);
  }

  function handleMultiSelectChange(optionId: string, checked: boolean) {
    if (checked) {
      setCorrectOptionIds((prev) => [...prev, optionId]);
    } else {
      setCorrectOptionIds((prev) => prev.filter((id) => id !== optionId));
    }
  }

  function handleQuestionTypeChange(value: string) {
    setQuestionType(value);
    setCorrectOptionIds([]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!questionText.trim()) {
      toast.error("Question text is required");
      return;
    }

    {
      const filledOptions = options.filter((o) => o.text.trim());
      if (filledOptions.length < 2) {
        toast.error("At least 2 options with text are required");
        return;
      }

      if (correctOptionIds.length === 0) {
        toast.error("Please select at least one correct option");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const questionData: any = {
        questionText,
        codeBlock: codeBlock.trim() || null,
        codeLanguage: codeLanguage || null,
        imageUrls: imageUrls.length > 0 ? imageUrls : null,
        questionType,
        options: filledOptions,
        correctOptionIds,
        marks,
        negativeMarks,
        explanation: explanation || null,
      };

      createMutation.mutate({
        testId: params.testId,
        question: questionData,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link
            href={`/college/drives/${params.driveId}/tests/${params.testId}`}
          >
            <ArrowLeft />
            Back to Test
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-balance">Add Question</h1>
        <p className="text-muted-foreground">
          Create a new question for this test.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Question Details</CardTitle>
          <CardDescription>
            Fill in the question, options, and mark the correct answer(s).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Block 1: Question Text (Header) */}
            <div className="space-y-2">
              <Label htmlFor="questionText">
                Question Text <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="questionText"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Enter your question here..."
                rows={3}
                required
              />
              <p className="text-xs text-muted-foreground">Plain text question shown to students</p>
            </div>

            {/* Block 2: Code Block (optional) */}
            <div className="space-y-2">
              <Label>Code Block <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={codeLanguage}
                onChange={(e) => setCodeLanguage(e.target.value)}
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
                value={codeBlock}
                onChange={(e) => setCodeBlock(e.target.value)}
                placeholder="Paste or write code here..."
                rows={5}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Code displayed with syntax highlighting</p>
            </div>

            {/* Block 3: Images (optional) */}
            <div className="space-y-2">
              <Label>Images <span className="text-muted-foreground font-normal">(optional)</span></Label>
              {imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {imageUrls.map((src, i) => (
                    <div key={i} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Image ${i + 1}`} className="h-24 rounded-md border object-contain" />
                      <button
                        type="button"
                        onClick={() => setImageUrls((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-2 -right-2 size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.multiple = true;
                  input.onchange = () => {
                    if (!input.files) return;
                    Array.from(input.files).forEach((file) => {
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === "string") {
                          setImageUrls((prev) => [...prev, reader.result as string]);
                        }
                      };
                      reader.readAsDataURL(file);
                    });
                  };
                  input.click();
                }}
              >
                <Plus className="size-4 mr-1" /> Add Image
              </Button>
            </div>

            {/* Preview */}
            {(questionText.trim() || codeBlock.trim()) && (
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Preview</p>
                <QuestionContent
                  questionText={questionText}
                  codeBlock={codeBlock || null}
                  codeLanguage={codeLanguage || null}
                  imageUrls={imageUrls.length > 0 ? imageUrls : null}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="questionType">Question Type</Label>
              <Select
                value={questionType}
                onValueChange={handleQuestionTypeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SINGLE_SELECT">
                    Single Select (Radio)
                  </SelectItem>
                  <SelectItem value="MULTI_SELECT">
                    Multi Select (Checkbox)
                  </SelectItem>
                  <SelectItem value="CODING">
                    Coding (Single Select)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Options */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>
                    Options <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addOption}
                  >
                    <Plus className="size-4" />
                    Add Option
                  </Button>
                </div>

                {questionType !== "MULTI_SELECT" ? (
                  <RadioGroup
                    value={correctOptionIds[0] || ""}
                    onValueChange={handleSingleSelectChange}
                    className="space-y-3"
                  >
                    {options.map((option, index) => (
                      <div
                        key={option.id}
                        className="flex items-center gap-3"
                      >
                        <RadioGroupItem
                          value={option.id}
                          id={`radio-${option.id}`}
                        />
                        <Input
                          className="flex-1"
                          placeholder={`Option ${index + 1}`}
                          value={option.text}
                          onChange={(e) =>
                            updateOptionText(option.id, e.target.value)
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(option.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="space-y-3">
                    {options.map((option, index) => (
                      <div
                        key={option.id}
                        className="flex items-center gap-3"
                      >
                        <Checkbox
                          id={`check-${option.id}`}
                          checked={correctOptionIds.includes(option.id)}
                          onCheckedChange={(checked) =>
                            handleMultiSelectChange(
                              option.id,
                              checked as boolean
                            )
                          }
                        />
                        <Input
                          className="flex-1"
                          placeholder={`Option ${index + 1}`}
                          value={option.text}
                          onChange={(e) =>
                            updateOptionText(option.id, e.target.value)
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(option.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {questionType === "MULTI_SELECT"
                    ? "Check the boxes next to all correct answers."
                    : "Select the radio button next to the correct answer."}
                </p>
              </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="marks">Marks</Label>
                <Input
                  id="marks"
                  type="number"
                  min={1}
                  value={marks}
                  onChange={(e) => setMarks(parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="negativeMarks">Negative Marks</Label>
                <Input
                  id="negativeMarks"
                  type="number"
                  min={0}
                  step="0.25"
                  value={negativeMarks}
                  onChange={(e) =>
                    setNegativeMarks(parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="explanation">Explanation (optional)</Label>
              <Textarea
                id="explanation"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explain the correct answer (shown after submission)"
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Add Question
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link
                  href={`/college/drives/${params.driveId}/tests/${params.testId}`}
                >
                  Cancel
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
