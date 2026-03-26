"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useProctoring,
  type ViolationCounts,
  type ProctoringConfig,
} from "@/hooks/use-proctoring";

interface UseTestViolationsOptions {
  attemptId: string | null;
  maxViolations: number;
  initialViolations: ViolationCounts | null;
  proctoringConfig: ProctoringConfig | null;
  submitted: boolean;
  submitting: boolean;
  onSubmit: (options?: { autoSubmitted?: boolean }) => void;
}

export function useTestViolations({
  attemptId,
  maxViolations,
  initialViolations,
  proctoringConfig,
  submitted,
  submitting,
  onSubmit,
}: UseTestViolationsOptions) {
  const [autoSubmittedByViolation, setAutoSubmittedByViolation] =
    useState(false);

  const handleViolationAutoSubmit = useCallback(() => {
    setAutoSubmittedByViolation(true);
  }, []);

  const { violations, warningMessage, isFullscreen, enterFullscreen } =
    useProctoring(
      attemptId,
      maxViolations,
      handleViolationAutoSubmit,
      initialViolations,
      proctoringConfig
    );

  // Auto-submit triggered by proctoring violations
  useEffect(() => {
    if (autoSubmittedByViolation && !submitted && !submitting) {
      onSubmit({ autoSubmitted: true });
    }
  }, [autoSubmittedByViolation, submitted, submitting, onSubmit]);

  return {
    violations,
    warningMessage,
    isFullscreen,
    enterFullscreen,
    autoSubmittedByViolation,
  };
}
