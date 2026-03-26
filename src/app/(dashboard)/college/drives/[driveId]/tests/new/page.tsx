"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Clock, Loader2, ShieldAlert } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

function formatEndTime(startLocal: string, durationMins: number): string | null {
  if (!startLocal || durationMins <= 0) return null;
  const end = new Date(new Date(startLocal).getTime() + durationMins * 60000);
  return end.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function NewTestPage() {
  const params = useParams<{ driveId: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [status, setStatus] = useState("DRAFT");
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [resultVisibility, setResultVisibility] = useState("AFTER_SUBMISSION");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [maxViolations, setMaxViolations] = useState(5);
  const [enableTabSwitch, setEnableTabSwitch] = useState(true);
  const [enableFullscreen, setEnableFullscreen] = useState(true);
  const [enableCopyPaste, setEnableCopyPaste] = useState(true);
  const [enableRefresh, setEnableRefresh] = useState(true);

  const computedEndTime = formatEndTime(startTime, durationMinutes);

  const createTest = trpc.test.create.useMutation({
    onSuccess: () => {
      toast.success("Test created successfully");
      utils.test.list.invalidate({ driveId: params.driveId });
      router.push(`/college/drives/${params.driveId}`);
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong");
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    createTest.mutate({
      driveId: params.driveId,
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || undefined,
      instructions: (formData.get("instructions") as string) || undefined,
      durationMinutes,
      passingMarks: parseInt(formData.get("passingMarks") as string) || 0,
      shuffleQuestions,
      status: status as "DRAFT" | "PUBLISHED" | "CLOSED",
      resultVisibility: resultVisibility as "AFTER_SUBMISSION" | "MANUAL_RELEASE",
      startTime: startTime ? new Date(startTime).toISOString() : undefined,
      endTime: startTime
        ? new Date(new Date(startTime).getTime() + durationMinutes * 60000).toISOString()
        : undefined,
      maxViolations,
      enableTabSwitchDetection: enableTabSwitch,
      enableFullscreenDetection: enableFullscreen,
      enableCopyPasteDetection: enableCopyPaste,
      enableRefreshDetection: enableRefresh,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href={`/college/drives/${params.driveId}`}>
            <ArrowLeft />
            Back to Drive
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-balance">Create Test</h1>
        <p className="text-muted-foreground">
          Add a new test to this placement drive.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Test Details</CardTitle>
          <CardDescription>
            Fill in the information below to create a new test.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                name="title"
                placeholder="e.g. Aptitude Test Round 1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Brief description of the test"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                name="instructions"
                placeholder="Instructions for students taking this test"
                rows={4}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Date & Time</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="durationMinutes">Duration (minutes)</Label>
                <Input
                  id="durationMinutes"
                  name="durationMinutes"
                  inputMode="numeric"
                  value={durationMinutes}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setDurationMinutes(v === "" ? 0 : parseInt(v));
                  }}
                />
              </div>
            </div>

            {computedEndTime && (
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Clock className="size-4 shrink-0" />
                Test ends at: <span className="font-medium text-foreground">{computedEndTime}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="passingMarks">Passing Marks</Label>
              <Input
                id="passingMarks"
                name="passingMarks"
                type="number"
                min={0}
                defaultValue={0}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Switch
                id="shuffleQuestions"
                checked={shuffleQuestions}
                onCheckedChange={setShuffleQuestions}
              />
              <Label htmlFor="shuffleQuestions">Shuffle questions</Label>
            </div>

            {/* Proctoring Configuration */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Proctoring Settings</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxViolations">Max Violations (auto-submit after)</Label>
                <Input
                  id="maxViolations"
                  inputMode="numeric"
                  value={maxViolations}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setMaxViolations(v === "" ? 0 : parseInt(v));
                  }}
                  className="w-32"
                />
                {maxViolations === 0 && (
                  <p className="text-xs text-muted-foreground">0 = unlimited violations (no auto-submit)</p>
                )}
              </div>

              <div className="space-y-2.5">
                <Label className="text-xs text-muted-foreground">Violation types to track</Label>
                <div className="flex items-center gap-2">
                  <Checkbox id="v-tab" checked={enableTabSwitch} onCheckedChange={(v) => setEnableTabSwitch(!!v)} />
                  <Label htmlFor="v-tab" className="text-sm font-normal">Tab switch detection</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="v-fs" checked={enableFullscreen} onCheckedChange={(v) => setEnableFullscreen(!!v)} />
                  <Label htmlFor="v-fs" className="text-sm font-normal">Fullscreen exit detection</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="v-cp" checked={enableCopyPaste} onCheckedChange={(v) => setEnableCopyPaste(!!v)} />
                  <Label htmlFor="v-cp" className="text-sm font-normal">Copy/paste detection</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="v-rf" checked={enableRefresh} onCheckedChange={(v) => setEnableRefresh(!!v)} />
                  <Label htmlFor="v-rf" className="text-sm font-normal">Page refresh detection</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resultVisibility">Result Visibility</Label>
              <Select value={resultVisibility} onValueChange={setResultVisibility}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AFTER_SUBMISSION">Immediately after submission</SelectItem>
                  <SelectItem value="MANUAL_RELEASE">Manually released by admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={createTest.isPending}>
                {createTest.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Create Test
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/college/drives/${params.driveId}`}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
