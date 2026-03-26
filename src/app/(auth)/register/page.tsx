"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function RegisterCollegeAdminPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    collegeCode: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const registerMutation = trpc.auth.registerCollegeAdmin.useMutation({
    onSuccess: () => {
      toast.success("Registration successful! Please sign in.");
      router.push("/login");
    },
    onError: (err) => toast.error(err.message),
  });

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    registerMutation.mutate(formData);
  }

  return (
    <Card className="shadow-md border-border/60">
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-3">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1">
            <Building2 className="size-3" aria-hidden="true" />
            College Admin
          </Badge>
        </div>
        <CardTitle className="text-2xl">Create account</CardTitle>
        <CardDescription>
          Register with your institution-provided college code
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="name"
                name="name"
                placeholder="Jane Smith"
                autoComplete="name"
                className="pl-9"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                spellCheck={false}
                className="pl-9"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="password"
                name="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="pl-9 pr-10"
                value={formData.password}
                onChange={(e) => updateField("password", e.target.value)}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="collegeCode">College Code</Label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="collegeCode"
                name="college-code"
                placeholder="Provided by your institution"
                autoComplete="off"
                spellCheck={false}
                className="pl-9"
                value={formData.collegeCode}
                onChange={(e) => updateField("collegeCode", e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-2">
          <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                Creating account…
              </>
            ) : (
              "Register as College Admin"
            )}
          </Button>

          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Student?{" "}
            <Link
              href="/register/student"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Register here
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
