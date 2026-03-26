"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { LogOut, Settings, Zap } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";

const roleMeta: Record<
  string,
  { label: string; variant: "destructive" | "default" | "secondary" }
> = {
  SUPER_ADMIN:   { label: "Super Admin",   variant: "destructive" },
  COLLEGE_ADMIN: { label: "College Admin", variant: "default"     },
  STUDENT:       { label: "Student",       variant: "secondary"   },
};

export function Topbar() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const user = {
    name: authUser?.name ?? "",
    email: authUser?.email ?? "",
    role: authUser?.role ?? "STUDENT",
  };

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const role = roleMeta[user.role] ?? { label: user.role, variant: "secondary" as const };

  const dashboardHref =
    user.role === "SUPER_ADMIN"
      ? "/admin"
      : user.role === "COLLEGE_ADMIN"
        ? "/college"
        : "/student";

  const settingsHref = `${dashboardHref}/settings`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-stretch border-b border-border shadow-sm">

      {/* ── Left: logo zone — dark, matches sidebar ── */}
      <div className="hidden md:flex items-center w-64 shrink-0 px-5 bg-sidebar border-r border-sidebar-border">
        <Link href={dashboardHref} className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-sidebar-primary shadow-sm">
            <Zap className="size-4 text-sidebar-primary-foreground" aria-hidden="true" />
          </div>
          <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
            PrepZero
          </span>
        </Link>
      </div>

      {/* ── Right: white content zone ── */}
      <div className="flex flex-1 items-center px-5 gap-3 bg-card">
        {/* Mobile hamburger */}
        <MobileNav />

        <div className="flex-1" />

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          {user.role === "COLLEGE_ADMIN" && <NotificationBell />}
          <ThemeToggle />

          <div className="h-5 w-px bg-border mx-1" />

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 h-8 px-2.5 rounded-lg hover:bg-muted text-foreground"
                aria-label="Open user menu"
              >
                <Avatar className="size-7">
                  <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:flex flex-col items-start">
                  <span className="text-sm font-medium leading-none">{user.name.split(" ")[0]}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{role.label}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-60">
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <p className="truncate text-sm font-semibold leading-none">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    <Badge variant={role.variant} className="mt-1 w-fit px-1.5 py-0 text-[10px]">
                      {role.label}
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href={settingsHref}>
                  <Settings className="mr-2 size-4" aria-hidden="true" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 size-4" aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
