"use client";

import { AuthProvider } from "./auth-provider";
import { TRPCProvider } from "./trpc-provider";
import { ThemeProvider } from "next-themes";
import type { AuthSession, AuthUser } from "./auth-provider";

interface ProvidersProps {
  children: React.ReactNode;
  session: AuthSession | null;
  user: AuthUser | null;
}

export function Providers({ children, session, user }: ProvidersProps) {
  return (
    <AuthProvider session={session} user={user}>
      <TRPCProvider>
        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </TRPCProvider>
    </AuthProvider>
  );
}
