"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeleteCollegeButtonProps {
  collegeId: string;
  collegeName: string;
  userCount: number;
  driveCount: number;
}

export function DeleteCollegeButton({
  collegeId,
  collegeName,
  userCount,
  driveCount,
}: DeleteCollegeButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const deleteCollege = trpc.college.delete.useMutation({
    onSuccess: () => {
      toast.success(`College "${collegeName}" deleted successfully`);
      setOpen(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleDelete() {
    deleteCollege.mutate({
      id: collegeId,
      deleteUsers: confirmDeleteAll,
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setConfirmDeleteAll(false);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Delete ${collegeName}`}>
          <Trash2 className="size-4 text-destructive" aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete college?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                You are about to delete <strong>{collegeName}</strong>. This
                college has the following related data:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>{userCount} user{userCount !== 1 ? "s" : ""} (students &amp; admins)</li>
                <li>{driveCount} placement drive{driveCount !== 1 ? "s" : ""} (and their tests, questions, attempts)</li>
              </ul>
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <Checkbox
                  id="confirm-delete-college"
                  checked={confirmDeleteAll}
                  onCheckedChange={(v) => setConfirmDeleteAll(v === true)}
                />
                <label htmlFor="confirm-delete-college" className="text-sm font-medium leading-tight cursor-pointer">
                  Yes, delete all related data including {userCount} user{userCount !== 1 ? "s" : ""} and {driveCount} drive{driveCount !== 1 ? "s" : ""}. This action cannot be undone.
                </label>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteCollege.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteCollege.isPending || !confirmDeleteAll}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteCollege.isPending ? (
              <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="mr-1 size-4" aria-hidden="true" />
            )}
            Delete Everything
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
