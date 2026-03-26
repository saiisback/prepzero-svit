"use client";

import { useState, useCallback, useRef, useEffect } from "react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SavedAnswer {
  questionId: string;
  selectedOptionIds: string[];
  code?: string | null;
  language?: string | null;
}

interface UseTestAnswersOptions {
  attemptId: string | null;
  onSessionConflict: () => void;
}

export function useTestAnswers({
  attemptId,
  onSessionConflict,
}: UseTestAnswersOptions) {
  const [answers, setAnswers] = useState<Map<string, string[]>>(new Map());
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Refs for debounced save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSavesRef = useRef<Map<string, string[]>>(new Map());

  // ----------------------------------------------------------------
  // Save answer to server (debounced)
  // ----------------------------------------------------------------

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
                  onSessionConflict();
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
    [attemptId, onSessionConflict]
  );

  // ----------------------------------------------------------------
  // Flush all pending saves immediately (used before submit)
  // ----------------------------------------------------------------

  const flushPendingSaves = useCallback(async () => {
    if (!attemptId) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

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
  }, [attemptId]);

  // ----------------------------------------------------------------
  // Option selection handler (MCQ)
  // ----------------------------------------------------------------

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

  // ----------------------------------------------------------------
  // Clear answer for a question
  // ----------------------------------------------------------------

  const clearAnswer = useCallback(
    (questionId: string) => {
      setAnswers((prev) => {
        const next = new Map(prev);
        next.delete(questionId);
        saveAnswer(questionId, []);
        return next;
      });
    },
    [saveAnswer]
  );

  // ----------------------------------------------------------------
  // Restore answers from server data
  // ----------------------------------------------------------------

  const restoreAnswers = useCallback((savedAnswers: SavedAnswer[]) => {
    if (savedAnswers && savedAnswers.length > 0) {
      const restored = new Map<string, string[]>();
      for (const ans of savedAnswers) {
        if (ans.selectedOptionIds && ans.selectedOptionIds.length > 0) {
          restored.set(ans.questionId, ans.selectedOptionIds);
        }
      }
      setAnswers(restored);
    }
  }, []);

  // ----------------------------------------------------------------
  // Clean up timeout on unmount
  // ----------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    answers,
    saveStatus,
    saveAnswer,
    handleOptionSelect,
    clearAnswer,
    flushPendingSaves,
    restoreAnswers,
  };
}
