"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { format } from "date-fns";

interface Department {
  id: string;
  name: string;
  code: string | null;
  createdAt: string;
}

export default function DepartmentsPage() {
  const utils = trpc.useUtils();

  const { data: departments = [], isLoading: loading } = trpc.department.list.useQuery(undefined, {
    onError: () => toast.error("Failed to load departments"),
  } as never);

  const createMutation = trpc.department.create.useMutation({
    onSuccess: () => {
      toast.success("Department created");
      utils.department.list.invalidate();
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || "Something went wrong");
    },
  });

  const updateMutation = trpc.department.update.useMutation({
    onSuccess: () => {
      toast.success("Department updated");
      utils.department.list.invalidate();
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || "Something went wrong");
    },
  });

  const deleteMutation = trpc.department.delete.useMutation({
    onSuccess: () => {
      toast.success("Department deleted");
      utils.department.list.invalidate();
    },
    onError: () => {
      toast.error("Failed to delete department");
    },
  });

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");

  const saving = createMutation.isPending || updateMutation.isPending;

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormName("");
    setFormCode("");
  }

  function startEdit(dept: Department) {
    setEditingId(dept.id);
    setFormName(dept.name);
    setFormCode(dept.code ?? "");
    setShowForm(false);
  }

  function handleSave() {
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }

    const body = { name: formName.trim(), code: formCode.trim() || undefined };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...body });
    } else {
      createMutation.mutate(body);
    }
  }

  function handleDelete(id: string) {
    deleteMutation.mutate({ id });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Loader2 className="size-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-balance">Departments</h1>
          <p className="text-muted-foreground">
            Manage departments in your college.
          </p>
        </div>
        {!showForm && !editingId && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="size-4 mr-2" />
            Add Department
          </Button>
        )}
      </div>

      {/* Inline add form */}
      {showForm && (
        <div className="flex items-end gap-3 rounded-md border p-4">
          <div className="flex-1 space-y-1">
            <label className="text-sm font-medium">Name *</label>
            <Input
              placeholder="e.g. Computer Science"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="w-48 space-y-1">
            <label className="text-sm font-medium">Code</label>
            <Input
              placeholder="e.g. CS"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
            Save
          </Button>
          <Button variant="ghost" onClick={resetForm} disabled={saving}>
            Cancel
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.length === 0 && !showForm ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  No departments yet. Click &quot;Add Department&quot; to create one.
                </TableCell>
              </TableRow>
            ) : (
              (departments as Department[]).map((dept) =>
                editingId === dept.id ? (
                  <TableRow key={dept.id}>
                    <TableCell>
                      <Input
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        autoFocus
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={formCode}
                        onChange={(e) => setFormCode(e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      {format(new Date(dept.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={handleSave}
                          disabled={saving}
                        >
                          {saving ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={resetForm}
                          disabled={saving}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>{dept.code ?? "—"}</TableCell>
                    <TableCell>
                      {format(new Date(dept.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEdit(dept)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete department?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete &quot;{dept.name}&quot;. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(dept.id)}
                                disabled={deleteMutation.isPending && deleteMutation.variables?.id === dept.id}
                              >
                                {deleteMutation.isPending && deleteMutation.variables?.id === dept.id && (
                                  <Loader2 className="size-4 mr-2 animate-spin" />
                                )}
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
