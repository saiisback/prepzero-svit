"use client";

import { Button } from "@/components/ui/button";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function EmailButton({ testId }: { testId: string }) {
  const sendEmail = trpc.report.sendEmail.useMutation({
    onSuccess: () => {
      toast.success("Report sent to your email");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => sendEmail.mutate({ testId })}
      disabled={sendEmail.isPending}
    >
      {sendEmail.isPending ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <Mail className="mr-2 size-4" />
      )}
      {sendEmail.isPending ? "Sending..." : "Email"}
    </Button>
  );
}
