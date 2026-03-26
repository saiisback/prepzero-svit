"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle, AlertTriangle, Flag, Loader2 } from "lucide-react";

interface SubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  answeredCount: number;
  unansweredCount: number;
  flaggedCount: number;
  loading: boolean;
}

export function SubmitDialog({
  open,
  onOpenChange,
  onConfirm,
  answeredCount,
  unansweredCount,
  flaggedCount,
  loading,
}: SubmitDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Submit Test?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to submit this test? You cannot change your
            answers after submission.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle className="size-4 text-green-500" />
            <span>
              <span className="font-medium">{answeredCount}</span> question
              {answeredCount !== 1 ? "s" : ""} answered
            </span>
          </div>
          {unansweredCount > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <AlertTriangle className="size-4 text-yellow-500" />
              <span>
                <span className="font-medium">{unansweredCount}</span> question
                {unansweredCount !== 1 ? "s" : ""} unanswered
              </span>
            </div>
          )}
          {flaggedCount > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <Flag className="size-4 text-orange-500" />
              <span>
                <span className="font-medium">{flaggedCount}</span> question
                {flaggedCount !== 1 ? "s" : ""} marked for review
              </span>
            </div>
          )}
        </div>

        {(unansweredCount > 0 || flaggedCount > 0) && (
          <p className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 rounded-md p-3">
            You still have unanswered or flagged questions. Consider reviewing
            them before submitting.
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Go Back</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className="bg-success hover:bg-success/90"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Test"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
