import { getServerTrpc } from "@/lib/trpc-server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  MinusCircle,
  Clock,
  Trophy,
  Target,
  Code2,
  Lightbulb,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { QuestionText } from "@/components/ui/question-text";
import { QuestionContent } from "@/components/ui/question-content";

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "N/A";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

const LANGUAGE_LABELS: Record<string, string> = {
  PYTHON: "Python",
  JAVA: "Java",
  C: "C",
  CPP: "C++",
};

export default async function ResultDetailPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const trpc = await getServerTrpc();
  const { attemptId } = await params;

  let attempt;
  try {
    attempt = await trpc.attempt.getById({ id: attemptId });
  } catch {
    notFound();
  }

  if (!attempt) {
    notFound();
  }

  if (attempt.status === "IN_PROGRESS") {
    redirect(`/test/${attempt.testId}/attempt`);
  }

  // Block access if results haven't been released yet
  if (
    attempt.test.resultVisibility === "MANUAL_RELEASE" &&
    !attempt.test.showResults
  ) {
    redirect("/student/results");
  }

  const answerMap = new Map(
    attempt.answers.map((a) => [a.questionId, a])
  );

  const passed =
    attempt.test.passingMarks > 0 &&
    (attempt.score ?? 0) >= attempt.test.passingMarks;
  const failed =
    attempt.test.passingMarks > 0 &&
    (attempt.score ?? 0) < attempt.test.passingMarks;

  const totalQuestions = attempt.test.questions.length;
  const answeredCount = attempt.answers.filter((a) => {
    if (a.question.questionType === "CODING") {
      return !!a.code;
    }
    return (a.selectedOptionIds as string[]).length > 0;
  }).length;
  const correctCount = attempt.answers.filter((a) => a.isCorrect === true).length;
  const incorrectCount = attempt.answers.filter((a) => {
    if (a.question.questionType === "CODING") {
      return a.isCorrect === false && !!a.code;
    }
    return a.isCorrect === false && (a.selectedOptionIds as string[]).length > 0;
  }).length;
  const unansweredCount = totalQuestions - answeredCount;
  const percentage = attempt.percentage !== null ? Math.round(attempt.percentage) : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/student/results">
          <Button variant="ghost" size="icon" className="mt-0.5 size-8 shrink-0">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight truncate">
              {attempt.test.title}
            </h1>
            {passed && (
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-800">
                Passed
              </Badge>
            )}
            {failed && (
              <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800">
                Failed
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {attempt.test.drive.title}
            {attempt.test.drive.companyName
              ? ` \u00b7 ${attempt.test.drive.companyName}`
              : ""}
            {attempt.submittedAt && (
              <>
                {" "}\u00b7 {format(new Date(attempt.submittedAt), "MMM d, yyyy 'at' h:mm a")}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center size-7 rounded-lg bg-amber-500/10">
              <Trophy className="size-3.5 text-amber-500" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Score</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums">{attempt.score ?? 0}</span>
            <span className="text-sm text-muted-foreground">/ {attempt.test.totalMarks}</span>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center size-7 rounded-lg bg-blue-500/10">
              <TrendingUp className="size-3.5 text-blue-500" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Percentage</span>
          </div>
          <span className="text-2xl font-bold tabular-nums">{percentage}%</span>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center size-7 rounded-lg bg-emerald-500/10">
              <Target className="size-3.5 text-emerald-500" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Accuracy</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums">{correctCount}</span>
            <span className="text-sm text-muted-foreground">/ {totalQuestions}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {incorrectCount} wrong \u00b7 {unansweredCount} skipped
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center size-7 rounded-lg bg-violet-500/10">
              <Clock className="size-3.5 text-violet-500" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Time</span>
          </div>
          <span className="text-2xl font-bold tabular-nums">
            {formatDuration(attempt.timeTakenSeconds)}
          </span>
        </div>
      </div>

      {/* Question review */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Question Review
        </h2>
        <div className="space-y-3">
          {attempt.test.questions.map((question, index) => {
            // Cast to full question type — we've verified the attempt is completed,
            // so the router returns unsanitized questions with all fields.
            const fullQuestion = question as typeof question & {
              correctOptionIds: unknown;
              explanation: string | null;
            };
            const answer = answerMap.get(question.id);
            const isCoding = question.questionType === "CODING";
            const selectedIds = answer
              ? (answer.selectedOptionIds as string[])
              : [];
            const correctIds = fullQuestion.correctOptionIds as string[];
            const options = question.options as Array<{
              id: string;
              text: string;
            }>;

            let wasAnswered: boolean;
            if (isCoding) {
              wasAnswered = !!answer?.code;
            } else {
              wasAnswered = selectedIds.length > 0;
            }
            const isCorrect = answer?.isCorrect === true;

            const marksAwarded = answer?.marksAwarded ?? 0;

            return (
              <div
                key={question.id}
                className="rounded-xl border bg-card overflow-hidden"
              >
                {/* Question header */}
                <div className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Status indicator */}
                    <div className={cn(
                      "flex items-center justify-center size-7 rounded-lg shrink-0 mt-0.5",
                      !wasAnswered
                        ? "bg-muted"
                        : isCorrect
                          ? "bg-emerald-500/10"
                          : "bg-red-500/10"
                    )}>
                      {!wasAnswered ? (
                        <MinusCircle className="size-3.5 text-muted-foreground" />
                      ) : isCorrect ? (
                        <CheckCircle className="size-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="size-3.5 text-red-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm leading-relaxed">
                        <span className="text-muted-foreground mr-1.5">Q{index + 1}.</span>
                        <QuestionContent
                          questionText={question.questionText}
                          codeBlock={question.codeBlock}
                          codeLanguage={question.codeLanguage}
                          imageUrl={question.imageUrl}
                          imageUrls={question.imageUrls as string[] | null}
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] text-muted-foreground">
                          {isCoding
                            ? "Coding"
                            : question.questionType === "MULTI_SELECT"
                              ? "Multi Select"
                              : "Single Select"}
                        </span>
                        {isCoding && answer?.language && (
                          <>
                            <span className="text-muted-foreground/30">\u00b7</span>
                            <span className="text-[11px] text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
                              <Code2 className="size-2.5" />
                              {LANGUAGE_LABELS[answer.language] || answer.language}
                            </span>
                          </>
                        )}
                        <span className="text-muted-foreground/30">\u00b7</span>
                        <span className="text-[11px] text-muted-foreground">
                          {question.marks} mark{question.marks !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "text-sm font-semibold tabular-nums shrink-0",
                    !wasAnswered
                      ? "text-muted-foreground"
                      : isCorrect
                        ? "text-emerald-600 dark:text-emerald-400"
                        : marksAwarded < 0
                          ? "text-red-500"
                          : "text-muted-foreground"
                  )}>
                    {marksAwarded > 0 ? "+" : ""}{marksAwarded}
                  </div>
                </div>

                {/* Options / Code */}
                <div className="px-5 pb-4">
                  {/* MCQ Options */}
                  {!isCoding && (
                    <div className="space-y-1.5">
                      {options.map((option, optIdx) => {
                        const isSelected = selectedIds.includes(option.id);
                        const isCorrectOption = correctIds.includes(option.id);

                        return (
                          <div
                            key={option.id}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                              isCorrectOption && isSelected
                                ? "bg-emerald-50 dark:bg-emerald-950/30"
                                : isCorrectOption
                                  ? "bg-emerald-50/60 dark:bg-emerald-950/20"
                                  : isSelected
                                    ? "bg-red-50 dark:bg-red-950/30"
                                    : "bg-muted/40"
                            )}
                          >
                            {/* Letter badge */}
                            <div className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded text-[11px] font-semibold",
                              isCorrectOption
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : isSelected
                                  ? "bg-red-500/15 text-red-600 dark:text-red-400"
                                  : "bg-background text-muted-foreground"
                            )}>
                              {String.fromCharCode(65 + optIdx)}
                            </div>
                            <span className="flex-1 text-sm"><QuestionText inline>{option.text}</QuestionText></span>
                            {isSelected && isCorrectOption && (
                              <CheckCircle className="size-4 shrink-0 text-emerald-500" />
                            )}
                            {isSelected && !isCorrectOption && (
                              <XCircle className="size-4 shrink-0 text-red-500" />
                            )}
                            {!isSelected && isCorrectOption && (
                              <CheckCircle className="size-4 shrink-0 text-emerald-400" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Coding Answer */}
                  {isCoding && (
                    <div className="space-y-3">
                      {answer?.code ? (
                        <pre className="bg-muted/50 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed border">
                          {answer.code}
                        </pre>
                      ) : (
                        <p className="text-sm text-muted-foreground italic py-2">
                          Not attempted
                        </p>
                      )}

                      {wasAnswered && (
                        <div>
                          {isCorrect ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-800 text-xs">
                              All test cases passed
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/10 text-red-600 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-800 text-xs">
                              Some test cases failed
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Explanation */}
                  {fullQuestion.explanation && (
                    <div className="mt-3 rounded-lg bg-muted/50 border border-border/50 p-3.5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Lightbulb className="size-3 text-amber-500" />
                        <span className="text-xs font-medium text-muted-foreground">Explanation</span>
                      </div>
                      <QuestionText className="text-sm text-foreground/80 leading-relaxed">
                        {fullQuestion.explanation}
                      </QuestionText>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
