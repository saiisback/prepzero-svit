"use client";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { QuestionText } from "./question-text";
import { cn } from "@/lib/utils";

interface QuestionContentProps {
  questionText: string;
  codeBlock?: string | null;
  codeLanguage?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  className?: string;
}

export function QuestionContent({
  questionText,
  codeBlock,
  codeLanguage,
  imageUrl,
  imageUrls,
  className,
}: QuestionContentProps) {
  // Merge imageUrl (legacy) + imageUrls into a single array
  const allImages: string[] = [];
  if (imageUrls && Array.isArray(imageUrls)) {
    allImages.push(...imageUrls.filter(Boolean));
  }
  if (imageUrl && !allImages.includes(imageUrl)) {
    allImages.push(imageUrl);
  }

  const hasHeader = questionText.trim().length > 0;
  const hasCode = codeBlock && codeBlock.trim().length > 0;
  const hasImages = allImages.length > 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header block — plain text rendered as markdown */}
      {hasHeader && (
        <QuestionText>{questionText}</QuestionText>
      )}

      {/* Code block — syntax highlighted */}
      {hasCode && (
        <SyntaxHighlighter
          style={oneDark}
          language={codeLanguage || "text"}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderRadius: "0.5rem",
            fontSize: "0.8125rem",
            lineHeight: "1.6",
          }}
          codeTagProps={{
            style: { fontFamily: "var(--font-geist-mono), monospace" },
          }}
        >
          {codeBlock!.trim()}
        </SyntaxHighlighter>
      )}

      {/* Images block */}
      {hasImages && (
        <div className="flex flex-wrap gap-3">
          {allImages.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`Question image ${i + 1}`}
              className="max-h-80 max-w-full rounded-md border object-contain"
            />
          ))}
        </div>
      )}
    </div>
  );
}
