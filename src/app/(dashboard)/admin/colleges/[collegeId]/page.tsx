"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2, Users, Briefcase } from "lucide-react";
import Link from "next/link";
import { CollegeStats } from "./college-stats";

export default function CollegeDetailPage() {
  const params = useParams<{ collegeId: string }>();
  const router = useRouter();

  const { data: college, isLoading } = trpc.college.getById.useQuery(
    { id: params.collegeId },
    { retry: false }
  );

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [code, setCode] = useState("");
  const [usnFormat, setUsnFormat] = useState("");
  const [usnExample, setUsnExample] = useState("");
  const [regexValid, setRegexValid] = useState<boolean | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (college && !initialized) {
      setName(college.name);
      setAddress(college.address || "");
      setWebsite(college.website || "");
      setContactEmail(college.contactEmail || "");
      setContactPhone(college.contactPhone || "");
      setIsActive(college.isActive);
      setCode(college.code);
      setUsnFormat(college.usnFormat || "");
      setUsnExample(college.usnExample || "");
      setInitialized(true);
    }
  }, [college, initialized]);

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

  const updateCollege = trpc.college.update.useMutation({
    onSuccess: () => {
      toast.success("College updated successfully");
      router.push("/admin/colleges");
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateCollege.mutate({
      id: params.collegeId,
      name,
      code,
      address,
      website,
      contactEmail,
      contactPhone,
      isActive,
      usnFormat: usnFormat || null,
      usnExample: usnExample ? usnExample.toUpperCase() : null,
    });
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

  if (!college) return null;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/admin/colleges">
            <ArrowLeft />
            Back to Colleges
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-balance min-w-0">{college.name}</h1>
          <Badge variant={college.isActive ? "default" : "secondary"}>
            {college.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="text-muted-foreground">View and edit college information.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">College Code</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{college.code}</div>
            <p className="text-xs text-muted-foreground">Editable in the form below</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{college._count.users}</div>
            <p className="text-xs text-muted-foreground">Registered students & admins</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Placement Drives</CardTitle>
            <Briefcase className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{college._count.placementDrives}</div>
            <p className="text-xs text-muted-foreground">Total drives</p>
          </CardContent>
        </Card>
      </div>

      <CollegeStats collegeId={params.collegeId} />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Edit College</CardTitle>
          <CardDescription>Update the college details below and save your changes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">College Code <span className="text-destructive">*</span></Label>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono uppercase" required />
              <p className="text-xs text-muted-foreground">Students use this code to register with the college.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://www.example.edu" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input id="contactPhone" type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="isActive">College is active</Label>
            </div>
            <div className="space-y-4 rounded-md border p-4">
              <div>
                <h3 className="text-sm font-medium">USN Structure</h3>
                <p className="text-xs text-muted-foreground">Define a regex pattern to validate student USNs during uploads.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="usnFormat">USN Regex Pattern</Label>
                  <Input id="usnFormat" value={usnFormat} onChange={(e) => setUsnFormat(e.target.value)} placeholder="e.g. ^1SI\d{2}[A-Z]{2}\d{3}$" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="usnExample">Example USN (Preview)</Label>
                  <Input id="usnExample" value={usnExample} onChange={(e) => setUsnExample(e.target.value.toUpperCase())} placeholder="e.g. 1SI22CS001" className="font-mono uppercase" />
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
              <Button type="submit" disabled={updateCollege.isPending}>
                {updateCollege.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save Changes
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
