"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Download, Loader2, Upload, AlertTriangle, ArrowRight } from "lucide-react";
import {
  parseStudentsCSV,
  generateStudentCSVTemplate,
  type CSVStudent,
} from "@/lib/student-csv-parser";
import type { CSVParseError } from "@/lib/csv-parser";
import { fileToCSVText } from "@/lib/spreadsheet";

type Phase = "select" | "preview" | "passwords" | "uploading";

export default function StudentUploadPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("select");
  const [students, setStudents] = useState<CSVStudent[]>([]);
  const [errors, setErrors] = useState<CSVParseError[]>([]);
  const [groupPasswords, setGroupPasswords] = useState<Record<string, string>>({});

  // Fetch USN structure via tRPC
  const { data: usnStructure, isLoading: usnLoading } = trpc.college.getUsnStructure.useQuery(undefined, {
    onError: () => {
      toast.error("Failed to load USN structure");
    },
  } as never);

  // Bulk create mutation
  const bulkCreateMutation = trpc.student.bulkCreate.useMutation({
    onSuccess: (data) => {
      let message = `${data.created} student${data.created !== 1 ? "s" : ""} created`;
      if (data.skipped > 0) message += `, ${data.skipped} skipped (already exist)`;
      if (data.errors?.length > 0) message += `, ${data.errors.length} errors`;

      toast.success(message);

      if (data.errors?.length > 0) {
        for (const err of data.errors.slice(0, 5)) {
          toast.error(typeof err === "string" ? err : `${err.email}: ${err.error}`);
        }
      }

      router.push("/college/students");
    },
    onError: (error) => {
      toast.error(error.message || "Something went wrong");
      setPhase("passwords");
    },
  });

  async function handleDownloadTemplate(format: "csv" | "xlsx") {
    if (!usnStructure || !usnStructure.configured) return;
    const csv = generateStudentCSVTemplate(usnStructure.usnExample ?? undefined);

    if (format === "xlsx") {
      const { utils, writeFile } = await import("xlsx");
      const rows = csv.trim().split("\n").map((line) => line.split(","));
      const ws = utils.aoa_to_sheet(rows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Students");
      writeFile(wb, "students_template.xlsx");
    } else {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "students_template.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !usnStructure || !usnStructure.configured) return;

    const text = await fileToCSVText(file);
    const result = parseStudentsCSV(
      text,
      usnStructure.usnFormat
    );

    const allErrors = [...result.errors];
    let validStudents = result.students;

    // Check for existing USN+semester conflicts in the database
    // Keep this as fetch since student.validate is a query with POST-like semantics
    if (result.students.length > 0) {
      try {
        const res = await fetch("/api/students/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usns: result.students.map((s) => s.usn),
          }),
        });

        if (res.ok) {
          const { conflicts } = (await res.json()) as {
            conflicts: Record<string, number | null>;
          };

          if (Object.keys(conflicts).length > 0) {
            validStudents = result.students.filter((s) => {
              const existingSem = conflicts[s.usn.toUpperCase()];
              if (existingSem !== undefined) {
                allErrors.push({
                  row: 0,
                  message:
                    existingSem !== null
                      ? `USN "${s.usn}" already exists (Semester ${existingSem})`
                      : `USN "${s.usn}" already exists`,
                });
                return false;
              }
              return true;
            });
          }
        }
      } catch {
        // Validation fetch failed — continue without pre-check
      }
    }

    setStudents(validStudents);
    setErrors(allErrors);
    setPhase("preview");
  }

  function handleUpload() {
    if (students.length === 0) return;
    setPhase("uploading");
    bulkCreateMutation.mutate({ students, passwords: groupPasswords });
  }

  if (usnLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/college/students">
            <ArrowLeft />
            Back to Students
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-balance">
          Bulk Upload Students
        </h1>
        <p className="text-muted-foreground">
          Upload student accounts from a CSV or Excel file.
        </p>
      </div>

      {/* Phase 1: File Selection */}
      {phase === "select" && (
        <>
          {!usnStructure?.configured ? (
            <Card className="max-w-2xl border-amber-500">
              <CardContent className="flex items-start gap-3 pt-6">
                <AlertTriangle className="size-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">USN Structure Not Configured</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    The super admin needs to configure the USN structure for your
                    college before students can be uploaded via CSV. Contact your
                    super admin to set this up.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle>Upload File</CardTitle>
                <CardDescription>
                  Upload a CSV or Excel (.xlsx) file with student details. Download the template
                  to see the expected format.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border p-4 text-sm text-muted-foreground space-y-3">
                  <p className="font-medium text-foreground">File Format</p>
                  <ul className="space-y-1.5 text-[13px]">
                    <li>
                      <code className="bg-muted px-1 rounded text-xs">name</code>
                      {" "}&mdash; student&apos;s full name
                    </li>
                    <li>
                      <code className="bg-muted px-1 rounded text-xs">email</code>
                      {" "}&mdash; unique email address
                    </li>
                    <li>
                      <code className="bg-muted px-1 rounded text-xs">usn</code>
                      {" "}&mdash; University Seat Number (must match pattern{" "}
                      <code className="bg-muted px-1 rounded text-xs">
                        {usnStructure.usnFormat}
                      </code>
                      ) {usnStructure.usnExample && `e.g. ${usnStructure.usnExample}`}
                    </li>
                    <li>
                      <code className="bg-muted px-1 rounded text-xs">department</code>
                      {" "}&mdash; department code (must match a configured department)
                    </li>
                    <li>
                      <code className="bg-muted px-1 rounded text-xs">semester</code>
                      {" "}&mdash; current semester (1&ndash;8)
                    </li>
                  </ul>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => handleDownloadTemplate("csv")}>
                    <Download />
                    Template (.csv)
                  </Button>
                  <Button variant="outline" onClick={() => handleDownloadTemplate("xlsx")}>
                    <Download />
                    Template (.xlsx)
                  </Button>
                  <Button asChild>
                    <label className="cursor-pointer">
                      <Upload />
                      Select File
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Phase 2: Preview */}
      {phase === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant="default">{students.length} valid</Badge>
            {errors.length > 0 && (
              <Badge variant="destructive">{errors.length} errors</Badge>
            )}
          </div>

          {errors.length > 0 && (
            <Card className="border-destructive">
              <CardHeader className="pb-3">
                <CardTitle className="text-destructive text-base">
                  Errors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1">
                  {errors.map((err, i) => (
                    <li key={i} className="text-destructive">
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {students.length > 0 && (
            <div className="rounded-lg border border-border shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>USN</TableHead>
                    <TableHead>Dept Code</TableHead>
                    <TableHead>Semester</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{i + 1}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.email}</TableCell>
                      <TableCell className="font-mono">{s.usn}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.deptCode}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Sem {s.semester}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setPhase("select");
                setStudents([]);
                setErrors([]);
              }}
            >
              Choose Different File
            </Button>
            <Button
              onClick={() => {
                // Initialize group passwords with empty strings
                const groups = Array.from(
                  new Set(students.map((s) => `${s.deptCode}:${s.semester}`))
                );
                const initial: Record<string, string> = {};
                for (const g of groups) initial[g] = "";
                setGroupPasswords(initial);
                setPhase("passwords");
              }}
              disabled={students.length === 0}
            >
              <ArrowRight />
              Next: Set Passwords
            </Button>
          </div>
        </div>
      )}

      {/* Phase 3: Set Passwords */}
      {phase === "passwords" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set an initial password for each department &amp; semester group.
            Students can change their password after first login.
          </p>

          <div className="grid gap-4 max-w-2xl">
            {Object.keys(groupPasswords).map((key) => {
              const [deptCode, semester] = key.split(":");
              const count = students.filter(
                (s) => s.deptCode === deptCode && s.semester === Number(semester)
              ).length;
              return (
                <Card key={key}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{deptCode}</Badge>
                        <Badge variant="secondary">Sem {semester}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {count} student{count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`pw-${key}`}>Password</Label>
                      <Input
                        id={`pw-${key}`}
                        type="text"
                        placeholder="Min 8 characters"
                        value={groupPasswords[key]}
                        onChange={(e) =>
                          setGroupPasswords((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      />
                      {groupPasswords[key].length > 0 &&
                        groupPasswords[key].length < 8 && (
                          <p className="text-xs text-destructive">
                            Password must be at least 8 characters
                          </p>
                        )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setPhase("preview")}>
              Back
            </Button>
            <Button
              onClick={handleUpload}
              disabled={Object.values(groupPasswords).some(
                (pw) => pw.length < 8
              )}
            >
              <Upload />
              Upload {students.length} Student
              {students.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      )}

      {/* Phase 4: Uploading */}
      {phase === "uploading" && (
        <Card className="max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="size-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                Creating {students.length} student account
                {students.length !== 1 ? "s" : ""}...
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
