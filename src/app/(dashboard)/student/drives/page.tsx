import { getServerTrpc } from "@/lib/trpc-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Calendar,
  ClipboardList,
  Building2,
} from "lucide-react";
import { format } from "date-fns";

const driveStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  UPCOMING: "secondary",
  COMPLETED: "outline",
  CANCELLED: "destructive",
  DRAFT: "outline",
};

export default async function StudentDrivesPage() {
  const trpc = await getServerTrpc();

  const allDrives = await trpc.drive.list();

  // Filter to only show relevant statuses for students
  const drives = allDrives.filter(
    (d) => d.status === "ACTIVE" || d.status === "UPCOMING" || d.status === "COMPLETED"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-balance">Placement Drives</h1>
        <p className="text-muted-foreground">
          Active and upcoming placement drives for your college.
        </p>
      </div>

      {drives.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="mx-auto size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No drives available</h3>
            <p className="text-sm text-muted-foreground mt-1">
              There are no active or upcoming placement drives at the moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {drives.map((drive) => (
            <Card key={drive.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg leading-tight">
                    {drive.title}
                  </CardTitle>
                  <Badge variant={driveStatusVariant[drive.status] ?? "outline"}>
                    {drive.status}
                  </Badge>
                </div>
                {drive.companyName && (
                  <CardDescription className="flex items-center gap-1.5">
                    <Building2 className="size-3.5" />
                    {drive.companyName}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {drive.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {drive.description}
                  </p>
                )}

                <div className="space-y-2 text-sm text-muted-foreground">
                  {(drive.startDate || drive.endDate) && (
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4" />
                      <span>
                        {drive.startDate
                          ? format(new Date(drive.startDate), "MMM d, yyyy")
                          : "TBD"}
                        {" - "}
                        {drive.endDate
                          ? format(new Date(drive.endDate), "MMM d, yyyy")
                          : "TBD"}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <ClipboardList className="size-4" />
                    <span>
                      {drive._count.tests} test
                      {drive._count.tests !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <Link href={`/student/tests?driveId=${drive.id}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      View Tests
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
