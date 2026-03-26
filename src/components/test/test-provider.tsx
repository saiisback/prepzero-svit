"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useTestTimer } from "./hooks/use-test-timer";
import { useTestAnswers } from "./hooks/use-test-answers";
import { useTestViolations } from "./hooks/use-test-violations";
import { useTestNavigation } from "./hooks/use-test-navigation";
import type { ViolationCounts, ProctoringConfig } from "@/hooks/use-proctoring";

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
// Context value type
// ---------------------------------------------------------------------------

interface TestContextValue {
  // Test metadata
  testId: string;
  testTitle: string;
  totalMarks: number;
  questions: Question[];
  attemptId: string | null;

  // Loading / error / submission states
  loading: boolean;
  error: string | null;
  submitted: boolean;
  submitting: boolean;
  sessionConflict: boolean;

  // Timer
  remainingSeconds: number | null;
  isTimeLow: boolean;
  isExpired: boolean;
  formatTime: (seconds: number) => string;

  // Navigation
  currentIndex: number;
  currentQuestion: Question | undefined;
  flagged: Set<string>;
  flaggedCount: number;
  goNext: () => void;
  goPrev: () => void;
  goToQuestion: (index: number) => void;
  toggleFlag: (questionId: string) => void;
  isFirst: boolean;
  isLast: boolean;

  // Answers
  answers: Map<string, string[]>;
  saveStatus: "idle" | "saving" | "saved" | "error";
  handleOptionSelect: (
    questionId: string,
    optionId: string,
    questionType: string
  ) => void;
  clearAnswer: (questionId: string) => void;
  answeredCount: number;
  unansweredCount: number;

  // Violations / proctoring
  violations: ViolationCounts;
  warningMessage: string | null;
  maxViolations: number;
  isFullscreen: boolean;
  enterFullscreen: () => void;
  autoSubmittedByViolation: boolean;
  proctoringConfig: ProctoringConfig | null;

  // Actions
  handleSubmit: (options?: { autoSubmitted?: boolean }) => Promise<void>;
  showSubmitDialog: boolean;
  setShowSubmitDialog: (open: boolean) => void;
}

const TestContext = createContext<TestContextValue | null>(null);

// ---------------------------------------------------------------------------
// Hook to consume context
// ---------------------------------------------------------------------------

export function useTestContext() {
  const ctx = useContext(TestContext);
  if (!ctx) {
    throw new Error("useTestContext must be used within a <TestProvider>");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface TestProviderProps {
  testId: string;
  children: ReactNode;
}

export function TestProvider({ testId, children }: TestProviderProps) {
  const router = useRouter();

  // ── Core state ──
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [testTitle, setTestTitle] = useState("");
  const [totalMarks, setTotalMarks] = useState(0);

  // ── UI state ──
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [sessionConflict, setSessionConflict] = useState(false);

  // ── Proctoring state ──
  const [initialViolations, setInitialViolations] =
    useState<ViolationCounts | null>(null);
  const [maxViolations, setMaxViolations] = useState(5);
  const [proctoringConfig, setProctoringConfig] =
    useState<ProctoringConfig | null>(null);

  // ── Session conflict handler ──
  const handleSessionConflict = useCallback(() => {
    setSessionConflict(true);
  }, []);

  // ── Answers hook ──
  const {
    answers,
    saveStatus,
    handleOptionSelect,
    clearAnswer,
    flushPendingSaves,
    restoreAnswers,
  } = useTestAnswers({
    attemptId,
    onSessionConflict: handleSessionConflict,
  });

  // ── Navigation hook ──
  const {
    currentIndex,
    flagged,
    flaggedCount,
    goNext,
    goPrev,
    goToQuestion,
    toggleFlag,
    isFirst,
    isLast,
  } = useTestNavigation({ totalQuestions: questions.length });

  // ── Submit handler ──
  const handleSubmit = useCallback(
    async (options?: { autoSubmitted?: boolean }) => {
      if (!attemptId || submitting) return;

      setSubmitting(true);
      try {
        // Flush any pending saves first
        await flushPendingSaves();

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
    [attemptId, testId, submitting, router, flushPendingSaves]
  );

  // ── Timer auto-submit ──
  const handleAutoSubmit = useCallback(() => {
    if (submitted || submitting) return;
    handleSubmit();
  }, [submitted, submitting, handleSubmit]);

  // ── Timer hook ──
  const { remainingSeconds, isExpired, isTimeLow, formatTime } = useTestTimer({
    startedAt,
    durationMinutes,
    submitted,
    onExpire: handleAutoSubmit,
  });

  // ── Violations hook ──
  const {
    violations,
    warningMessage,
    isFullscreen,
    enterFullscreen,
    autoSubmittedByViolation,
  } = useTestViolations({
    attemptId,
    maxViolations,
    initialViolations,
    proctoringConfig,
    submitted,
    submitting,
    onSubmit: handleSubmit,
  });

  // ── Session heartbeat ──
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
          setSessionConflict(true);
        }
      } catch {
        // Network error, skip this check
      }
    };

    const interval = setInterval(checkSession, 10000);
    return () => clearInterval(interval);
  }, [attemptId, submitted, sessionConflict]);

  // ── Initialize: start attempt, fetch questions, restore answers ──
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
          restoreAnswers(detail.answers);

          // Restore violation counts from server
          setInitialViolations({
            tabSwitchCount: detail.tabSwitchCount ?? 0,
            fullscreenExitCount: detail.fullscreenExitCount ?? 0,
            copyPasteAttempts: detail.copyPasteAttempts ?? 0,
            refreshCount: detail.refreshCount ?? 0,
            totalViolations: detail.totalViolations ?? 0,
          });

          // Restore proctoring config from test
          setMaxViolations(
            detail.maxViolations ?? detail.test.maxViolations ?? 5
          );
          setProctoringConfig({
            enableTabSwitchDetection:
              detail.test.enableTabSwitchDetection ?? true,
            enableFullscreenDetection:
              detail.test.enableFullscreenDetection ?? true,
            enableCopyPasteDetection:
              detail.test.enableCopyPasteDetection ?? true,
            enableRefreshDetection:
              detail.test.enableRefreshDetection ?? true,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  // ── Computed ──
  const currentQuestion = questions[currentIndex];
  const answeredCount = answers.size;
  const unansweredCount = questions.length - answeredCount;

  // ── Context value ──
  const value: TestContextValue = {
    testId,
    testTitle,
    totalMarks,
    questions,
    attemptId,

    loading,
    error,
    submitted,
    submitting,
    sessionConflict,

    remainingSeconds,
    isTimeLow,
    isExpired,
    formatTime,

    currentIndex,
    currentQuestion,
    flagged,
    flaggedCount,
    goNext,
    goPrev,
    goToQuestion,
    toggleFlag,
    isFirst,
    isLast,

    answers,
    saveStatus,
    handleOptionSelect,
    clearAnswer,
    answeredCount,
    unansweredCount,

    violations,
    warningMessage,
    maxViolations,
    isFullscreen,
    enterFullscreen,
    autoSubmittedByViolation,
    proctoringConfig,

    handleSubmit,
    showSubmitDialog,
    setShowSubmitDialog,
  };

  return <TestContext.Provider value={value}>{children}</TestContext.Provider>;
}
