"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViolationBannerProps {
  totalViolations: number;
  maxViolations: number;
  lastWarning: string | null;
}

export function ViolationBanner({
  totalViolations,
  maxViolations,
  lastWarning,
}: ViolationBannerProps) {
  if (totalViolations === 0) return null;

  const isHighRisk = maxViolations > 0 && totalViolations >= maxViolations - 1;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm font-medium shrink-0",
        isHighRisk
          ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300"
      )}
    >
      <AlertTriangle className="size-4 shrink-0" />
      <span>
        {maxViolations > 0
          ? `Warning: ${totalViolations}/${maxViolations} violations detected. Test will auto-submit after ${maxViolations} violations.`
          : `${totalViolations} violation${totalViolations === 1 ? "" : "s"} detected.`}
      </span>
      {lastWarning && (
        <span className="ml-auto text-xs opacity-80">{lastWarning}</span>
      )}
    </div>
  );
}
