import { requireRole } from "@/lib/auth-guard";
import { getServerTrpc } from "@/lib/trpc-server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, Globe, Mail, Phone, MapPin, Hash } from "lucide-react";
import { CollegeProfileSection } from "./profile-section";

export default async function CollegeSettingsPage() {
  const session = await requireRole("COLLEGE_ADMIN");
  const user = session.user as { collegeId: string };

  const trpc = await getServerTrpc();
  const college = await trpc.college.getById({ id: user.collegeId });

  if (!college) {
    redirect("/college");
  }

  const infoItems = [
    { label: "College Name",   value: college.name,                    icon: Building2 },
    { label: "College Code",   value: college.code,                    icon: Hash      },
    { label: "Address",        value: college.address || null,         icon: MapPin    },
    { label: "Website",        value: college.website || null,         icon: Globe,    isLink: !!college.website },
    { label: "Contact Email",  value: college.contactEmail || null,    icon: Mail      },
    { label: "Contact Phone",  value: college.contactPhone || null,    icon: Phone     },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-balance">College Settings</h1>
        <p className="text-sm text-muted-foreground">
          View your college information and manage your account.
        </p>
      </div>

      <Card className="max-w-2xl shadow-sm">
        <CardHeader>
          <CardTitle>College Information</CardTitle>
          <CardDescription>
            These details are managed by the platform administrator. Contact the
            super admin to request changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {infoItems.map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0 rounded-md bg-muted p-1.5">
                  <item.icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
                  <dd className="text-sm font-medium">
                    {item.isLink && item.value ? (
                      <a
                        href={item.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {item.value}
                      </a>
                    ) : (
                      <span className={item.value ? "" : "text-muted-foreground"}>
                        {item.value ?? "—"}
                      </span>
                    )}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <CollegeProfileSection />
    </div>
  );
}
