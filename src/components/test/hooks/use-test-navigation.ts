"use client";

import { useState, useCallback } from "react";

interface UseTestNavigationOptions {
  totalQuestions: number;
}

export function useTestNavigation({ totalQuestions }: UseTestNavigationOptions) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(totalQuestions - 1, i + 1));
  }, [totalQuestions]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const goToQuestion = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

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

  const isFirst = currentIndex === 0;
  const isLast = totalQuestions > 0 && currentIndex === totalQuestions - 1;
  const flaggedCount = flagged.size;

  return {
    currentIndex,
    setCurrentIndex,
    flagged,
    flaggedCount,
    goNext,
    goPrev,
    goToQuestion,
    toggleFlag,
    isFirst,
    isLast,
  };
}
