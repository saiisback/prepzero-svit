import Link from "next/link";
import { getServerTrpc } from "@/lib/trpc-server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ArrowRight, Building2 } from "lucide-react";
import { DeleteCollegeButton } from "./delete-college-button";

export default async function CollegesListPage() {
  const trpc = await getServerTrpc();
  const colleges = await trpc.college.list();

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-balance">
            Colleges
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage all registered colleges on the platform.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/admin/colleges/new">
            <Plus className="size-4" aria-hidden="true" />
            Add College
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4">Name</TableHead>
              <TableHead className="px-4">Code</TableHead>
              <TableHead className="px-4">Contact Email</TableHead>
              <TableHead className="px-4 text-center">Users</TableHead>
              <TableHead className="px-4 text-center">Drives</TableHead>
              <TableHead className="px-4">Status</TableHead>
              <TableHead className="px-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {colleges.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3 py-6">
                    <div className="rounded-full bg-muted p-3">
                      <Building2 className="size-6 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">No colleges yet</p>
                      <p className="text-xs text-muted-foreground">
                        Add your first college to get started.
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="mt-1">
                      <Link href="/admin/colleges/new">
                        <Plus className="size-4" aria-hidden="true" />
                        Add College
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              colleges.map((college) => (
                <TableRow key={college.id}>
                  <TableCell className="px-4 font-medium">{college.name}</TableCell>
                  <TableCell className="px-4 font-mono text-xs">{college.code}</TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {college.contactEmail ?? "—"}
                  </TableCell>
                  <TableCell className="px-4 text-center tabular-nums">
                    {college._count.users}
                  </TableCell>
                  <TableCell className="px-4 text-center tabular-nums">
                    {college._count.placementDrives}
                  </TableCell>
                  <TableCell className="px-4">
                    <Badge variant={college.isActive ? "default" : "secondary"}>
                      {college.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/colleges/${college.id}`} aria-label={`View ${college.name}`}>
                          View
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                      </Button>
                      <DeleteCollegeButton
                        collegeId={college.id}
                        collegeName={college.name}
                        userCount={college._count.users}
                        driveCount={college._count.placementDrives}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
