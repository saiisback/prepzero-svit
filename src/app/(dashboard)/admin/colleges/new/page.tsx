"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function NewCollegePage() {
  const router = useRouter();

  const createCollege = trpc.college.create.useMutation({
    onSuccess: () => {
      toast.success("College created successfully");
      router.push("/admin/colleges");
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const usnFormat = formData.get("usnFormat") as string;
    const usnExample = formData.get("usnExample") as string;

    createCollege.mutate({
      name: formData.get("name") as string,
      code: (formData.get("code") as string) || undefined,
      address: formData.get("address") as string,
      website: formData.get("website") as string,
      contactEmail: formData.get("contactEmail") as string,
      contactPhone: formData.get("contactPhone") as string,
      ...(usnFormat ? { usnFormat } : {}),
      ...(usnExample ? { usnExample: usnExample.toUpperCase() } : {}),
    });
  }

  const [usnFormat, setUsnFormat] = useState("");
  const [usnExample, setUsnExample] = useState("");
  const [regexValid, setRegexValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (!usnFormat || !usnExample) {
      setRegexValid(null);
      return;
    }
    try {
      const regex = new RegExp(usnFormat);
      setRegexValid(regex.test(usnExample));
    } catch {
      setRegexValid(false);
    }
  }, [usnFormat, usnExample]);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/admin/colleges">
            <ArrowLeft />
            Back to Colleges
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-balance">Add College</h1>
        <p className="text-muted-foreground">
          Register a new college on the platform.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>College Details</CardTitle>
          <CardDescription>
            Fill in the information below. A unique college code will be
            generated automatically if not provided.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input id="name" name="name" placeholder="e.g. Indian Institute of Technology Delhi" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">College Code</Label>
              <Input id="code" name="code" placeholder="e.g. RVCE2026 (auto-generated if empty)" className="font-mono uppercase" />
              <p className="text-xs text-muted-foreground">
                Leave empty to auto-generate. Students use this code to register.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" name="address" placeholder="Full address of the college" rows={3} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" name="website" type="url" placeholder="https://www.example.edu" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input id="contactEmail" name="contactEmail" type="email" placeholder="admin@example.edu" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input id="contactPhone" name="contactPhone" type="tel" placeholder="+91 9876543210" />
              </div>
            </div>

            <div className="space-y-4 rounded-md border p-4">
              <div>
                <h3 className="text-sm font-medium">USN Structure</h3>
                <p className="text-xs text-muted-foreground">
                  Define a regex pattern to validate student USNs during uploads.
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="usnFormat">USN Regex Pattern</Label>
                  <Input id="usnFormat" name="usnFormat" value={usnFormat} onChange={(e) => setUsnFormat(e.target.value)} placeholder="e.g. ^1SI\d{2}[A-Z]{2}\d{3}$" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="usnExample">Example USN (Preview)</Label>
                  <Input id="usnExample" name="usnExample" value={usnExample} onChange={(e) => setUsnExample(e.target.value.toUpperCase())} placeholder="e.g. 1SI22CS001" className="font-mono uppercase" />
                </div>
                {usnFormat && usnExample && (
                  <div className={`p-3 rounded-md text-sm flex items-center gap-2 border ${regexValid ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400" : "bg-destructive/10 border-destructive/20 text-destructive"}`}>
                    <div className={`size-2 rounded-full ${regexValid ? "bg-green-500" : "bg-destructive"}`} />
                    {regexValid ? (
                      <span>The example USN <strong>matches</strong> the regex pattern.</span>
                    ) : (
                      <span>The example USN <strong>does not match</strong> or the regex is invalid.</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={createCollege.isPending}>
                {createCollege.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Create College
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/colleges">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
