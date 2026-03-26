"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Users,
  GraduationCap,
  ClipboardList,
  BarChart3,
  Settings,
  Briefcase,
  BookOpen,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/providers/auth-provider";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const adminNav: NavItem[] = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "Colleges", href: "/admin/colleges", icon: Building2 },
  { title: "Library", href: "/admin/library", icon: BookOpen },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Settings", href: "/admin/settings", icon: Settings },
];

const collegeNav: NavItem[] = [
  { title: "Dashboard", href: "/college", icon: LayoutDashboard },
  { title: "Drives", href: "/college/drives", icon: Briefcase },
  { title: "Library", href: "/college/library", icon: BookOpen },
  { title: "Students", href: "/college/students", icon: GraduationCap },
  { title: "Departments", href: "/college/departments", icon: Building2 },
  { title: "Reports", href: "/college/reports", icon: BarChart3 },
  { title: "Settings", href: "/college/settings", icon: Settings },
];

const studentNav: NavItem[] = [
  { title: "Dashboard", href: "/student", icon: LayoutDashboard },
  { title: "Drives", href: "/student/drives", icon: Briefcase },
  { title: "Tests", href: "/student/tests", icon: ClipboardList },
  { title: "Results", href: "/student/results", icon: BarChart3 },
  { title: "Settings", href: "/student/settings", icon: Settings },
];

function getNavItems(role: string): NavItem[] {
  switch (role) {
    case "SUPER_ADMIN":
      return adminNav;
    case "COLLEGE_ADMIN":
      return collegeNav;
    case "STUDENT":
      return studentNav;
    default:
      return [];
  }
}

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  COLLEGE_ADMIN: "College Admin",
  STUDENT: "Student",
};

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useAuth();
  const navItems = getNavItems(role ?? "");

  return (
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:top-14 md:bottom-0 md:left-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-0.5 relative" aria-label="Main navigation">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" &&
                item.href !== "/college" &&
                item.href !== "/student" &&
                pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground font-semibold"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground/90"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && (
                  <span className="absolute -left-3 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-sidebar-primary" aria-hidden="true" />
                )}
                <item.icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50"
                  )}
                  aria-hidden="true"
                />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-lg bg-sidebar-accent/60 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40">Role</p>
          <p className="text-xs font-semibold mt-0.5 text-sidebar-foreground/80">
            {roleLabel[role ?? ""] ?? role}
          </p>
        </div>
      </div>
    </div>
  );
}
