import { requireRole } from "@/lib/auth-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function CollegeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("COLLEGE_ADMIN");

  return <DashboardShell>{children}</DashboardShell>;
}
