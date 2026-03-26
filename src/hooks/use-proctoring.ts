"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";

type ViolationType = "TAB_SWITCH" | "FULLSCREEN_EXIT" | "COPY_PASTE" | "REFRESH";

export interface ViolationCounts {
  tabSwitchCount: number;
  fullscreenExitCount: number;
  copyPasteAttempts: number;
  refreshCount: number;
  totalViolations: number;
}

export interface ProctoringConfig {
  enableTabSwitchDetection: boolean;
  enableFullscreenDetection: boolean;
  enableCopyPasteDetection: boolean;
  enableRefreshDetection: boolean;
}

interface UseProctoringReturn {
  violations: ViolationCounts;
  warningMessage: string | null;
  isFullscreen: boolean;
  enterFullscreen: () => void;
}

const VIOLATION_MESSAGES: Record<ViolationType, string> = {
  TAB_SWITCH: "Tab switch detected!",
  FULLSCREEN_EXIT: "Fullscreen exit detected!",
  COPY_PASTE: "Copy/paste attempt detected!",
  REFRESH: "Page refresh detected!",
};

const DEFAULT_CONFIG: ProctoringConfig = {
  enableTabSwitchDetection: true,
  enableFullscreenDetection: true,
  enableCopyPasteDetection: true,
  enableRefreshDetection: true,
};

