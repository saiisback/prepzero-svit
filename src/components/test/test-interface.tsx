"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SubmitDialog } from "@/components/test/submit-dialog";
import { ViolationBanner } from "@/components/test/violation-banner";
import { useProctoring } from "@/hooks/use-proctoring";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  Send,
  CheckCircle,
  Loader2,
  AlertCircle,
  ShieldAlert,
  Code2,
  Moon,
  Sun,
  Maximize,
  MonitorX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QuestionText } from "@/components/ui/question-text";
import { QuestionContent } from "@/components/ui/question-content";
import { useTheme } from "next-themes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Option {
  id: string;
  text: string;
}

interface SampleTestCase {
  input: string;
  expectedOutput: string;
}

interface Question {
  id: string;
  questionText: string;
  codeBlock?: string | null;
  codeLanguage?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  questionType: "SINGLE_SELECT" | "MULTI_SELECT" | "CODING";
  options: Option[];
  marks: number;
  order: number;
  testCases?: SampleTestCase[];
}

interface Attempt {
  id: string;
  testId: string;
  startedAt: string;
  status: string;
}

interface AttemptDetail {
  id: string;
  testId: string;
  startedAt: string;
  status: string;
  tabSwitchCount: number;
  fullscreenExitCount: number;
  copyPasteAttempts: number;
  refreshCount: number;
  totalViolations: number;
  maxViolations: number;
  test: {
    title: string;
    durationMinutes: number;
    totalMarks: number;
    maxViolations: number;
    enableTabSwitchDetection: boolean;
    enableFullscreenDetection: boolean;
    enableCopyPasteDetection: boolean;
    enableRefreshDetection: boolean;
  };
  answers: Array<{
    questionId: string;
    selectedOptionIds: string[];
    code?: string | null;
    language?: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TestInterfaceProps {
  testId: string;
}

export function TestInterface({ testId }: TestInterfaceProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Core state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string[]>>(new Map());
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [testTitle, setTestTitle] = useState("");
  const [totalMarks, setTotalMarks] = useState(0);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [autoSubmittedByViolation, setAutoSubmittedByViolation] =
    useState(false);
  const [sessionConflict, setSessionConflict] = useState(false);

  // Initial violation counts restored from server
  const [initialViolations, setInitialViolations] = useState<{
    tabSwitchCount: number;
    fullscreenExitCount: number;
    copyPasteAttempts: number;
    refreshCount: number;
    totalViolations: number;
  } | null>(null);
  const [maxViolations, setMaxViolations] = useState(5);
  const [proctoringConfig, setProctoringConfig] = useState<{
    enableTabSwitchDetection: boolean;
    enableFullscreenDetection: boolean;
    enableCopyPasteDetection: boolean;
    enableRefreshDetection: boolean;
  } | null>(null);

  // Refs for debounced save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSavesRef = useRef<Map<string, string[]>>(new Map());

  // Proctoring
  const handleViolationAutoSubmit = useCallback(() => {
    setAutoSubmittedByViolation(true);
  }, []);
  const { violations, warningMessage, isFullscreen, enterFullscreen } = useProctoring(
    attemptId,
    maxViolations,
    handleViolationAutoSubmit,
    initialViolations,
    proctoringConfig
  );

  // ----------------------------------------------------------
  // Initialize: start attempt, fetch questions, restore answers
  // ----------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        setLoading(true);
        setError(null);

        // 1. Start/resume the attempt
        const startRes = await fetch(`/api/tests/${testId}/start`, {
          method: "POST",
        });

        if (!startRes.ok) {
          const data = await startRes.json();
          if (startRes.status === 409) {
            setError("You have already completed this test.");
          } else {
            setError(data.error || "Failed to start the test.");
          }
          return;
        }

        const attempt: Attempt = await startRes.json();
        if (cancelled) return;

        setAttemptId(attempt.id);
        setStartedAt(new Date(attempt.startedAt));

        // 2. Fetch questions
        const qRes = await fetch(`/api/tests/${testId}/questions`);
        if (!qRes.ok) {
          setError("Failed to load questions.");
          return;
        }
        const qData: Question[] = await qRes.json();
        if (cancelled) return;

        // Parse options if they come as JSON string
        const parsedQuestions = qData.map((q) => ({
          ...q,
          options:
            typeof q.options === "string"
              ? JSON.parse(q.options)
              : q.options,
        }));
        setQuestions(parsedQuestions);

        // 3. Fetch attempt detail to restore answers and get test info
        const detailRes = await fetch(`/api/attempts/${attempt.id}`);
        if (detailRes.ok) {
          const detail: AttemptDetail = await detailRes.json();
          if (cancelled) return;

          setDurationMinutes(detail.test.durationMinutes);
          setTestTitle(detail.test.title);
          setTotalMarks(detail.test.totalMarks);

          // Restore saved answers
          if (detail.answers && detail.answers.length > 0) {
            const restored = new Map<string, string[]>();
            for (const ans of detail.answers) {
              if (ans.selectedOptionIds && ans.selectedOptionIds.length > 0) {
                restored.set(ans.questionId, ans.selectedOptionIds);
              }
            }
            setAnswers(restored);
          }

          // Restore violation counts from server
          setInitialViolations({
            tabSwitchCount: detail.tabSwitchCount ?? 0,
            fullscreenExitCount: detail.fullscreenExitCount ?? 0,
            copyPasteAttempts: detail.copyPasteAttempts ?? 0,
            refreshCount: detail.refreshCount ?? 0,
            totalViolations: detail.totalViolations ?? 0,
          });

          // Restore proctoring config from test
          setMaxViolations(detail.maxViolations ?? detail.test.maxViolations ?? 5);
          setProctoringConfig({
            enableTabSwitchDetection: detail.test.enableTabSwitchDetection ?? true,
            enableFullscreenDetection: detail.test.enableFullscreenDetection ?? true,
            enableCopyPasteDetection: detail.test.enableCopyPasteDetection ?? true,
            enableRefreshDetection: detail.test.enableRefreshDetection ?? true,
          });

          // Auto-enter fullscreen after initialization
          if (detail.test.enableFullscreenDetection !== false) {
            document.documentElement.requestFullscreen?.().catch(() => {
              // Browser may block without user gesture — overlay will prompt
            });
          }
        }
      } catch {
        if (!cancelled) {
          setError("An unexpected error occurred. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [testId]);

  // ----------------------------------------------------------
  // Timer
  // ----------------------------------------------------------

  useEffect(() => {
    if (!startedAt || submitted) return;

    function tick() {
      const now = new Date();
      const elapsed = Math.floor(
        (now.getTime() - startedAt!.getTime()) / 1000
      );
      const total = durationMinutes * 60;
      const remaining = Math.max(0, total - elapsed);
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        handleAutoSubmit();
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, durationMinutes, submitted]);

  // ----------------------------------------------------------
  // Session heartbeat — detect if another device took over
  // ----------------------------------------------------------

  useEffect(() => {
    if (!attemptId || submitted || sessionConflict) return;

    const checkSession = async () => {
      try {
        const res = await fetch(`/api/attempts/${attemptId}/session-check`);
        if (res.ok) {
          const data = await res.json();
          if (!data.active) {
            setSessionConflict(true);
          }
        } else if (res.status === 401) {
          // Session expired — logged in elsewhere
          setSessionConflict(true);
        }
      } catch {
        // Network error, skip this check
      }
    };

    const interval = setInterval(checkSession, 10000);
    return () => clearInterval(interval);
  }, [attemptId, submitted, sessionConflict]);

  // ----------------------------------------------------------
  // Auto-save (MCQ)
  // ----------------------------------------------------------

  const saveAnswer = useCallback(
    async (questionId: string, selectedOptionIds: string[]) => {
      if (!attemptId) return;

      pendingSavesRef.current.set(questionId, selectedOptionIds);

      // Clear previous timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        const saves = new Map(pendingSavesRef.current);
        pendingSavesRef.current.clear();

        setSaveStatus("saving");

        try {
          for (const [qId, optIds] of saves) {
            const res = await fetch(`/api/attempts/${attemptId}/answers`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                questionId: qId,
                selectedOptionIds: optIds,
              }),
            });

            if (!res.ok) {
              if (res.status === 409) {
                const data = await res.json();
                if (data.error === "SESSION_CONFLICT") {
                  setSessionConflict(true);
                  return;
                }
              }
              console.error("Failed to save answer for question:", qId);
              setSaveStatus("error");
              return;
            }
          }

          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } catch {
          setSaveStatus("error");
        }
      }, 2000);
    },
    [attemptId]
  );

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // ----------------------------------------------------------
  // Answer selection (MCQ)
  // ----------------------------------------------------------

