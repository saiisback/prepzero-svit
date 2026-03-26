"use client";

import { useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type CodingLanguage = "PYTHON" | "JAVA" | "C" | "CPP";

interface TestCase {
  input: string;
  expectedOutput: string;
}

interface TestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string | null;
  passed: boolean;
  stderr: string | null;
  compileError: string | null;
}

interface CodeEditorProps {
  attemptId: string;
  questionId: string;
  sampleTestCases: TestCase[];
  initialCode?: string;
  initialLanguage?: CodingLanguage;
  onCodeChange: (code: string, language: CodingLanguage) => void;
}

const LANGUAGE_LABELS: Record<CodingLanguage, string> = {
  PYTHON: "Python",
  JAVA: "Java",
  C: "C",
  CPP: "C++",
};

const MONACO_LANGUAGE_MAP: Record<CodingLanguage, string> = {
  PYTHON: "python",
  JAVA: "java",
  C: "c",
  CPP: "cpp",
};

const STARTER_CODE: Record<CodingLanguage, string> = {
  PYTHON: `# Read input and write output
# Example: input = input()
# print(result)

`,
  JAVA: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Read input and write output

        sc.close();
    }
}
`,
  C: `#include <stdio.h>

int main() {
    // Read input and write output

    return 0;
}
`,
  CPP: `#include <iostream>
using namespace std;

int main() {
    // Read input and write output

    return 0;
}
`,
};

export function CodeEditor({
  attemptId,
  questionId,
  sampleTestCases,
  initialCode,
  initialLanguage,
  onCodeChange,
}: CodeEditorProps) {
  const [language, setLanguage] = useState<CodingLanguage>(
    initialLanguage || "PYTHON"
  );
  const [code, setCode] = useState(
    initialCode || STARTER_CODE[initialLanguage || "PYTHON"]
  );
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestCaseResult[] | null>(null);

  const handleLanguageChange = useCallback(
    (newLang: CodingLanguage) => {
      setLanguage(newLang);
      // Only reset code if using starter code (no custom code yet)
      if (!initialCode && code === STARTER_CODE[language]) {
        setCode(STARTER_CODE[newLang]);
        onCodeChange(STARTER_CODE[newLang], newLang);
      } else {
        onCodeChange(code, newLang);
      }
    },
    [code, language, initialCode, onCodeChange]
  );

  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      const newCode = value || "";
      setCode(newCode);
      onCodeChange(newCode, language);
    },
    [language, onCodeChange]
  );

  const handleRun = useCallback(async () => {
    setRunning(true);
    setResults(null);

    try {
      const res = await fetch(`/api/attempts/${attemptId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, code, language }),
      });

      if (!res.ok) {
        const data = await res.json();
        setResults(
          sampleTestCases.map((tc) => ({
            ...tc,
            actualOutput: null,
            passed: false,
            stderr: data.error || "Failed to run code",
            compileError: null,
          }))
        );
        return;
      }

      const data = await res.json();
      setResults(data.results);
    } catch {
      setResults(
        sampleTestCases.map((tc) => ({
          ...tc,
          actualOutput: null,
          passed: false,
          stderr: "Network error",
          compileError: null,
        }))
      );
    } finally {
      setRunning(false);
    }
  }, [attemptId, questionId, code, language, sampleTestCases]);

  const passedCount = results?.filter((r) => r.passed).length ?? 0;
  const totalCount = results?.length ?? 0;

  return (
    <div className="space-y-4 monaco-editor-wrapper">
      {/* Language selector + Run button */}
      <div className="flex items-center justify-between">
        <Select value={language} onValueChange={(v) => handleLanguageChange(v as CodingLanguage)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(LANGUAGE_LABELS) as CodingLanguage[]).map((lang) => (
              <SelectItem key={lang} value={lang}>
                {LANGUAGE_LABELS[lang]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          onClick={handleRun}
          disabled={running || !code.trim()}
          className="bg-success hover:bg-success/90"
        >
          {running ? (
            <Loader2 className="size-4 animate-spin mr-1" aria-hidden="true" />
          ) : (
            <Play className="size-4 mr-1" aria-hidden="true" />
          )}
          {running ? "Running..." : "Run Code"}
        </Button>
      </div>

      {/* Monaco Editor */}
      <div className="border rounded-lg overflow-hidden">
        <Editor
          height="400px"
          language={MONACO_LANGUAGE_MAP[language]}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            lineNumbers: "on",
            wordWrap: "on",
            fontSize: 14,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
          }}
        />
      </div>

      {/* Results panel */}
      {results && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">Test Results</h4>
            <Badge
              variant={passedCount === totalCount ? "default" : "destructive"}
              className={
                passedCount === totalCount ? "bg-success" : undefined
              }
            >
              {passedCount}/{totalCount} passed
            </Badge>
          </div>

          {results.map((result, idx) => (
            <div
              key={idx}
              className={cn(
                "rounded-lg border p-3 text-sm space-y-2",
                result.passed
                  ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
                  : "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
              )}
            >
              <div className="flex items-center gap-2">
                {result.passed ? (
                  <CheckCircle className="size-4 text-green-500" aria-hidden="true" />
                ) : (
                  <XCircle className="size-4 text-red-500" aria-hidden="true" />
                )}
                <span className="font-medium">
                  Test Case {idx + 1}: {result.passed ? "Passed" : "Failed"}
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Input</p>
                  <pre className="bg-muted rounded p-2 text-xs whitespace-pre-wrap break-all">
                    {result.input || "(empty)"}
                  </pre>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Expected Output
                  </p>
                  <pre className="bg-muted rounded p-2 text-xs whitespace-pre-wrap break-all">
                    {result.expectedOutput}
                  </pre>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Your Output
                  </p>
                  <pre className="bg-muted rounded p-2 text-xs whitespace-pre-wrap break-all">
                    {result.actualOutput ?? "(no output)"}
                  </pre>
                </div>
              </div>

              {result.compileError && (
                <div>
                  <p className="text-xs text-red-600 font-medium mb-1">
                    Compilation Error
                  </p>
                  <pre className="bg-red-100 dark:bg-red-950/40 rounded p-2 text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-all">
                    {result.compileError}
                  </pre>
                </div>
              )}

              {result.stderr && !result.compileError && (
                <div>
                  <p className="text-xs text-red-600 font-medium mb-1">
                    Stderr
                  </p>
                  <pre className="bg-red-100 dark:bg-red-950/40 rounded p-2 text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-all">
                    {result.stderr}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