export function useProctoring(
  attemptId: string | null,
  maxViolations: number,
  onAutoSubmit: () => void,
  initialViolations?: ViolationCounts | null,
  config?: ProctoringConfig | null
): UseProctoringReturn {
  const proctoringConfig = config ?? DEFAULT_CONFIG;

  const [violations, setViolations] = useState<ViolationCounts>({
    tabSwitchCount: 0,
    fullscreenExitCount: 0,
    copyPasteAttempts: 0,
    refreshCount: 0,
    totalViolations: 0,
  });
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Refs to avoid stale closures
  const violationsRef = useRef(violations);
  violationsRef.current = violations;
  const autoSubmitCalledRef = useRef(false);
  const onAutoSubmitRef = useRef(onAutoSubmit);
  onAutoSubmitRef.current = onAutoSubmit;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const configRef = useRef(proctoringConfig);
  configRef.current = proctoringConfig;
  // Track whether fullscreen was ever successfully entered
  // Only count FULLSCREEN_EXIT violations after user has been in fullscreen
  const fullscreenEnteredRef = useRef(false);

  // Restore violations from server when initial data is provided
  const initialRestoredRef = useRef(false);
  useEffect(() => {
    if (initialViolations && !initialRestoredRef.current) {
      initialRestoredRef.current = true;

      // Update the ref immediately so reportViolation reads correct values
      violationsRef.current = initialViolations;
      setViolations(initialViolations);

      if (maxViolations > 0 && initialViolations.totalViolations >= maxViolations && !autoSubmitCalledRef.current) {
        autoSubmitCalledRef.current = true;
        onAutoSubmitRef.current();
      }
    }
  }, [initialViolations, maxViolations]);

  const reportViolation = useCallback(
    async (type: ViolationType) => {
      if (!attemptId || autoSubmitCalledRef.current) return;

      // Read from ref which is always up-to-date (including after restore)
      const current = violationsRef.current;
      const newTotal = current.totalViolations + 1;

      // Optimistic update using functional form to avoid stale state
      const updated: ViolationCounts = {
        tabSwitchCount:
          type === "TAB_SWITCH" ? current.tabSwitchCount + 1 : current.tabSwitchCount,
        fullscreenExitCount:
          type === "FULLSCREEN_EXIT"
            ? current.fullscreenExitCount + 1
            : current.fullscreenExitCount,
        copyPasteAttempts:
          type === "COPY_PASTE"
            ? current.copyPasteAttempts + 1
            : current.copyPasteAttempts,
        refreshCount:
          type === "REFRESH" ? current.refreshCount + 1 : current.refreshCount,
        totalViolations: newTotal,
      };

      // Update both ref and state atomically
      violationsRef.current = updated;
      setViolations(updated);

      setWarningMessage(VIOLATION_MESSAGES[type]);

      // maxViolations === 0 means unlimited — no auto-submit
      if (maxViolations > 0) {
        const remaining = maxViolations - newTotal;

        if (remaining > 0) {
          toast.warning(VIOLATION_MESSAGES[type], {
            description: `${remaining} violation${remaining === 1 ? "" : "s"} remaining before auto-submit.`,
            duration: 4000,
          });
        } else {
          toast.error("Maximum violations exceeded!", {
            description: "Your test is being auto-submitted.",
            duration: 5000,
          });
        }
      } else {
        toast.warning(VIOLATION_MESSAGES[type], { duration: 3000 });
      }

      // Send to API
      try {
        await fetch(`/api/attempts/${attemptId}/violations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type }),
        });
      } catch {
        // Violation already counted optimistically
      }

      // Auto-submit if max exceeded (skip if maxViolations is 0 = unlimited)
      if (maxViolations > 0 && newTotal >= maxViolations && !autoSubmitCalledRef.current) {
        autoSubmitCalledRef.current = true;
        onAutoSubmitRef.current();
      }
    },
    [attemptId, maxViolations]
  );

  // Detect refresh: on mount, if attempt already has answers or violations, it's a refresh
  const refreshDetectedRef = useRef(false);
  useEffect(() => {
    if (
      !attemptId ||
      !initialViolations ||
      refreshDetectedRef.current ||
      !configRef.current.enableRefreshDetection
    )
      return;

    // Only count as refresh if this is a resumed session (violations or answers existed)
    // The initialViolations are set after the attempt detail is fetched,
    // so if we reach here it means the page just loaded with an existing attempt
    refreshDetectedRef.current = true;

    // Use sessionStorage to track if this is the first load vs a refresh
    const storageKey = `test_session_${attemptId}`;
    const hasSession = sessionStorage.getItem(storageKey);

    if (hasSession) {
      // This is a refresh — the session key already existed
      reportViolation("REFRESH");
    }

    // Mark this session
    sessionStorage.setItem(storageKey, "1");
  }, [attemptId, initialViolations, reportViolation]);

  useEffect(() => {
    if (!attemptId) return;

    const cfg = configRef.current;

    // --- Tab switch detection ---
    const handleVisibilityChange = () => {
      if (document.hidden && configRef.current.enableTabSwitchDetection) {
        reportViolation("TAB_SWITCH");
      }
    };

    // --- Fullscreen enforcement ---
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        // Successfully entered fullscreen
        fullscreenEnteredRef.current = true;
        setIsFullscreen(true);
      } else {
        setIsFullscreen(false);
        // Only count violation if fullscreen was previously entered
        // This prevents false violations when browser rejects requestFullscreen
        if (fullscreenEnteredRef.current && configRef.current.enableFullscreenDetection) {
          reportViolation("FULLSCREEN_EXIT");
          // Re-request fullscreen after a short delay (e.g. F11 exit)
          setTimeout(() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen?.().catch(() => {});
            }
          }, 500);
        }
      }
    };

    // --- Copy/paste blocking ---
    const handleCopyPaste = (e: Event) => {
      if (!configRef.current.enableCopyPasteDetection) return;
      // Allow copy/paste within Monaco editor
      const target = e.target as HTMLElement;
      if (target?.closest?.(".monaco-editor")) return;

      e.preventDefault();
      reportViolation("COPY_PASTE");
    };

    // --- Right-click disable ---
    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    // --- Keyboard shortcut blocking ---
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block all function keys (F1-F12) before anything else
      // F11 needs special handling — browsers may not honor preventDefault for it,
      // but we block it here and handle fullscreen re-entry via fullscreenchange
      if (/^F([1-9]|1[0-2])$/.test(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Allow keyboard shortcuts within Monaco editor
      const target = e.target as HTMLElement;
      if (target?.closest?.(".monaco-editor")) return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Block: Ctrl+C, Ctrl+V, Ctrl+A, Ctrl+U, Ctrl+Shift+I
      if (ctrl && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        if (configRef.current.enableCopyPasteDetection) reportViolation("COPY_PASTE");
        return;
      }
      if (ctrl && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        if (configRef.current.enableCopyPasteDetection) reportViolation("COPY_PASTE");
        return;
      }
      if (ctrl && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        return;
      }
      if (ctrl && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
        return;
      }
      if (ctrl && e.shiftKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        return;
      }
    };

    // Register listeners based on config
    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (cfg.enableFullscreenDetection) {
      document.addEventListener("fullscreenchange", handleFullscreenChange);
    }
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("cut", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);
    document.addEventListener("contextmenu", handleContextMenu);
    // Use capture phase to intercept F11 before browser handles it
    document.addEventListener("keydown", handleKeyDown, true);

    // Cleanup
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("cut", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown, true);

      // Exit fullscreen on unmount
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, [attemptId, reportViolation]);

  const enterFullscreen = useCallback(() => {
    const elem = document.documentElement;
    if (!document.fullscreenElement) {
      elem.requestFullscreen?.().catch(() => {
        // Browser may block if not triggered by user gesture
      });
    }
  }, []);

  return { violations, warningMessage, isFullscreen, enterFullscreen };
}
