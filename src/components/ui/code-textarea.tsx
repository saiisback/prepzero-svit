"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface CodeTextareaProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  label?: string;
  readOnly?: boolean;
}

export function CodeTextarea({
  value,
  onChange,
  placeholder = "// code here",
  rows = 3,
  className,
  label,
  readOnly = false,
}: CodeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className={cn("rounded-lg overflow-hidden border border-zinc-700 bg-zinc-950 shadow-inner", className)}>
      {label && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-700">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-zinc-600" />
            <span className="size-2.5 rounded-full bg-zinc-600" />
            <span className="size-2.5 rounded-full bg-zinc-600" />
          </div>
          <span className="text-[11px] text-zinc-400 font-mono ml-1">{label}</span>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={readOnly ? undefined : (e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        rows={rows}
        spellCheck={false}
        className={cn(
          "w-full bg-transparent text-zinc-100 font-mono text-sm px-4 py-3 resize-none focus:outline-none placeholder:text-zinc-600 leading-relaxed",
          readOnly && "cursor-default select-text"
        )}
        onKeyDown={readOnly ? undefined : (e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            const el = e.currentTarget;
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const newVal = value.slice(0, start) + "  " + value.slice(end);
            onChange?.(newVal);
            setTimeout(() => el.setSelectionRange(start + 2, start + 2), 0);
          }
        }}
      />
    </div>
  );
}
