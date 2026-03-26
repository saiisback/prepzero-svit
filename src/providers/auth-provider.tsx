"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/generated/prisma/client";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  collegeId: string | null;
  departmentId: string | null;
  semester: number | null;
  usn: string | null;
}

export interface AuthSession {
  id: string;
  expiresAt: Date;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  role: Role | null;
  isAdmin: boolean;
  isCollegeAdmin: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isAuthenticated: false,
  role: null,
  isAdmin: false,
  isCollegeAdmin: false,
  isStudent: false,
});

export function AuthProvider({
  children,
  session,
  user,
}: {
  children: React.ReactNode;
  session: AuthSession | null;
  user: AuthUser | null;
}) {
  const value: AuthContextValue = {
    user,
    session,
    isAuthenticated: !!session && !!user,
    role: user?.role ?? null,
    isAdmin: user?.role === "SUPER_ADMIN",
    isCollegeAdmin: user?.role === "COLLEGE_ADMIN",
    isStudent: user?.role === "STUDENT",
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function useRequireAuth() {
  const auth = useAuth();
  if (!auth.isAuthenticated || !auth.user) {
    throw new Error("User must be authenticated");
  }
  return auth as AuthContextValue & { user: AuthUser; session: AuthSession };
}
