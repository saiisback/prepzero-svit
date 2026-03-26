"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { trpc } from "@/lib/trpc";

interface RetakeButtonProps {
  attemptId: string;
  studentName: string;
}

export function RetakeButton({ attemptId, studentName }: RetakeButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const deleteAttempt = trpc.attempt.delete.useMutation({
    onSuccess: () => {
      toast.success(`Retake allowed for ${studentName}`);
      setOpen(false);
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <RotateCcw className="mr-1 size-4" />
        Allow Retake
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Allow retake?</AlertDialogTitle>
          <AlertDialogDescription>
            This will delete <strong>{studentName}&apos;s</strong> current
            attempt and score. They will be able to take the test again from
            scratch. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteAttempt.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteAttempt.mutate({ id: attemptId })}
            disabled={deleteAttempt.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteAttempt.isPending ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-1 size-4" />
            )}
            Allow Retake
          </AlertDialogAction>
        </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
