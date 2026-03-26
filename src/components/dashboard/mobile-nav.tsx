"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Building2,
  Users,
  GraduationCap,
  ClipboardList,
  Zap,
  BarChart3,
  Settings,
  Menu,
  Briefcase,
  BookOpen,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navMap: Record<string, NavItem[]> = {
  SUPER_ADMIN: [
    { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { title: "Colleges", href: "/admin/colleges", icon: Building2 },
    { title: "Library", href: "/admin/library", icon: BookOpen },
    { title: "Users", href: "/admin/users", icon: Users },
    { title: "Settings", href: "/admin/settings", icon: Settings },
  ],
  COLLEGE_ADMIN: [
    { title: "Dashboard", href: "/college", icon: LayoutDashboard },
    { title: "Drives", href: "/college/drives", icon: Briefcase },
    { title: "Library", href: "/college/library", icon: BookOpen },
    { title: "Students", href: "/college/students", icon: GraduationCap },
    { title: "Departments", href: "/college/departments", icon: Building2 },
    { title: "Reports", href: "/college/reports", icon: BarChart3 },
    { title: "Settings", href: "/college/settings", icon: Settings },
  ],
  STUDENT: [
    { title: "Dashboard", href: "/student", icon: LayoutDashboard },
    { title: "Drives", href: "/student/drives", icon: Briefcase },
    { title: "Tests", href: "/student/tests", icon: ClipboardList },
    { title: "Results", href: "/student/results", icon: BarChart3 },
    { title: "Settings", href: "/student/settings", icon: Settings },
  ],
};

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { role: authRole } = useAuth();
  const role = authRole ?? "STUDENT";
  const navItems = navMap[role] || [];
  const dashboardHref =
    role === "SUPER_ADMIN" ? "/admin" : role === "COLLEGE_ADMIN" ? "/college" : "/student";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Toggle navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
        <div className="flex items-center h-14 px-6 border-b border-sidebar-border">
          <Link href={dashboardHref} className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <Zap className="size-4 text-sidebar-primary-foreground" aria-hidden="true" />
            </div>
            <span className="text-lg font-bold tracking-tight text-sidebar-foreground">PrepZero</span>
          </Link>
        </div>
        <nav className="px-3 py-4 space-y-1">
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
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className={cn("size-4 shrink-0", isActive && "text-sidebar-primary")} aria-hidden="true" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
