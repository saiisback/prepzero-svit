import Link from "next/link";
import { getServerTrpc } from "@/lib/trpc-server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Plus, Briefcase, Building2, Calendar, FlaskConical, ArrowRight } from "lucide-react";
import { DriveStatusBadge } from "@/components/drives/drive-status-badge";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return dateFormatter.format(new Date(date));
}

export default async function DrivesListPage() {
  const trpc = await getServerTrpc();
  const drives = await trpc.drive.list();

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Placement Drives
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your college placement drives and associated tests.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/college/drives/new">
            <Plus className="size-4" aria-hidden="true" />
            Create Drive
          </Link>
        </Button>
      </div>

      {drives.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <div className="rounded-full bg-muted p-4">
              <Briefcase
                className="size-6 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium">No drives yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first placement drive to get started.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/college/drives/new">
                <Plus className="size-4" aria-hidden="true" />
                Create Drive
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {drives.map((drive) => (
            <Link
              key={drive.id}
              href={`/college/drives/${drive.id}`}
              className="group block"
            >
              <Card className="h-full shadow-sm transition-[shadow,background-color] duration-200 group-hover:shadow-md group-hover:bg-accent/30">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-medium group-hover:text-primary transition-colors">
                        {drive.title}
                      </h3>
                      {drive.companyName && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Building2 className="size-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{drive.companyName}</span>
                        </div>
                      )}
                    </div>
                    <DriveStatusBadge status={drive.status} />
                  </div>

                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <FlaskConical className="size-3 shrink-0" aria-hidden="true" />
                      <span className="tabular-nums">{drive._count.tests} {drive._count.tests === 1 ? "test" : "tests"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3 shrink-0" aria-hidden="true" />
                      <span className="tabular-nums">{formatDate(drive.startDate)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