  const handleOptionSelect = useCallback(
    (questionId: string, optionId: string, questionType: string) => {
      setAnswers((prev) => {
        const next = new Map(prev);

        if (questionType === "SINGLE_SELECT" || questionType === "CODING") {
          next.set(questionId, [optionId]);
        } else {
          // MULTI_SELECT: toggle
          const current = next.get(questionId) || [];
          if (current.includes(optionId)) {
            const filtered = current.filter((id) => id !== optionId);
            if (filtered.length === 0) {
              next.delete(questionId);
            } else {
              next.set(questionId, filtered);
            }
          } else {
            next.set(questionId, [...current, optionId]);
          }
        }

        // Trigger auto-save
        const selected = next.get(questionId) || [];
        saveAnswer(questionId, selected);

        return next;
      });
    },
    [saveAnswer]
  );

  // ----------------------------------------------------------
  // Flag for review
  // ----------------------------------------------------------

  const toggleFlag = useCallback((questionId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, []);

  // ----------------------------------------------------------
  // Submit
  // ----------------------------------------------------------

  const handleSubmit = useCallback(
    async (options?: { autoSubmitted?: boolean }) => {
      if (!attemptId || submitting) return;

      setSubmitting(true);
      try {
        // Flush any pending saves first
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        // Save any remaining pending MCQ answers immediately
        for (const [qId, optIds] of pendingSavesRef.current) {
          await fetch(`/api/attempts/${attemptId}/answers`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              questionId: qId,
              selectedOptionIds: optIds,
            }),
          });
        }
        pendingSavesRef.current.clear();

        const res = await fetch(`/api/tests/${testId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            autoSubmitted: options?.autoSubmitted ?? false,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          if (data.error === "SESSION_CONFLICT") {
            setSessionConflict(true);
            setSubmitting(false);
            return;
          }
          setError(data.error || "Failed to submit test.");
          setSubmitting(false);
          return;
        }

        await res.json();
        setSubmitted(true);
        setShowSubmitDialog(false);

        // Short delay then redirect to dashboard
        setTimeout(() => {
          router.push("/student");
        }, 1500);
      } catch {
        setError("Failed to submit. Please try again.");
        setSubmitting(false);
      }
    },
    [attemptId, testId, submitting, router]
  );

  const handleAutoSubmit = useCallback(() => {
    if (submitted || submitting) return;
    handleSubmit();
  }, [submitted, submitting, handleSubmit]);

  // Auto-submit triggered by proctoring violations
  useEffect(() => {
    if (autoSubmittedByViolation && !submitted && !submitting) {
      handleSubmit({ autoSubmitted: true });
    }
  }, [autoSubmittedByViolation, submitted, submitting, handleSubmit]);

  // ----------------------------------------------------------
  // Computed values
  // ----------------------------------------------------------

  const currentQuestion = questions[currentIndex];

  const answeredCount = answers.size;
  const unansweredCount = questions.length - answeredCount;
  const flaggedCount = flagged.size;

  const isQuestionAnswered = (q: Question) => answers.has(q.id);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // ----------------------------------------------------------
  // Session conflict state
  // ----------------------------------------------------------

  if (sessionConflict) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center space-y-4">
            <MonitorX className="mx-auto size-12 text-destructive" />
            <h2 className="text-lg font-semibold">Session Active on Another Device</h2>
            <p className="text-muted-foreground text-sm">
              This test is currently active on another device or browser tab.
              Only one active session is allowed at a time.
            </p>
            <p className="text-muted-foreground text-xs">
              If you want to continue here, close the test on the other device and reload this page.
            </p>
            <Button onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="size-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading test...</p>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Error state
  // ----------------------------------------------------------

  if (error && !submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center space-y-4">
            <AlertCircle className="mx-auto size-12 text-destructive" />
            <h2 className="text-lg font-semibold">Cannot start test</h2>
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button onClick={() => router.push("/student/tests")}>
              Back to Tests
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Submitted state
  // ----------------------------------------------------------

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle className="mx-auto size-12 text-green-500" />
            <h2 className="text-xl font-semibold">
              {autoSubmittedByViolation
                ? "Test Auto-Submitted Due to Violations"
                : "Test Submitted Successfully!"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {autoSubmittedByViolation
                ? "You exceeded the maximum allowed violations. Your answers have been recorded."
                : "Your answers have been recorded. Redirecting to dashboard..."}
            </p>
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----------------------------------------------------------
  // No questions
  // ----------------------------------------------------------

  if (questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center space-y-4">
            <AlertCircle className="mx-auto size-12 text-yellow-500" />
            <h2 className="text-lg font-semibold">No questions found</h2>
            <p className="text-muted-foreground text-sm">
              This test does not have any questions yet.
            </p>
            <Button onClick={() => router.push("/student/tests")}>
              Back to Tests
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Main test interface
  // ----------------------------------------------------------

  const isTimeLow =
    remainingSeconds !== null && remainingSeconds < 300; // < 5 min

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      {/* ── Fullscreen prompt overlay ── */}
      {proctoringConfig?.enableFullscreenDetection && !isFullscreen && attemptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-lg bg-background p-8 shadow-lg text-center max-w-sm">
            <Maximize className="size-10 text-primary" />
            <h2 className="text-lg font-semibold">Fullscreen Required</h2>
            <p className="text-sm text-muted-foreground">
              This test requires fullscreen mode. Click the button below to enter fullscreen and continue.
            </p>
            <Button size="lg" onClick={enterFullscreen}>
              Enter Fullscreen
            </Button>
          </div>
        </div>
      )}

      {/* ── Top Bar ── */}
      <header className="flex items-center justify-between border-b bg-background px-5 py-2.5 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-semibold truncate max-w-[260px]">
            {testTitle}
          </h1>
          <span className="hidden sm:inline-flex text-xs text-muted-foreground">
            {totalMarks} marks
          </span>

          {/* Save indicator */}
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            {saveStatus === "saving" && (
              <>
                <Loader2 className="size-3 animate-spin" />
                <span>Saving</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <CheckCircle className="size-3 text-green-500" />
                <span>Saved</span>
              </>
            )}
            {saveStatus === "error" && (
              <>
                <AlertCircle className="size-3 text-destructive" />
                <span>Error</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Violation count */}
          {violations.totalViolations > 0 && (
            <div className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
              <ShieldAlert className="size-3.5" />
              {violations.totalViolations}{maxViolations > 0 ? `/${maxViolations}` : ""}
            </div>
          )}

          {/* Dark mode toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Timer */}
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-3 py-1 font-mono text-sm tabular-nums font-semibold tracking-tight",
              isTimeLow
                ? "border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400"
                : "border-border bg-muted/50 text-foreground"
            )}
          >
            <Clock
              className={cn(
                "size-3.5",
                isTimeLow ? "text-red-500 animate-pulse" : "text-muted-foreground"
              )}
            />
            {remainingSeconds !== null ? formatTime(remainingSeconds) : "--:--"}
          </div>
        </div>
      </header>

      {/* ── Violation Banner ── */}
      <ViolationBanner
        totalViolations={violations.totalViolations}
        maxViolations={maxViolations}
        lastWarning={warningMessage}
      />

      {/* ── Main Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Question Area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {currentQuestion && (
              <div className="max-w-2xl mx-auto px-6 py-8">
                {/* Question meta row */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-xs text-muted-foreground">
                    {currentQuestion.marks} mark{currentQuestion.marks !== 1 ? "s" : ""}
                  </span>
                  {currentQuestion.questionType === "MULTI_SELECT" && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        Select multiple
                      </span>
                    </>
                  )}
                  {currentQuestion.questionType === "CODING" && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <Code2 className="size-3" />
                        Coding
                      </span>
                    </>
                  )}
                </div>

                {/* Question content: header + code + images */}
                <QuestionContent
                  questionText={currentQuestion.questionText}
                  codeBlock={currentQuestion.codeBlock}
                  codeLanguage={currentQuestion.codeLanguage}
                  imageUrl={currentQuestion.imageUrl}
                  imageUrls={currentQuestion.imageUrls}
                  className="mb-4 [&_p]:text-xl [&_p]:font-semibold text-xl font-semibold leading-relaxed text-foreground"
                />

                {/* MCQ Options */}
                {currentQuestion.options.length > 0 && (
                  <>
                    <div className="space-y-2.5">
                      {currentQuestion.options.map((option, optIdx) => {
                        const selectedIds =
                          answers.get(currentQuestion.id) || [];
                        const isSelected = selectedIds.includes(option.id);

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() =>
                              handleOptionSelect(
                                currentQuestion.id,
                                option.id,
                                currentQuestion.questionType
                              )
                            }
                            className={cn(
                              "flex w-full items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left text-sm transition-all duration-150",
                              isSelected
                                ? "border-primary/60 bg-primary/[0.06] shadow-sm shadow-primary/10"
                                : "border-border bg-background hover:border-border hover:bg-accent/50"
                            )}
                          >
                            {/* Letter badge */}
                            <div
                              className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition-colors",
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {String.fromCharCode(65 + optIdx)}
                            </div>
                            <span className={cn(
                              "flex-1",
                              isSelected ? "text-foreground font-medium" : "text-foreground/80"
                            )}>
                              <QuestionText inline>{option.text}</QuestionText>
                            </span>
                            {/* Selection indicator */}
                            {isSelected && (
                              <CheckCircle className="size-4 shrink-0 text-primary" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Clear answer */}
                    {answers.has(currentQuestion.id) && (
                      <button
                        type="button"
                        className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => {
                          setAnswers((prev) => {
                            const next = new Map(prev);
                            next.delete(currentQuestion.id);
                            saveAnswer(currentQuestion.id, []);
                            return next;
                          });
                        }}
                      >
                        Clear selection
                      </button>
                    )}
                  </>
                )}

              </div>
            )}
          </div>

          {/* ── Bottom Navigation ── */}
          <div className="flex items-center justify-between border-t bg-background px-5 py-2.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={currentIndex === 0}
                onClick={() => {
                  setCurrentIndex((i) => Math.max(0, i - 1));
                }}
                className="h-9 px-3 text-xs"
              >
                <ChevronLeft className="size-3.5 mr-1" />
                Previous
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {currentQuestion && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleFlag(currentQuestion.id)}
                  className={cn(
                    "h-9 px-3 text-xs",
                    flagged.has(currentQuestion.id) && "text-orange-600 dark:text-orange-400"
                  )}
                >
                  <Flag
                    className={cn(
                      "size-3.5 mr-1.5",
                      flagged.has(currentQuestion.id)
                        ? "fill-orange-500 text-orange-500"
                        : "text-muted-foreground"
                    )}
                  />
                  {flagged.has(currentQuestion.id) ? "Flagged" : "Flag"}
                </Button>
              )}

              {currentIndex < questions.length - 1 ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setCurrentIndex((i) => Math.min(questions.length - 1, i + 1));
                  }}
                  className="h-9 px-4 text-xs font-semibold"
                >
                  Next
                  <ChevronRight className="size-3.5 ml-1" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setShowSubmitDialog(true)}
                  className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Send className="size-3.5 mr-1.5" />
                  Submit Test
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div className="hidden md:flex w-[260px] flex-col border-l bg-background shrink-0">
          {/* Question grid */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Questions
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {answeredCount}/{questions.length}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1 rounded-full bg-muted mb-4 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
              />
            </div>

            <div className="grid grid-cols-6 gap-1.5">
              {questions.map((q, idx) => {
                const isAnswered = isQuestionAnswered(q);
                const isFlagged = flagged.has(q.id);
                const isCurrent = idx === currentIndex;
                const isCoding = q.questionType === "CODING";

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      "relative flex size-9 items-center justify-center rounded-lg text-xs font-medium transition-all duration-150",
                      isCurrent
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "hover:ring-1 hover:ring-border",
                      isFlagged
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                        : isAnswered
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : isCoding
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                            : "bg-muted text-muted-foreground"
                    )}
                    title={`Question ${idx + 1}${isCoding ? " (coding)" : ""}${isFlagged ? " (flagged)" : ""}${isAnswered ? " (answered)" : ""}`}
                  >
                    {idx + 1}
                    {/* Flag dot */}
                    {isFlagged && (
                      <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-orange-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Summary */}
          <div className="p-4 space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Answered
                </span>
                <span className="font-medium tabular-nums">{answeredCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="size-2 rounded-full bg-muted-foreground/30" />
                  Unanswered
                </span>
                <span className="font-medium tabular-nums">{unansweredCount}</span>
              </div>
              {flaggedCount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-2 rounded-full bg-orange-500" />
                    Flagged
                  </span>
                  <span className="font-medium tabular-nums">{flaggedCount}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Submit Dialog ── */}
      <SubmitDialog
        open={showSubmitDialog}
        onOpenChange={setShowSubmitDialog}
        onConfirm={handleSubmit}
        answeredCount={answeredCount}
        unansweredCount={unansweredCount}
        flaggedCount={flaggedCount}
        loading={submitting}
      />
    </div>
  );
}
