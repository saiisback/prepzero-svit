import { requireRole } from "@/lib/auth-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("SUPER_ADMIN");

  return <DashboardShell>{children}</DashboardShell>;
}
