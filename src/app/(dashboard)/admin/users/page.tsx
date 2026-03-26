import type { Role } from "@/generated/prisma/client";
import { getServerTrpc } from "@/lib/trpc-server";
import { RoleFilter } from "./role-filter";
import { UsersTable } from "./users-table";

const validRoles: Role[] = ["SUPER_ADMIN", "COLLEGE_ADMIN", "STUDENT"];

type PageProps = { searchParams: Promise<{ role?: string }> };

export default async function UsersListPage({ searchParams }: PageProps) {
  const { role } = await searchParams;
  const trpc = await getServerTrpc();

  const roleFilter = role && validRoles.includes(role as Role) ? (role as Role) : undefined;
  const users = await trpc.user.list({ role: roleFilter });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-balance">
            Users
          </h1>
          <p className="text-sm text-muted-foreground">
            All registered users across the platform.
          </p>
        </div>
        <RoleFilter />
      </div>

      <UsersTable users={users} />
    </div>
  );
}
