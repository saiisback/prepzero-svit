import { cn } from "@/lib/utils";

type DriveStatus = "DRAFT" | "UPCOMING" | "ACTIVE" | "COMPLETED" | "CANCELLED";

const statusConfig: Record<
  DriveStatus,
  { label: string; dotClass: string; bgClass: string; textClass: string }
> = {
  DRAFT:     { label: "Draft",     dotClass: "bg-gray-400",    bgClass: "bg-gray-100 dark:bg-gray-800/50",     textClass: "text-gray-600 dark:text-gray-400" },
  UPCOMING:  { label: "Upcoming",  dotClass: "bg-blue-500",    bgClass: "bg-blue-50 dark:bg-blue-950/50",      textClass: "text-blue-700 dark:text-blue-400" },
  ACTIVE:    { label: "Active",    dotClass: "bg-emerald-500", bgClass: "bg-emerald-50 dark:bg-emerald-950/50", textClass: "text-emerald-700 dark:text-emerald-400" },
  COMPLETED: { label: "Completed", dotClass: "bg-gray-400",    bgClass: "bg-gray-100 dark:bg-gray-800/50",     textClass: "text-gray-600 dark:text-gray-400" },
  CANCELLED: { label: "Cancelled", dotClass: "bg-red-500",     bgClass: "bg-red-50 dark:bg-red-950/50",        textClass: "text-red-700 dark:text-red-400" },
};

export function DriveStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as DriveStatus] ?? {
    label: status,
    dotClass: "bg-gray-400",
    bgClass: "bg-gray-100 dark:bg-gray-800/50",
    textClass: "text-gray-600 dark:text-gray-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.bgClass,
        config.textClass
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dotClass)} aria-hidden="true" />
      {config.label}
    </span>
  );
}
