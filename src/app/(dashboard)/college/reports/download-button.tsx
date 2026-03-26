"use client";

import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function DownloadButton({
  testId,
  testTitle,
}: {
  testId: string;
  testTitle: string;
}) {
  const { refetch, isFetching } = trpc.report.download.useQuery(
    { testId },
    {
      enabled: false,
    }
  );

  async function handleDownload() {
    const { data, error } = await refetch();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data) {
      toast.error("Failed to download report");
      return;
    }

    const blob = new Blob([data.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      data.filename ||
      `${testTitle.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_")}_report.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Report downloaded successfully");
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={isFetching}
    >
      {isFetching ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <Download className="mr-2 size-4" />
      )}
      {isFetching ? "Exporting..." : "CSV"}
    </Button>
  );
}
