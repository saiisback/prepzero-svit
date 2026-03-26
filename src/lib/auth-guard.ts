import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import type { Role } from "@/generated/prisma/client";

export const getSession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
});

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(role: Role) {
  const session = await requireAuth();
  const userRole = (session.user as { role?: string }).role;
  if (userRole !== role) {
    redirect("/login");
  }
  return session;
}

export function getRoleRedirect(role: string) {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin";
    case "COLLEGE_ADMIN":
      return "/college";
    case "STUDENT":
      return "/student";
    default:
      return "/login";
  }
}
