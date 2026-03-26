import { requireRole } from "@/lib/auth-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("STUDENT");

  return <DashboardShell>{children}</DashboardShell>;
}
