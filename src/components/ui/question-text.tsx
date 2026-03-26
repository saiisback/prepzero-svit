"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Auto-detect unformatted code blocks and wrap them in markdown fences
// ---------------------------------------------------------------------------

const CODE_PATTERNS = [
  /\b(import|export)\s+[\w{*"']/,
  /\b(const|let|var)\s+\w+\s*=/,
  /\bfunction\s+\w+\s*\(/,
  /\bclass\s+\w+/,
  /\bdef\s+\w+\s*\(/,
  /\b#include\s*[<"]/,
  /\bpublic\s+(static\s+)?(void|int|String|class)/,
  /\bconsole\.\w+\s*\(/,
  /\bSystem\.out\./,
  /\bprint\s*\(/,
  /\brequire\s*\(/,
  /=>\s*[{(]/,
];

function isLikelyCode(text: string): boolean {
  let matchCount = 0;
  for (const pattern of CODE_PATTERNS) {
    if (pattern.test(text)) matchCount++;
  }
  const semicolonCount = (text.match(/;/g) || []).length;
  return matchCount >= 2 || (matchCount >= 1 && semicolonCount >= 2);
}

function guessLanguage(text: string): string {
  if (/\bimport\b.*\bfrom\b\s*["']/.test(text) || /\bconsole\.\w+/.test(text) || /\bconst\b.*=>/.test(text)) return "javascript";
  if (/\bdef\b\s+\w+.*:/.test(text) || (/\bprint\s*\(/.test(text) && !/System\.out/.test(text))) return "python";
  if (/\b#include\b/.test(text) || /\bstd::/.test(text)) return "cpp";
  if (/\bpublic\s+static\s+void\b/.test(text) || /\bSystem\.out\./.test(text)) return "java";
  return "";
}

/** Insert line breaks before keywords that follow semicolons for readability. */
function formatCode(code: string): string {
  return code.replace(
    /;\s*(import |export |const |let |var |function |class |def |return |if |for |while |try |catch |throw )/g,
    ";\n$1",
  );
}

/**
 * Pre-process text so that paragraphs that look like code (but aren't already
 * inside markdown fences) are wrapped in ``` fences before ReactMarkdown sees them.
 */
function autoDetectCodeBlocks(text: string): string {
  // Already has code fences — leave as-is
  if (/```/.test(text)) return text;

  const paragraphs = text.split(/\n\s*\n/);

  // If the entire text is a single paragraph that looks like code, wrap it all
  if (paragraphs.length === 1) {
    const trimmed = text.trim();
    if (isLikelyCode(trimmed)) {
      const lang = guessLanguage(trimmed);
      const formatted = formatCode(trimmed);
      return "```" + lang + "\n" + formatted + "\n```";
    }
    return text;
  }

  const processed = paragraphs.map((para) => {
    const trimmed = para.trim();
    if (!trimmed) return para;

    if (isLikelyCode(trimmed)) {
      const lang = guessLanguage(trimmed);
      const formatted = formatCode(trimmed);
      return "```" + lang + "\n" + formatted + "\n```";
    }

    return para;
  });

  return processed.join("\n\n");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface QuestionTextProps {
  children: string;
  className?: string;
  /** Render as inline span (for option text, compact contexts) */
  inline?: boolean;
}

export function QuestionText({ children, className, inline }: QuestionTextProps) {
  const processedText = inline ? children : autoDetectCodeBlocks(children);
  if (inline) {
    return (
      <span className={cn("question-text question-text-inline", className)}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <span>{children}</span>,
            code: ({ children }) => (
              <code className="rounded bg-muted px-1.5 py-0.5 text-[0.9em] font-mono text-foreground/90">
                {children}
              </code>
            ),
          }}
        >
          {children}
        </ReactMarkdown>
      </span>
    );
  }

  return (
    <div className={cn("question-text", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Fenced code blocks without a language tag → render as a styled block
          code: ({ className: codeClassName, children: codeChildren, ...props }) => {
            const match = /language-(\w+)/.exec(codeClassName || "");
            const codeString = String(codeChildren).replace(/\n$/, "");

            // Has a language tag from the fence → syntax highlight
            if (match) {
              return (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: "0.75rem 0",
                    borderRadius: "0.5rem",
                    fontSize: "0.8125rem",
                    lineHeight: "1.6",
                  }}
                  codeTagProps={{
                    style: { fontFamily: "var(--font-geist-mono), monospace" },
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              );
            }

            // Block-level code (inside <pre>) without language → still style as code block
            const isBlock = codeString.includes("\n");
            if (isBlock) {
              return (
                <SyntaxHighlighter
                  style={oneDark}
                  language="text"
                  PreTag="div"
                  customStyle={{
                    margin: "0.75rem 0",
                    borderRadius: "0.5rem",
                    fontSize: "0.8125rem",
                    lineHeight: "1.6",
                  }}
                  codeTagProps={{
                    style: { fontFamily: "var(--font-geist-mono), monospace" },
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              );
            }

            // Inline code
            return (
              <code
                className="rounded bg-muted px-1.5 py-0.5 text-[0.9em] font-mono text-foreground/90"
                {...props}
              >
                {codeChildren}
              </code>
            );
          },
          p: ({ children }) => (
            <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
          ),
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold mb-1.5">{children}</h3>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="mb-3 ml-5 list-disc space-y-1 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 ml-5 list-decimal space-y-1 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-primary/40 pl-4 text-muted-foreground italic last:mb-0">
              {children}
            </blockquote>
          ),
          pre: ({ children }) => <>{children}</>,
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto last:mb-0">
              <table className="min-w-full text-sm border-collapse border border-border rounded-lg">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border bg-muted px-3 py-1.5 text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-1.5">{children}</td>
          ),
          hr: () => <hr className="my-3 border-border" />,
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
}
