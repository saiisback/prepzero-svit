"use client";

import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function StudentSettingsPage() {
  const { user } = useAuth();

  const { data: profile, isLoading } = trpc.student.getProfile.useQuery(undefined, {
    enabled: !!user,
  });

  const utils = trpc.useUtils();
  const updateProfile = trpc.student.updateProfile.useMutation({
    onSuccess: () => {
      utils.student.getProfile.invalidate();
      toast.success("Profile updated successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  const [name, setName] = useState("");
  const [semester, setSemester] = useState<string>("");
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize form values when profile loads
  if (profile && !hasInitialized) {
    setName(profile.name);
    setSemester(profile.semester ? String(profile.semester) : "");
    setHasInitialized(true);
  }

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateProfile.mutate({
      name,
      semester: semester ? parseInt(semester, 10) : null,
    });
  }

  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (error) {
        throw new Error(error.message || "Failed to change password");
      }

      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to change password"
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-balance">Settings</h1>
        <p className="text-sm text-muted-foreground">
          View and update your profile information.
        </p>
      </div>

      <Card className="max-w-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Some fields are managed by your college admin and cannot be changed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Email</p>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm font-medium">
                {profile.email}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">USN</p>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm font-medium font-mono">
                {profile.usn ?? <span className="font-sans text-muted-foreground">{"\u2014"}</span>}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">College</p>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm font-medium">
                {profile.college?.name ?? <span className="text-muted-foreground">{"\u2014"}</span>}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Department</p>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm font-medium">
                {profile.department ? (
                  <span className="flex items-center gap-2">
                    {profile.department.name}
                    {profile.department.code && (
                      <Badge variant="outline" className="text-xs">
                        {profile.department.code}
                      </Badge>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{"\u2014"}</span>
                )}
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive" aria-hidden="true">*</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="semester">Current Semester</Label>
                <Select value={semester} onValueChange={setSemester}>
                  <SelectTrigger id="semester" className="w-full sm:w-48">
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        Semester {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending && (
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  )}
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your password. You will be signed out of other sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                name="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                name="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="pt-2">
              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword && (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                )}
                Change Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
