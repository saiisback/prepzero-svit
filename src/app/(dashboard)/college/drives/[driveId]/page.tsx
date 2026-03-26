"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { ArrowLeft, ArrowRight, Loader2, Plus, Trash2 } from "lucide-react";

interface TestData {
  id: string;
  title: string;
  durationMinutes: number;
  totalMarks: number;
  status: string;
  _count: { questions: number; attempts: number };
}

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "secondary",
  UPCOMING: "outline",
  ACTIVE: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
};

const testStatusVariant: Record<string, "default" | "secondary" | "outline"> = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  CLOSED: "outline",
};

export default function DriveDetailPage() {
  const params = useParams<{ driveId: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("DRAFT");

  const driveQuery = trpc.drive.getById.useQuery(
    { id: params.driveId },
    {
      onError: (err: { message: string }) => {
        toast.error(err.message || "Failed to load drive");
        router.push("/college/drives");
      },
    } as never
  );

  const testsQuery = trpc.test.list.useQuery(
    { driveId: params.driveId },
    {
      onError: (err: { message: string }) => {
        toast.error(err.message || "Failed to load tests");
      },
    } as never
  );

  const drive = driveQuery.data ?? null;
  const tests: TestData[] = (testsQuery.data as unknown as TestData[] | undefined) ?? [];
  const isLoading = driveQuery.isLoading;

  // Sync form state when drive data loads
  useEffect(() => {
    if (drive) {
      setTitle(drive.title);
      setDescription(drive.description || "");
      setCompanyName(drive.companyName || "");
      setStartDate(
        drive.startDate
          ? new Date(drive.startDate).toISOString().split("T")[0]
          : ""
      );
      setEndDate(
        drive.endDate
          ? new Date(drive.endDate).toISOString().split("T")[0]
          : ""
      );
      setStatus(drive.status);
    }
  }, [drive]);

  const updateDrive = trpc.drive.update.useMutation({
    onSuccess: () => {
      toast.success("Drive updated successfully");
      utils.drive.getById.invalidate({ id: params.driveId });
      utils.drive.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong");
    },
  });

  const deleteDrive = trpc.drive.delete.useMutation({
    onSuccess: () => {
      toast.success("Drive deleted successfully");
      utils.drive.list.invalidate();
      router.push("/college/drives");
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong");
    },
  });

  const deleteTest = trpc.test.delete.useMutation({
    onSuccess: () => {
      toast.success("Test deleted successfully");
      utils.test.list.invalidate({ driveId: params.driveId });
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong");
    },
  });

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateDrive.mutate({
      id: params.driveId,
      title,
      description: description || undefined,
      companyName: companyName || undefined,
      startDate: startDate
        ? new Date(startDate).toISOString()
        : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
      status: status as "DRAFT" | "UPCOMING" | "ACTIVE" | "COMPLETED" | "CANCELLED",
    });
  }

  function handleDeleteDrive() {
    deleteDrive.mutate({ id: params.driveId });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!drive) return null;

  return (
    <div className="space-y-8">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-3">
          <Link href="/college/drives">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Drives
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight min-w-0 truncate">{drive.title}</h1>
          <Badge variant={statusVariant[drive.status] ?? "secondary"}>
            {drive.status}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage drive details and associated tests.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Drive Details</CardTitle>
          <CardDescription>
            Update the drive details below and save your changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
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
                  <SelectItem value="UPCOMING">Upcoming</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={updateDrive.isPending}>
                {updateDrive.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save Changes
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/college/drives">Cancel</Link>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive">
                    <Trash2 />
                    Delete Drive
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Drive</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this drive and all its tests,
                      questions, and attempts. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteDrive}
                      disabled={deleteDrive.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteDrive.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Tests</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Tests associated with this drive.
            </p>
          </div>
          <Button asChild>
            <Link href={`/college/drives/${params.driveId}/tests/new`}>
              <Plus className="size-4" aria-hidden="true" />
              Add Test
            </Link>
          </Button>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4">Title</TableHead>
                <TableHead className="px-4">Duration</TableHead>
                <TableHead className="px-4 text-center">Marks</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4 text-center">Questions</TableHead>
                <TableHead className="px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tests.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    No tests yet. Add a test to this drive.
                  </TableCell>
                </TableRow>
              ) : (
                tests.map((test) => (
                  <TableRow key={test.id}>
                    <TableCell className="px-4 font-medium">{test.title}</TableCell>
                    <TableCell className="px-4 text-muted-foreground tabular-nums">{test.durationMinutes} min</TableCell>
                    <TableCell className="px-4 text-center tabular-nums">
                      {test.totalMarks}
                    </TableCell>
                    <TableCell className="px-4">
                      <Badge
                        variant={testStatusVariant[test.status] ?? "secondary"}
                      >
                        {test.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 text-center tabular-nums">
                      {test._count.questions}
                    </TableCell>
                    <TableCell className="px-4 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={`/college/drives/${params.driveId}/tests/${test.id}`}
                          aria-label={`View ${test.title}`}
                        >
                          View
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
