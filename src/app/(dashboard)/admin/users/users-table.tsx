"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { DeleteUserButton } from "./delete-user-button";

const PAGE_SIZE = 15;

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const roleBadgeVariant: Record<
  string,
  "destructive" | "default" | "secondary"
> = {
  SUPER_ADMIN: "destructive",
  COLLEGE_ADMIN: "default",
  STUDENT: "secondary",
};

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  COLLEGE_ADMIN: "College Admin",
  STUDENT: "Student",
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  collegeName: string | null;
  testAttemptCount: number;
}

export function UsersTable({ users }: { users: UserRow[] }) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const paginatedUsers = users.slice(startIdx, startIdx + PAGE_SIZE);

  return (
    <>
      <div className="rounded-lg border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4">Name</TableHead>
              <TableHead className="px-4">Email</TableHead>
              <TableHead className="px-4">Role</TableHead>
              <TableHead className="px-4">College</TableHead>
              <TableHead className="px-4">Joined</TableHead>
              <TableHead className="px-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3 py-6">
                    <div className="rounded-full bg-muted p-3">
                      <Users
                        className="size-6 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">No users found</p>
                      <p className="text-xs text-muted-foreground">
                        Try adjusting the role filter.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="px-4 font-medium">
                    {user.name}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell className="px-4">
                    <Badge variant={roleBadgeVariant[user.role] ?? "secondary"}>
                      {roleLabel[user.role] ?? user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {user.collegeName ?? "—"}
                  </TableCell>
                  <TableCell className="px-4 tabular-nums text-muted-foreground">
                    {dateFormatter.format(new Date(user.createdAt))}
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <DeleteUserButton
                      userId={user.id}
                      userName={user.name}
                      userEmail={user.email}
                      userRole={user.role}
                      testAttemptCount={user.testAttemptCount}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startIdx + 1}&ndash;
            {Math.min(startIdx + PAGE_SIZE, users.length)} of {users.length}{" "}
            users
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setCurrentPage(1)}
              disabled={safePage === 1}
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setCurrentPage(safePage - 1)}
              disabled={safePage === 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-3 text-sm font-medium tabular-nums">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setCurrentPage(safePage + 1)}
              disabled={safePage === totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage === totalPages}
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
