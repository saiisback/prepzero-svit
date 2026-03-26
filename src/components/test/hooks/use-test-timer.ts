"use client";

import { useState, useEffect } from "react";

interface UseTestTimerOptions {
  startedAt: Date | null;
  durationMinutes: number;
  submitted: boolean;
  onExpire: () => void;
}

export function useTestTimer({
  startedAt,
  durationMinutes,
  submitted,
  onExpire,
}: UseTestTimerOptions) {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

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
        onExpire();
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt, durationMinutes, submitted, onExpire]);

  const isExpired = remainingSeconds === 0;
  const isTimeLow = remainingSeconds !== null && remainingSeconds < 300;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return { remainingSeconds, isExpired, isTimeLow, formatTime };
}
