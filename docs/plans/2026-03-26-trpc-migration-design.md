# tRPC Migration — Full Design Document

**Date:** 2026-03-26
**Scope:** Full migration from Next.js API routes to tRPC v11
**Status:** Ready for implementation

---

## 0. How to Execute This Plan

**This document is self-contained.** A fresh Claude Code session can execute it without prior conversation context.

### Starting a fresh session

Paste this prompt to start execution:

```
Read the migration plan at docs/plans/2026-03-26-trpc-migration-design.md and execute it phase by phase.
Start from Phase 1. Follow the guidelines in Section 11 strictly. For each phase:
1. Read the relevant existing source files listed in the task
2. Implement the task
3. Verify the task works (build check where indicated)
4. Move to the next task

Before building any router (Phase 3), always read the existing API route files listed in each task to extract the exact business logic. Do not guess — migrate the actual code.
```

### Continuing from a specific phase

If you need to resume from a specific phase (e.g., after clearing context):

```
Read docs/plans/2026-03-26-trpc-migration-design.md. Resume execution from Phase X, task X.Y.
The previous phases are already complete. Verify by checking that the files from earlier phases exist, then continue.
```

### Key context the agent needs

- **CLAUDE.md** at project root has the full tech stack, commands, and current architecture
- **Existing API routes** are in `src/app/api/` — each router task lists which route files to read and migrate
- **Prisma schema** is at `prisma/schema.prisma` — read it before building schemas in Phase 2
- **Existing components** are in `src/components/` and `src/app/(dashboard)/` — read them before Phase 4-10 rewrites
- **Package versions matter:** Next.js 16, React 19, Prisma 7, Zod 4, Better Auth 1.4 — check tRPC v11 compatibility

### What NOT to do

- Do NOT skip reading existing files before writing replacements
- Do NOT delete old API routes until Phase 11 (they serve as reference throughout)
- Do NOT install tRPC v10 — this plan targets v11 specifically
- Do NOT create incremental migration shims — this is a full migration
- Do NOT modify the Prisma schema or database — only the application layer changes

---

## Table of Contents

1. [Decisions Summary](#1-decisions-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [File Structure](#3-file-structure)
4. [tRPC Server Setup](#4-trpc-server-setup)
5. [Auth Provider Design](#5-auth-provider-design)
6. [Schema Organization](#6-schema-organization)
7. [Router Specifications](#7-router-specifications)
8. [Shared Components](#8-shared-components)
9. [Test Interface Decomposition](#9-test-interface-decomposition)
10. [Client Data Fetching Patterns](#10-client-data-fetching-patterns)
11. [Guidelines — Do's and Don'ts](#11-guidelines--dos-and-donts)
12. [Task Breakdown](#12-task-breakdown)

---

## 1. Decisions Summary

| Decision | Choice |
|----------|--------|
| Migration strategy | Full migration (big-bang), not incremental |
| tRPC version | v11 with TanStack Query v5 |
| Auth caching | Single AuthProvider at root layout, server-fetched |
| Server component data | tRPC server caller (`createCallerFactory`) — no direct Prisma in pages |
| Router organization | Domain-based (~12 routers) |
| Surviving API routes | Only `/api/auth/[...all]` and `/api/cron/test-notifications` |
| Duplicated pages | Shared components + role from AuthContext |
| Test interface | Sub-components + colocated hooks + TestProvider context |
| SWR | Removed entirely, TanStack Query replaces it |
| Zod schemas | Central `src/server/schemas/` directory, shared by routers + forms |
| Server code location | `src/server/` directory |

---

## 2. Architecture Overview

### Before (Current)

```
Client Component
  → useEffect + fetch("/api/xyz")
    → API Route (route.ts)
      → manual auth check (duplicated)
      → manual Zod validation (duplicated)
      → Prisma query
      → manual try/catch (duplicated)
    → useState for response
    → manual loading/error states
```

### After (tRPC)

```
Client Component
  → trpc.xyz.useQuery() / useMutation()
    → TanStack Query (caching, dedup, retry)
      → tRPC HTTP handler (/api/trpc/[trpc])
        → context middleware (session resolved ONCE)
        → role middleware (auth checked ONCE per procedure type)
        → input validation (Zod schema, automatic)
        → procedure handler (business logic only)
      → typed response, cached
    → isLoading / error / data (automatic)

Server Component
  → trpc caller (createCallerFactory)
    → same procedure handler (no HTTP, direct call)
    → typed response
```

### Key Improvements

- **Auth:** 1 fetch in root layout → context everywhere (was: N fetches per page)
- **Validation:** Zod schemas defined once, used by tRPC input AND react-hook-form
- **Error handling:** tRPC error formatter handles all errors (was: ~100 try/catch blocks)
- **Caching:** TanStack Query deduplicates, caches, background-refetches (was: none)
- **Type safety:** End-to-end from Prisma → tRPC router → client (was: `as` casts everywhere)
- **Code reduction:** ~4,000 lines of duplication eliminated

---

## 3. File Structure

```
src/
  server/
    trpc.ts                       # tRPC init, context type, base procedures, middleware
    context.ts                    # createContext — resolves Better Auth session
    routers/
      _app.ts                     # appRouter = mergeRouters(all 12)
      college.ts                  # 5 procedures
      department.ts               # 3 procedures
      drive.ts                    # 4 procedures
      test.ts                     # 7 procedures
      question.ts                 # 5 procedures
      student.ts                  # 8 procedures
      attempt.ts                  # 6 procedures
      library.ts                  # 9 procedures
      report.ts                   # 2 procedures
      stats.ts                    # 1 procedure
      user.ts                     # 1 procedure
      notification.ts             # 1 procedure
      index.ts                    # barrel export
    schemas/
      college.ts
      department.ts
      drive.ts
      test.ts
      question.ts                 # optionSchema, testCaseSchema, mcqSchema, codingSchema
      student.ts
      attempt.ts
      library.ts
      report.ts
      common.ts                   # paginationSchema, idSchema, searchSchema
      index.ts                    # barrel export
  providers/
    auth-provider.tsx             # AuthContext + useAuth() hook
    trpc-provider.tsx             # QueryClientProvider + tRPC httpBatchLink
    index.tsx                     # <Providers> combining auth + trpc + theme
  lib/
    trpc.ts                       # createTRPCReact<AppRouter>() — client hooks
    trpc-server.ts                # createCallerFactory — for RSC
    auth.ts                       # Better Auth config (UNCHANGED)
    auth-client.ts                # Better Auth client (UNCHANGED)
    prisma.ts                     # Prisma singleton (UNCHANGED)
    judge0.ts                     # Judge0 helpers (UNCHANGED, used by attempt router)
    email.ts                      # Nodemailer (UNCHANGED)
    report-csv.ts                 # CSV generation (UNCHANGED)
    test-eligibility.ts           # Eligibility logic (UNCHANGED)
    csv-parser.ts                 # CSV parsing (UNCHANGED for now)
    student-csv-parser.ts         # (UNCHANGED for now)
    library-csv-parser.ts         # (UNCHANGED for now)
    spreadsheet.ts                # (UNCHANGED)
    utils.ts                      # cn() etc (UNCHANGED)
  components/
    shared/
      question-form.tsx           # Unified question create/edit for library + test
      library-list.tsx            # Unified library page for admin + college
      category-manager.tsx        # Category CRUD UI
      pagination.tsx              # Reusable pagination controls
      stats-card.tsx              # Dashboard stat card
      data-table.tsx              # Generic table wrapper
      index.ts                    # barrel export
    test/
      test-provider.tsx           # TestContext — orchestrates all test-taking state
      test-interface.tsx          # Thin shell (~80 lines) — layout composition
      question-renderer.tsx       # MCQ options / coding editor display
      question-navigator.tsx      # Sidebar question list
      test-timer.tsx              # Countdown display
      violation-manager.tsx       # Event listeners, reports violations
      code-editor.tsx             # (EXISTS, kept)
      submit-dialog.tsx           # (EXISTS, kept)
      violation-banner.tsx        # (EXISTS, kept)
      hooks/
        use-test-timer.ts         # Countdown logic + auto-submit trigger
        use-test-answers.ts       # Answer state + debounced tRPC save
        use-test-violations.ts    # Wraps useProctoring + tRPC violation reporting
        use-test-navigation.ts    # Question index, next/prev, answered tracking
        index.ts                  # barrel export
    dashboard/                    # (EXISTING, updated to use useAuth())
      sidebar.tsx
      topbar.tsx
      mobile-nav.tsx
      ...
    ui/                           # (EXISTING, UNCHANGED)
  hooks/
    use-proctoring.ts             # (EXISTING, used by use-test-violations)
  app/
    api/
      trpc/[trpc]/route.ts       # NEW — tRPC HTTP handler (only tRPC entry point)
      auth/[...all]/route.ts      # KEPT — Better Auth catch-all
      cron/test-notifications/route.ts  # KEPT — Vercel cron
    (dashboard)/
      admin/
        page.tsx                  # Thin wrapper → uses tRPC caller + StatsCard
        layout.tsx                # Uses useAuth() for role check
        library/
          page.tsx                # Thin wrapper → <LibraryList scope="global" />
          new/page.tsx            # Thin wrapper → <QuestionForm target="library" mode="create" />
          [questionId]/page.tsx   # Thin wrapper → <QuestionForm target="library" mode="edit" />
          upload/page.tsx         # Kept but uses tRPC mutation
        colleges/...              # Simplified, uses tRPC
        users/...                 # Simplified, uses tRPC
        settings/...
      college/
        page.tsx
        layout.tsx
        library/
          page.tsx                # Thin wrapper → <LibraryList scope="college" />
          new/page.tsx            # Thin wrapper → <QuestionForm target="library" mode="create" />
          [questionId]/page.tsx   # Thin wrapper → <QuestionForm target="library" mode="edit" />
          upload/page.tsx
        drives/...                # Simplified, uses tRPC
        students/...              # Simplified, uses tRPC
        reports/...               # Simplified, uses tRPC
        departments/...
        settings/...
      student/
        page.tsx
        layout.tsx
        drives/...
        tests/...
        results/...
        settings/...
    (auth)/                       # Minimal changes — forms call tRPC mutations
      login/page.tsx
      register/page.tsx
      register/student/page.tsx
    test/[testId]/page.tsx        # Uses TestProvider + decomposed components
    layout.tsx                    # Root — wraps with <Providers session={...}>
```

### Files DELETED after migration

All 44 API route files except:
- `src/app/api/auth/[...all]/route.ts`
- `src/app/api/cron/test-notifications/route.ts`

Deleted directories:
- `src/app/api/colleges/`
- `src/app/api/departments/`
- `src/app/api/drives/`
- `src/app/api/tests/`
- `src/app/api/students/`
- `src/app/api/attempts/`
- `src/app/api/library/`
- `src/app/api/reports/`
- `src/app/api/stats/`
- `src/app/api/users/`
- `src/app/api/notifications/`
- `src/app/api/auth/register-college-admin/`
- `src/app/api/auth/register-student/`
- `src/app/api/auth/departments/`

---

## 4. tRPC Server Setup

### `src/server/context.ts`

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export async function createContext(opts: FetchCreateContextFnOptions) {
  const session = await auth.api.getSession({
    headers: opts.req.headers,
  });

  return {
    prisma,
    session,
    user: session?.user ?? null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

### `src/server/trpc.ts`

```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";
import type { Role } from "@/generated/prisma/client";

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Expose Zod validation errors to client
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

// --- Middleware ---

const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.user as {
        id: string;
        name: string;
        email: string;
        role: Role;
        collegeId: string | null;
        departmentId: string | null;
        semester: number | null;
        usn: string | null;
      },
    },
  });
});

const requireRole = (roles: Role[]) =>
  isAuthenticated.unstable_pipe(({ ctx, next }) => {
    if (!roles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
    }
    return next({ ctx });
  });

// --- Base Procedures ---

export const protectedProcedure = t.procedure.use(isAuthenticated);
export const adminProcedure = t.procedure.use(requireRole(["SUPER_ADMIN"]));
export const collegeAdminProcedure = t.procedure.use(requireRole(["COLLEGE_ADMIN"]));
export const studentProcedure = t.procedure.use(requireRole(["STUDENT"]));

// For procedures accessible by multiple roles
export const roleProtectedProcedure = (roles: Role[]) =>
  t.procedure.use(requireRole(roles));
```

### `src/app/api/trpc/[trpc]/route.ts`

```typescript
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/context";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
```

### `src/lib/trpc.ts` (Client)

```typescript
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/routers/_app";

export const trpc = createTRPCReact<AppRouter>();
```

### `src/lib/trpc-server.ts` (Server Caller for RSC)

```typescript
import "server-only";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

const createCaller = createCallerFactory(appRouter);

export async function getServerTrpc() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return createCaller({
    prisma,
    session,
    user: session?.user ?? null,
  });
}
```

---

## 5. Auth Provider Design

### `src/providers/auth-provider.tsx`

```typescript
"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/generated/prisma/client";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  collegeId: string | null;
  departmentId: string | null;
  semester: number | null;
  usn: string | null;
}

interface AuthSession {
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

// Convenience hook that throws if not authenticated
export function useRequireAuth() {
  const auth = useAuth();
  if (!auth.isAuthenticated || !auth.user) {
    throw new Error("User must be authenticated");
  }
  return auth as AuthContextValue & { user: AuthUser; session: AuthSession };
}
```

### `src/providers/trpc-provider.tsx`

```typescript
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "@/lib/trpc";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,       // 30s — data is fresh for 30s
            refetchOnWindowFocus: false, // don't refetch on tab switch
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

### `src/providers/index.tsx`

```typescript
"use client";

import { AuthProvider } from "./auth-provider";
import { TRPCProvider } from "./trpc-provider";
import { ThemeProvider } from "next-themes";

interface ProvidersProps {
  children: React.ReactNode;
  session: any;
  user: any;
}

export function Providers({ children, session, user }: ProvidersProps) {
  return (
    <AuthProvider session={session} user={user}>
      <TRPCProvider>
        <ThemeProvider attribute="class" defaultTheme="light">
          {children}
        </ThemeProvider>
      </TRPCProvider>
    </AuthProvider>
  );
}
```

### Root Layout Integration

```typescript
// src/app/layout.tsx
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Providers } from "@/providers";

export default async function RootLayout({ children }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <html lang="en">
      <body>
        <Providers
          session={session?.session ?? null}
          user={session?.user ?? null}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

---

## 6. Schema Organization

### Naming Convention

Each schema file exports:
- **Input schemas** — named `{action}{Entity}Schema` (e.g., `createCollegeSchema`, `updateTestSchema`)
- **Shared sub-schemas** — named `{entity}Schema` (e.g., `optionSchema`, `testCaseSchema`)
- **Filter/query schemas** — named `{entity}FilterSchema` (e.g., `studentFilterSchema`)

### `src/server/schemas/common.ts`

```typescript
import { z } from "zod";

export const idSchema = z.object({ id: z.string() });
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export const searchSchema = z.object({
  search: z.string().optional(),
});
```

### `src/server/schemas/question.ts` (example — most shared)

```typescript
import { z } from "zod";

export const optionSchema = z.object({
  id: z.string(),
  text: z.string().min(1, "Option text is required"),
});

export const testCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  isSample: z.boolean().default(false),
  order: z.number().int().optional(),
});

export const mcqQuestionSchema = z.object({
  questionType: z.literal("SINGLE_SELECT").or(z.literal("MULTI_SELECT")),
  text: z.string().min(1),
  options: z.array(optionSchema).min(2).max(6),
  correctOptionIds: z.array(z.string()).min(1),
  marks: z.number().int().min(1).default(1),
  negativeMarks: z.number().min(0).default(0),
  explanation: z.string().optional(),
});

export const codingQuestionSchema = z.object({
  questionType: z.literal("CODING"),
  text: z.string().min(1),
  marks: z.number().int().min(1).default(1),
  negativeMarks: z.number().min(0).default(0),
  testCases: z.array(testCaseSchema).min(1),
  explanation: z.string().optional(),
  defaultCode: z.string().optional(),
  allowedLanguages: z.array(z.enum(["PYTHON", "JAVA", "C", "CPP"])).optional(),
});

export const questionSchema = z.discriminatedUnion("questionType", [
  mcqQuestionSchema.extend({ questionType: z.literal("SINGLE_SELECT") }),
  mcqQuestionSchema.extend({ questionType: z.literal("MULTI_SELECT") }),
  codingQuestionSchema,
]);
```

### Schema Sharing Between Server and Client

```typescript
// In a tRPC router:
import { questionSchema } from "@/server/schemas";
export const questionRouter = router({
  create: protectedProcedure.input(questionSchema).mutation(...)
});

// In a React Hook Form:
import { questionSchema } from "@/server/schemas";
const form = useForm({ resolver: zodResolver(questionSchema) });
```

One schema definition. Two consumers. Zero duplication.

---

## 7. Router Specifications

### `college.ts` — 5 procedures

| Procedure | Type | Base | Input | Description |
|-----------|------|------|-------|-------------|
| `list` | query | adminProcedure | paginationSchema + searchSchema | List all colleges |
| `getById` | query | protectedProcedure | `{ id: string }` | College details + stats. Admin sees any, collegeAdmin sees own |
| `create` | mutation | adminProcedure | createCollegeSchema | Create college |
| `update` | mutation | protectedProcedure | updateCollegeSchema | Admin or owning college admin |
| `getUsnStructure` | query | collegeAdminProcedure | none | Reads from session's collegeId |

### `department.ts` — 3 procedures

| Procedure | Type | Base | Input | Description |
|-----------|------|------|-------|-------------|
| `list` | query | protectedProcedure | `{ collegeId?: string }` | Filtered by role. CollegeAdmin auto-scoped |
| `create` | mutation | collegeAdminProcedure | `{ name, code }` | Scoped to user's college |
| `delete` | mutation | collegeAdminProcedure | `{ id }` | Scoped to user's college |

### `drive.ts` — 4 procedures

| Procedure | Type | Base | Input | Description |
|-----------|------|------|-------|-------------|
| `list` | query | protectedProcedure | filters + pagination | Role-scoped listing |
| `getById` | query | protectedProcedure | `{ id }` | With college access check |
| `create` | mutation | collegeAdminProcedure | createDriveSchema | |
| `update` | mutation | collegeAdminProcedure | updateDriveSchema | With college ownership check |

### `test.ts` — 7 procedures

| Procedure | Type | Base | Input | Description |
|-----------|------|------|-------|-------------|
| `list` | query | protectedProcedure | `{ driveId }` + pagination | |
| `getById` | query | protectedProcedure | `{ id }` | Full test details |
| `create` | mutation | collegeAdminProcedure | createTestSchema | |
| `update` | mutation | collegeAdminProcedure | updateTestSchema | |
| `start` | mutation | studentProcedure | `{ testId }` | Creates attempt, handles P2002 |
| `submit` | mutation | studentProcedure | `{ attemptId }` | Scoring + grade calculation |
| `monitor` | query | collegeAdminProcedure | `{ testId }` | Live attempts for proctor view |

### `question.ts` — 5 procedures

| Procedure | Type | Base | Input | Description |
|-----------|------|------|-------|-------------|
| `list` | query | protectedProcedure | `{ testId }` | |
| `create` | mutation | collegeAdminProcedure | questionSchema + `{ testId }` | Also recalculates totalMarks |
| `update` | mutation | collegeAdminProcedure | questionSchema + `{ id }` | Replaces test cases |
| `delete` | mutation | collegeAdminProcedure | `{ id }` | Recalculates totalMarks |
| `bulkCreate` | mutation | collegeAdminProcedure | `{ testId, questions[] }` | CSV import |

**Shared helper (not a procedure):**
```typescript
async function recalculateTestTotalMarks(tx: PrismaTransaction, testId: string) {
  const questions = await tx.question.findMany({ where: { testId }, select: { marks: true } });
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
  await tx.test.update({ where: { id: testId }, data: { totalMarks } });
}
```

### `student.ts` — 8 procedures

| Procedure | Type | Base | Input | Description |
|-----------|------|------|-------|-------------|
| `list` | query | protectedProcedure | filters + pagination + search | College-scoped |
| `getById` | query | protectedProcedure | `{ id }` | |
| `create` | mutation | collegeAdminProcedure | createStudentSchema | |
| `update` | mutation | protectedProcedure | updateStudentSchema | Admin/college or own profile |
| `bulkCreate` | mutation | collegeAdminProcedure | `{ students[] }` | CSV upload |
| `getProfile` | query | studentProcedure | none | Own profile from session |
| `resolve` | query | protectedProcedure | `{ usn? email? }` | Lookup by USN or email |
| `validate` | query | protectedProcedure | `{ studentId, testId }` | Check test eligibility |

### `attempt.ts` — 6 procedures

| Procedure | Type | Base | Input | Description |
|-----------|------|------|-------|-------------|
| `list` | query | protectedProcedure | filters | Role-scoped |
| `getById` | query | protectedProcedure | `{ id }` | With answers |
| `saveAnswer` | mutation | studentProcedure | saveAnswerSchema | Upsert MCQ or code answer |
| `runCode` | mutation | studentProcedure | `{ attemptId, questionId, code, language }` | Judge0 execution |
| `reportViolation` | mutation | studentProcedure | `{ attemptId, type, counts }` | Increment violations |
| `checkSession` | query | studentProcedure | `{ attemptId }` | Active session verification |

### `library.ts` — 9 procedures

| Procedure | Type | Base | Input | Description |
|-----------|------|------|-------|-------------|
| `listQuestions` | query | protectedProcedure | filters + pagination + search | Scope-aware |
| `getQuestion` | query | protectedProcedure | `{ id }` | |
| `createQuestion` | mutation | protectedProcedure | libraryQuestionSchema | Admin = global, college = scoped |
| `updateQuestion` | mutation | protectedProcedure | libraryQuestionSchema + `{ id }` | Ownership check |
| `deleteQuestion` | mutation | protectedProcedure | `{ id }` | Ownership check |
| `bulkCreateQuestions` | mutation | protectedProcedure | `{ questions[] }` | CSV upload |
| `bulkDeleteQuestions` | mutation | protectedProcedure | `{ ids[] }` | |
| `importToTest` | mutation | collegeAdminProcedure | `{ questionIds[], testId }` | Copy to test |
| `saveFromTest` | mutation | collegeAdminProcedure | `{ questionIds[], testId }` | Copy from test |
| `listCategories` | query | protectedProcedure | none | Global + college-scoped |
| `createCategory` | mutation | protectedProcedure | `{ name }` | |
| `updateCategory` | mutation | protectedProcedure | `{ id, name }` | |
| `deleteCategory` | mutation | protectedProcedure | `{ id }` | |

> Note: Categories are part of the library router since they're tightly coupled. This keeps it at 12 routers total rather than adding a 13th.

### `report.ts` — 2 procedures

| Procedure | Type | Base | Input | Description |
|-----------|------|------|-------|-------------|
| `download` | query | collegeAdminProcedure | `{ testId }` | Returns base64 CSV string |
| `sendEmail` | mutation | collegeAdminProcedure | `{ testId }` | Emails CSV to college admin |

### `stats.ts` — 1 procedure

| Procedure | Type | Base | Input | Description |
|-----------|------|------|-------|-------------|
| `getDashboard` | query | protectedProcedure | none | Returns role-specific aggregated stats |

### `user.ts` — 1 procedure

| Procedure | Type | Base | Input | Description |
|-----------|------|------|-------|-------------|
| `delete` | mutation | adminProcedure | `{ id }` | Super admin only |

### `notification.ts` — 1 procedure

| Procedure | Type | Base | Input | Description |
|-----------|------|------|-------|-------------|
| `sendPending` | mutation | publicProcedure | `{ cronSecret }` | Called by cron route internally. Validates secret. |

### `auth.ts` — 3 procedures (registration only)

| Procedure | Type | Base | Input | Description |
|-----------|------|------|-------|-------------|
| `registerCollegeAdmin` | mutation | publicProcedure | `{ name, email, password, collegeName, collegeCode }` | Creates college + admin user. Migrated from `/api/auth/register-college-admin` |
| `registerStudent` | mutation | publicProcedure | `{ name, email, password, collegeCode, usn, departmentId, semester }` | Creates student user. Migrated from `/api/auth/register-student` |
| `listDepartments` | query | publicProcedure | `{ collegeCode }` | Lists departments for a college (used during student registration). Migrated from `/api/auth/departments` |

> Note: Login/logout remain handled by Better Auth's catch-all route (`/api/auth/[...all]`). Only custom registration flows become tRPC procedures.

### Source File Reference for Router Migration

When building each router in Phase 3, read these exact files to extract business logic:

| Router | Source Files to Read |
|--------|---------------------|
| `college.ts` | `src/app/api/colleges/route.ts`, `src/app/api/colleges/[collegeId]/route.ts`, `src/app/api/colleges/[collegeId]/stats/route.ts`, `src/app/api/colleges/usn-structure/route.ts` |
| `department.ts` | `src/app/api/departments/route.ts`, `src/app/api/departments/[departmentId]/route.ts` |
| `drive.ts` | `src/app/api/drives/route.ts`, `src/app/api/drives/[driveId]/route.ts` |
| `test.ts` | `src/app/api/tests/route.ts`, `src/app/api/tests/[testId]/route.ts`, `src/app/api/tests/[testId]/start/route.ts`, `src/app/api/tests/[testId]/submit/route.ts`, `src/app/api/tests/[testId]/monitor/route.ts` |
| `question.ts` | `src/app/api/tests/[testId]/questions/route.ts`, `src/app/api/tests/[testId]/questions/[questionId]/route.ts`, `src/app/api/tests/[testId]/questions/bulk/route.ts` |
| `student.ts` | `src/app/api/students/route.ts`, `src/app/api/students/[studentId]/route.ts`, `src/app/api/students/bulk/route.ts`, `src/app/api/students/profile/route.ts`, `src/app/api/students/resolve/route.ts`, `src/app/api/students/validate/route.ts` |
| `attempt.ts` | `src/app/api/attempts/route.ts`, `src/app/api/attempts/[attemptId]/route.ts`, `src/app/api/attempts/[attemptId]/answers/route.ts`, `src/app/api/attempts/[attemptId]/run/route.ts`, `src/app/api/attempts/[attemptId]/violations/route.ts`, `src/app/api/attempts/[attemptId]/session-check/route.ts` |
| `library.ts` | `src/app/api/library/questions/route.ts`, `src/app/api/library/questions/[questionId]/route.ts`, `src/app/api/library/questions/bulk/route.ts`, `src/app/api/library/questions/bulk-delete/route.ts`, `src/app/api/library/questions/import/route.ts`, `src/app/api/library/questions/from-test/route.ts`, `src/app/api/library/categories/route.ts`, `src/app/api/library/categories/[categoryId]/route.ts` |
| `report.ts` | `src/app/api/reports/download/route.ts`, `src/app/api/reports/email/route.ts` |
| `stats.ts` | `src/app/api/stats/route.ts` |
| `user.ts` | `src/app/api/users/[userId]/route.ts` |
| `notification.ts` | `src/app/api/notifications/route.ts`, `src/app/api/cron/test-notifications/route.ts` |
| `auth.ts` | `src/app/api/auth/register-college-admin/route.ts`, `src/app/api/auth/register-student/route.ts`, `src/app/api/auth/departments/route.ts` |

---

## 8. Shared Components

### `src/components/shared/question-form.tsx`

**Props:**
```typescript
interface QuestionFormProps {
  mode: "create" | "edit";
  target: "library" | "test";
  testId?: string;          // required when target="test"
  questionId?: string;      // required when mode="edit"
  initialData?: QuestionData; // pre-filled for edit mode
}
```

**Behavior:**
- Reads `role` and `collegeId` from `useAuth()`
- Uses `react-hook-form` with Zod resolver (imports schema from `@/server/schemas`)
- On submit:
  - `target="library"` + `mode="create"` → `trpc.library.createQuestion.useMutation()`
  - `target="library"` + `mode="edit"` → `trpc.library.updateQuestion.useMutation()`
  - `target="test"` + `mode="create"` → `trpc.question.create.useMutation()`
  - `target="test"` + `mode="edit"` → `trpc.question.update.useMutation()`
- Handles MCQ/coding toggle, options CRUD, test case CRUD inline
- On success: invalidates relevant query cache + navigates back

**Replaces:** 6 near-identical page files (~2,400 lines → ~300 lines)

### `src/components/shared/library-list.tsx`

**Props:**
```typescript
interface LibraryListProps {
  scope: "global" | "college";
}
```

**Behavior:**
- `trpc.library.listQuestions.useQuery({ scope, page, search, category, difficulty })`
- Search bar, category filter, difficulty filter
- Bulk select + bulk delete via `trpc.library.bulkDeleteQuestions.useMutation()`
- Renders `<CategoryManager />` in sidebar/dialog
- Uses `<Pagination />` and `<DataTable />`
- Links to question edit: reads role from `useAuth()` to build correct URL path

**Replaces:** `admin/library/page.tsx` (754 lines) + `college/library/page.tsx` (817 lines) → ~400 lines

### `src/components/shared/category-manager.tsx`

**Props:** none (reads scope from `useAuth()`)

**Behavior:**
- `trpc.library.listCategories.useQuery()`
- Create, rename, delete categories via tRPC mutations
- Renders category list with inline edit
- Auto-invalidates cache on mutations

**Replaces:** Duplicated category dialogs across admin/college library pages

### `src/components/shared/pagination.tsx`

**Props:**
```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
```

**Replaces:** 4+ duplicated pagination implementations (results, report-table, students, library, users-table)

### `src/components/shared/stats-card.tsx`

**Props:**
```typescript
interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  iconBg?: string;
  iconColor?: string;
}
```

**Replaces:** 3 duplicated stat card renderers across dashboards

### `src/components/shared/data-table.tsx`

**Props:**
```typescript
interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  searchKey?: string;
  searchPlaceholder?: string;
}
```

Generic table using shadcn `<Table>` with consistent styling.

---

## 9. Test Interface Decomposition

### `src/components/test/test-provider.tsx`

```typescript
interface TestContextValue {
  // Attempt state
  attempt: AttemptData;
  test: TestData;
  questions: QuestionData[];

  // Navigation (from useTestNavigation)
  currentIndex: number;
  currentQuestion: QuestionData;
  goToQuestion: (index: number) => void;
  goNext: () => void;
  goPrev: () => void;
  answeredCount: number;

  // Answers (from useTestAnswers)
  answers: Map<string, AnswerData>;
  saveAnswer: (questionId: string, data: AnswerInput) => void;
  isSaving: boolean;

  // Code execution
  runCode: (questionId: string, code: string, language: string) => void;
  codeResult: CodeResult | null;
  isRunning: boolean;

  // Timer (from useTestTimer)
  timeRemaining: number;
  isExpired: boolean;

  // Violations (from useTestViolations)
  violations: ViolationState;
  totalViolations: number;
  maxViolations: number;

  // Submission
  submit: () => void;
  isSubmitting: boolean;
  isAutoSubmitted: boolean;
}
```

### Hook responsibilities

**`use-test-timer.ts`**
- Receives `startedAt` and `durationMinutes`
- `setInterval` for countdown (1s tick)
- Returns `{ timeRemaining, isExpired }`
- Calls `onExpire` callback when time runs out

**`use-test-answers.ts`**
- Maintains `Map<questionId, AnswerData>` state
- `saveAnswer(questionId, data)` — updates local state immediately, debounces tRPC mutation (500ms)
- Uses `trpc.attempt.saveAnswer.useMutation()`
- Returns `{ answers, saveAnswer, isSaving }`

**`use-test-violations.ts`**
- Wraps existing `useProctoring` hook
- Adds tRPC violation reporting: `trpc.attempt.reportViolation.useMutation()`
- Returns `{ violations, totalViolations }`
- Calls `onAutoSubmit` when `maxViolations` reached

**`use-test-navigation.ts`**
- Manages `currentIndex` state
- `goToQuestion(index)`, `goNext()`, `goPrev()` with bounds checking
- Derives `currentQuestion` from `questions[currentIndex]`
- Tracks answered questions: `answeredCount`, `isAnswered(questionId)`

### Component hierarchy

```
<TestProvider initialData={...}>         ← Context provider
  <ViolationManager />                   ← No UI, registers event listeners
  <div className="flex">
    <QuestionNavigator />                ← Sidebar: question list + status
    <div className="flex-1">
      <TestTimer />                      ← Top bar: countdown display
      <QuestionRenderer />               ← Main area: MCQ or code editor
      <div className="footer">
        nav buttons + <SubmitDialog />
      </div>
    </div>
  </div>
</TestProvider>
```

---

## 10. Client Data Fetching Patterns

### Pattern 1: Server Component with tRPC Caller

```typescript
// For pages that can be fully server-rendered
import { getServerTrpc } from "@/lib/trpc-server";

export default async function DrivesPage() {
  const trpc = await getServerTrpc();
  const drives = await trpc.drive.list({ page: 1, pageSize: 20 });

  return <DrivesList initialData={drives} />;
}
```

### Pattern 2: Client Component with useQuery

```typescript
// For pages with interactive filtering/pagination/search
"use client";
import { trpc } from "@/lib/trpc";

export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.student.list.useQuery({ search, page });

  if (isLoading) return <Skeleton />;
  return <DataTable data={data.students} ... />;
}
```

### Pattern 3: Mutation with Cache Invalidation

```typescript
"use client";
import { trpc } from "@/lib/trpc";

function CreateDriveForm() {
  const utils = trpc.useUtils();
  const createDrive = trpc.drive.create.useMutation({
    onSuccess: () => {
      utils.drive.list.invalidate(); // Refetch drive list
      toast.success("Drive created");
      router.push("/college/drives");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <form onSubmit={form.handleSubmit((data) => createDrive.mutate(data))}>
      {/* form fields */}
      <Button disabled={createDrive.isPending}>
        {createDrive.isPending ? "Creating..." : "Create"}
      </Button>
    </form>
  );
}
```

### Pattern 4: Server-Rendered Page with Client Interactivity

```typescript
// Page is server component — fast initial render
import { getServerTrpc } from "@/lib/trpc-server";

export default async function TestDetailPage({ params }) {
  const { testId } = await params;
  const trpc = await getServerTrpc();
  const test = await trpc.test.getById({ id: testId });

  // Pass server data to client component for mutations
  return <TestDetailClient test={test} />;
}
```

### Pattern 5: Polling (Monitor Page)

```typescript
"use client";

function MonitorPage({ testId }: { testId: string }) {
  const { data } = trpc.test.monitor.useQuery(
    { testId },
    { refetchInterval: 5000 } // Poll every 5s — replaces setInterval + useEffect
  );

  return <MonitorTable attempts={data?.attempts ?? []} />;
}
```

---

## 11. Guidelines — Do's and Don'ts

### STRICT RULES — Must Follow

#### Architecture

- **DO** put ALL business logic in tRPC routers. No Prisma queries in page files or components.
- **DO** use `getServerTrpc()` for server components. Never import `prisma` directly in pages.
- **DO** keep page files as thin wrappers (<50 lines). They fetch data and compose components.
- **DON'T** create new API routes. Only `/api/auth/[...all]`, `/api/cron/test-notifications`, and `/api/trpc/[trpc]` should exist.
- **DON'T** import from `@/lib/prisma` in any file under `src/app/` or `src/components/`. Only `src/server/` touches Prisma.

#### tRPC

- **DO** choose the most restrictive base procedure for each endpoint (`adminProcedure` > `protectedProcedure` > `publicProcedure`).
- **DO** validate all inputs with Zod schemas from `@/server/schemas/`.
- **DO** throw `TRPCError` with appropriate codes (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `CONFLICT`).
- **DO** use Prisma transactions (`prisma.$transaction`) for multi-step mutations.
- **DO** handle `P2002` (unique constraint) errors as `CONFLICT` for race conditions.
- **DON'T** return `NextResponse.json()` from tRPC procedures. Just return the data directly.
- **DON'T** do manual try/catch in procedures for generic errors. The tRPC error formatter handles it.
- **DON'T** create procedures that accept `role` as an input parameter. Role comes from context middleware.
- **DON'T** use `any` in tRPC context or procedure returns. Everything must be typed.

#### Schemas

- **DO** define schemas in `src/server/schemas/` and import them in both routers AND client forms.
- **DO** use `z.discriminatedUnion` for question types (MCQ vs CODING).
- **DON'T** define Zod schemas inline in router files. Always import from schemas directory.
- **DON'T** duplicate schemas. If two routers need the same schema, put it in `common.ts` or the most relevant domain file and import it.

#### Auth

- **DO** fetch session once in root layout and pass to `<Providers>`.
- **DO** use `useAuth()` hook in client components. Never call `useSession()` from Better Auth directly.
- **DO** use `useRequireAuth()` when the component MUST have an authenticated user.
- **DON'T** pass `user`, `session`, `role`, `collegeId` as props. Read from `useAuth()`.
- **DON'T** call `auth.api.getSession()` in page files. Use `getServerTrpc()` which handles it.
- **DON'T** use type assertions for session user (`as { role: string }`). The tRPC context types it properly.

#### Data Fetching

- **DO** use `trpc.*.useQuery()` for all client-side reads.
- **DO** use `trpc.*.useMutation()` for all client-side writes.
- **DO** use `utils.*.invalidate()` after mutations to refetch affected queries.
- **DO** use `refetchInterval` for polling (monitor page) instead of `setInterval`.
- **DON'T** use `useEffect` for data fetching. Ever. Use `useQuery`.
- **DON'T** use `fetch()` to call your own API. Use tRPC.
- **DON'T** use `useState` for loading/error states from data fetching. `useQuery` provides `isLoading`, `error`.
- **DON'T** use SWR. It's been removed. Use TanStack Query via tRPC.

#### Components

- **DO** use shared components from `src/components/shared/` for cross-role UI.
- **DO** let shared components determine behavior from `useAuth()` role — not from props.
- **DON'T** duplicate a component for admin vs college. Make one shared component.
- **DON'T** pass more than 3-4 props to a component. If you need more, use context.
- **DON'T** create `useEffect` + `useState` combinations for data that tRPC can handle.

#### Test Interface

- **DO** use `useTest()` hook inside test sub-components. Never pass test state as props.
- **DO** keep sub-components focused: one component = one responsibility.
- **DON'T** add state to `test-interface.tsx` shell. All state lives in `TestProvider` and hooks.
- **DON'T** call tRPC mutations directly from sub-components. Call the handler from `useTest()` context.

#### File Organization

- **DO** use barrel exports (`index.ts`) in `schemas/`, `routers/`, `shared/`, `hooks/`.
- **DO** import from barrels: `import { optionSchema } from "@/server/schemas"` not `from "@/server/schemas/question"`.
- **DON'T** create circular imports. Schemas → Routers → never back to schemas.
- **DON'T** put server-only code in files that could be imported client-side. Use `"server-only"` import guard.

#### Error Handling

- **DO** use tRPC's built-in error formatter for consistent error responses.
- **DO** use `TRPCError` codes: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `BAD_REQUEST` (400), `CONFLICT` (409), `INTERNAL_SERVER_ERROR` (500).
- **DO** show user-friendly error messages via `onError` in mutations: `toast.error(err.message)`.
- **DON'T** wrap entire procedures in try/catch. Only catch specific expected errors (like P2002).
- **DON'T** return `{ error: "..." }` objects. Throw `TRPCError` instead.
- **DON'T** silently swallow errors with `.catch(() => {})`.

#### Performance

- **DO** set `staleTime: 30_000` (30s) as default in QueryClient.
- **DO** use `select` in Prisma queries — only fetch needed fields.
- **DO** prefetch data with `utils.*.prefetch()` on hover for navigation links where useful.
- **DON'T** refetch on window focus (disabled by default in our config).
- **DON'T** create N+1 query patterns — use `include` or separate batch queries.

### NAMING CONVENTIONS

| What | Convention | Example |
|------|-----------|---------|
| Router file | `{domain}.ts` | `college.ts` |
| Schema file | `{domain}.ts` | `college.ts` |
| Procedure name | camelCase verb | `list`, `getById`, `create`, `update`, `delete`, `bulkCreate` |
| Schema name | `{action}{Entity}Schema` | `createCollegeSchema`, `updateTestSchema` |
| Shared schema | `{entity}Schema` | `optionSchema`, `testCaseSchema` |
| Context hook | `use{Domain}()` | `useAuth()`, `useTest()` |
| tRPC call | `trpc.{domain}.{procedure}` | `trpc.college.list.useQuery()` |

---

## 12. Task Breakdown

### Phase 1: Infrastructure Setup
> Foundation layer. Everything else depends on this. No behavior changes to the app yet.

- [ ] **1.1** Install dependencies (`@trpc/server`, `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query`)
- [ ] **1.2** Remove `swr` from `package.json`
- [ ] **1.3** Create `src/server/context.ts` — session resolution from Better Auth
- [ ] **1.4** Create `src/server/trpc.ts` — tRPC init, middleware (isAuthenticated, requireRole), base procedures (publicProcedure, protectedProcedure, adminProcedure, collegeAdminProcedure, studentProcedure)
- [ ] **1.5** Create `src/app/api/trpc/[trpc]/route.ts` — tRPC HTTP handler
- [ ] **1.6** Create `src/lib/trpc.ts` — client-side `createTRPCReact<AppRouter>()`
- [ ] **1.7** Create `src/lib/trpc-server.ts` — server caller factory for RSC
- [ ] **1.8** Create `src/providers/auth-provider.tsx` — AuthContext, useAuth(), useRequireAuth()
- [ ] **1.9** Create `src/providers/trpc-provider.tsx` — QueryClientProvider + tRPC httpBatchLink
- [ ] **1.10** Create `src/providers/index.tsx` — combined `<Providers>` wrapper
- [ ] **1.11** Update `src/app/layout.tsx` — fetch session server-side, wrap children in `<Providers>`
- [ ] **1.12** Create `src/server/routers/_app.ts` — empty appRouter (will be populated in Phase 3)
- [ ] **1.13** Create `src/server/routers/index.ts` — barrel export
- [ ] **1.14** Verify: `npm run build` passes with empty appRouter

### Phase 2: Schemas
> Extract and deduplicate all Zod schemas. Routers depend on these.

- [ ] **2.1** Create `src/server/schemas/common.ts` — idSchema, paginationSchema, searchSchema
- [ ] **2.2** Create `src/server/schemas/college.ts` — createCollegeSchema, updateCollegeSchema, usnStructureSchema
- [ ] **2.3** Create `src/server/schemas/department.ts` — createDepartmentSchema
- [ ] **2.4** Create `src/server/schemas/drive.ts` — createDriveSchema, updateDriveSchema, driveFilterSchema
- [ ] **2.5** Create `src/server/schemas/test.ts` — createTestSchema, updateTestSchema, startTestSchema, submitTestSchema
- [ ] **2.6** Create `src/server/schemas/question.ts` — optionSchema, testCaseSchema, mcqQuestionSchema, codingQuestionSchema, questionSchema (discriminatedUnion)
- [ ] **2.7** Create `src/server/schemas/student.ts` — createStudentSchema, updateStudentSchema, studentFilterSchema, bulkStudentSchema
- [ ] **2.8** Create `src/server/schemas/attempt.ts` — saveAnswerSchema, runCodeSchema, reportViolationSchema
- [ ] **2.9** Create `src/server/schemas/library.ts` — libraryQuestionSchema, importToTestSchema, categorySchema
- [ ] **2.10** Create `src/server/schemas/report.ts` — downloadReportSchema, emailReportSchema
- [ ] **2.11** Create `src/server/schemas/index.ts` — barrel export all schemas
- [ ] **2.12** Verify: all schemas compile with `npx tsc --noEmit`

### Phase 3: Routers
> Build all 12 domain routers. Migrate business logic from API routes. Each subtask = one router file.

- [ ] **3.1** Create `src/server/routers/college.ts` — 5 procedures (list, getById, create, update, getUsnStructure). Migrate logic from `src/app/api/colleges/route.ts`, `src/app/api/colleges/[collegeId]/route.ts`, `src/app/api/colleges/[collegeId]/stats/route.ts`, `src/app/api/colleges/usn-structure/route.ts`
- [ ] **3.2** Create `src/server/routers/department.ts` — 3 procedures. Migrate from `src/app/api/departments/route.ts`, `src/app/api/departments/[departmentId]/route.ts`
- [ ] **3.3** Create `src/server/routers/drive.ts` — 4 procedures. Migrate from `src/app/api/drives/route.ts`, `src/app/api/drives/[driveId]/route.ts`
- [ ] **3.4** Create `src/server/routers/test.ts` — 7 procedures. Migrate from `src/app/api/tests/route.ts`, `src/app/api/tests/[testId]/route.ts`, `src/app/api/tests/[testId]/start/route.ts`, `src/app/api/tests/[testId]/submit/route.ts`, `src/app/api/tests/[testId]/monitor/route.ts`
- [ ] **3.5** Create `src/server/routers/question.ts` — 5 procedures + `recalculateTestTotalMarks` helper. Migrate from `src/app/api/tests/[testId]/questions/route.ts`, `src/app/api/tests/[testId]/questions/[questionId]/route.ts`, `src/app/api/tests/[testId]/questions/bulk/route.ts`
- [ ] **3.6** Create `src/server/routers/student.ts` — 8 procedures. Migrate from `src/app/api/students/route.ts`, `src/app/api/students/[studentId]/route.ts`, `src/app/api/students/bulk/route.ts`, `src/app/api/students/profile/route.ts`, `src/app/api/students/resolve/route.ts`, `src/app/api/students/validate/route.ts`
- [ ] **3.7** Create `src/server/routers/attempt.ts` — 6 procedures. Migrate from `src/app/api/attempts/route.ts`, `src/app/api/attempts/[attemptId]/route.ts`, `src/app/api/attempts/[attemptId]/answers/route.ts`, `src/app/api/attempts/[attemptId]/run/route.ts`, `src/app/api/attempts/[attemptId]/violations/route.ts`, `src/app/api/attempts/[attemptId]/session-check/route.ts`
- [ ] **3.8** Create `src/server/routers/library.ts` — 13 procedures (9 questions + 4 categories). Migrate from `src/app/api/library/questions/route.ts`, `src/app/api/library/questions/[questionId]/route.ts`, `src/app/api/library/questions/bulk/route.ts`, `src/app/api/library/questions/bulk-delete/route.ts`, `src/app/api/library/questions/import/route.ts`, `src/app/api/library/questions/from-test/route.ts`, `src/app/api/library/categories/route.ts`, `src/app/api/library/categories/[categoryId]/route.ts`
- [ ] **3.9** Create `src/server/routers/report.ts` — 2 procedures. Migrate from `src/app/api/reports/download/route.ts`, `src/app/api/reports/email/route.ts`
- [ ] **3.10** Create `src/server/routers/stats.ts` — 1 procedure. Migrate from `src/app/api/stats/route.ts`
- [ ] **3.11** Create `src/server/routers/user.ts` — 1 procedure. Migrate from `src/app/api/users/[userId]/route.ts`
- [ ] **3.12** Create `src/server/routers/notification.ts` — 1 procedure. Migrate from `src/app/api/notifications/route.ts`. Update `src/app/api/cron/test-notifications/route.ts` to call tRPC procedure internally.
- [ ] **3.13** Create `src/server/routers/auth.ts` — 3 procedures (registerCollegeAdmin, registerStudent, listDepartments). Migrate from `src/app/api/auth/register-college-admin/route.ts`, `src/app/api/auth/register-student/route.ts`, `src/app/api/auth/departments/route.ts`
- [ ] **3.14** Register all 13 routers in `src/server/routers/_app.ts`
- [ ] **3.15** Update `src/server/routers/index.ts` barrel export
- [ ] **3.16** Verify: `npm run build` passes with all routers registered

### Phase 4: Shared Components
> Build before migrating pages so pages can use them immediately.

- [ ] **4.1** Create `src/components/shared/pagination.tsx` — generic pagination controls
- [ ] **4.2** Create `src/components/shared/stats-card.tsx` — dashboard stat card
- [ ] **4.3** Create `src/components/shared/data-table.tsx` — generic table wrapper
- [ ] **4.4** Create `src/components/shared/category-manager.tsx` — category CRUD using tRPC
- [ ] **4.5** Create `src/components/shared/question-form.tsx` — unified question create/edit form using tRPC + react-hook-form + schemas
- [ ] **4.6** Create `src/components/shared/library-list.tsx` — unified library page using tRPC + shared components
- [ ] **4.7** Create `src/components/shared/index.ts` — barrel export

### Phase 5: Auth Provider Migration
> Replace all prop drilling of session/user/role with useAuth().

- [ ] **5.1** Update `src/components/dashboard/sidebar.tsx` — replace user prop with `useAuth()`
- [ ] **5.2** Update `src/components/dashboard/topbar.tsx` — replace user prop with `useAuth()`
- [ ] **5.3** Update `src/components/dashboard/mobile-nav.tsx` — replace user prop with `useAuth()`
- [ ] **5.4** Update `src/components/dashboard/notification-bell.tsx` — replace fetch + useEffect with tRPC
- [ ] **5.5** Update `src/app/(dashboard)/admin/layout.tsx` — remove session prop passing, use `useAuth()` for role check
- [ ] **5.6** Update `src/app/(dashboard)/college/layout.tsx` — same
- [ ] **5.7** Update `src/app/(dashboard)/student/layout.tsx` — same
- [ ] **5.8** Verify: all layouts render correctly without prop drilling

### Phase 6: Page Migration — Admin Dashboard
> Convert all admin pages to use tRPC. Replace useEffect/fetch with useQuery/useMutation.

- [ ] **6.1** Migrate `src/app/(dashboard)/admin/page.tsx` — use tRPC caller + StatsCard
- [ ] **6.2** Migrate `src/app/(dashboard)/admin/colleges/page.tsx` — tRPC `college.list.useQuery()`
- [ ] **6.3** Migrate `src/app/(dashboard)/admin/colleges/[collegeId]/page.tsx` — tRPC `college.getById`
- [ ] **6.4** Migrate `src/app/(dashboard)/admin/colleges/[collegeId]/college-stats.tsx` — tRPC query replaces useEffect
- [ ] **6.5** Migrate `src/app/(dashboard)/admin/colleges/new/page.tsx` — tRPC `college.create.useMutation()`
- [ ] **6.6** Migrate `src/app/(dashboard)/admin/colleges/delete-college-button.tsx` — tRPC mutation
- [ ] **6.7** Migrate `src/app/(dashboard)/admin/users/page.tsx` — tRPC `user.list` or inline query
- [ ] **6.8** Migrate `src/app/(dashboard)/admin/users/users-table.tsx` — use DataTable + Pagination
- [ ] **6.9** Migrate `src/app/(dashboard)/admin/users/delete-user-button.tsx` — tRPC mutation
- [ ] **6.10** Replace `src/app/(dashboard)/admin/library/page.tsx` → thin wrapper `<LibraryList scope="global" />`
- [ ] **6.11** Replace `src/app/(dashboard)/admin/library/new/page.tsx` → thin wrapper `<QuestionForm target="library" mode="create" />`
- [ ] **6.12** Replace `src/app/(dashboard)/admin/library/[questionId]/page.tsx` → thin wrapper `<QuestionForm target="library" mode="edit" />`
- [ ] **6.13** Migrate `src/app/(dashboard)/admin/library/upload/page.tsx` — tRPC `library.bulkCreateQuestions`
- [ ] **6.14** Migrate `src/app/(dashboard)/admin/settings/page.tsx`
- [ ] **6.15** Verify: all admin pages work correctly

### Phase 7: Page Migration — College Dashboard
> Convert all college pages to use tRPC.

- [ ] **7.1** Migrate `src/app/(dashboard)/college/page.tsx` — tRPC caller + StatsCard
- [ ] **7.2** Migrate `src/app/(dashboard)/college/departments/page.tsx` — tRPC `department.list` + `department.create`
- [ ] **7.3** Migrate `src/app/(dashboard)/college/drives/page.tsx` — tRPC `drive.list`
- [ ] **7.4** Migrate `src/app/(dashboard)/college/drives/new/page.tsx` — tRPC `drive.create.useMutation()`
- [ ] **7.5** Migrate `src/app/(dashboard)/college/drives/[driveId]/page.tsx` — tRPC `drive.getById` + `test.list`
- [ ] **7.6** Migrate `src/app/(dashboard)/college/drives/[driveId]/tests/new/page.tsx` — tRPC `test.create`
- [ ] **7.7** Migrate `src/app/(dashboard)/college/drives/[driveId]/tests/[testId]/page.tsx` — tRPC `test.getById`
- [ ] **7.8** Migrate `src/app/(dashboard)/college/drives/[driveId]/tests/[testId]/questions/new/page.tsx` → `<QuestionForm target="test" mode="create" />`
- [ ] **7.9** Migrate `src/app/(dashboard)/college/drives/[driveId]/tests/[testId]/questions/[questionId]/edit/page.tsx` → `<QuestionForm target="test" mode="edit" />`
- [ ] **7.10** Migrate `src/app/(dashboard)/college/drives/[driveId]/tests/[testId]/questions/upload/page.tsx` — tRPC `question.bulkCreate`
- [ ] **7.11** Migrate `src/app/(dashboard)/college/drives/[driveId]/tests/[testId]/questions/import-library/page.tsx` — tRPC `library.importToTest`
- [ ] **7.12** Migrate `src/app/(dashboard)/college/drives/[driveId]/tests/[testId]/monitor/page.tsx` — tRPC `test.monitor` with `refetchInterval`
- [ ] **7.13** Migrate `src/app/(dashboard)/college/drives/[driveId]/tests/[testId]/results/page.tsx` — tRPC query + DataTable + Pagination
- [ ] **7.14** Migrate `src/app/(dashboard)/college/drives/[driveId]/tests/[testId]/results/[attemptId]/page.tsx` — tRPC `attempt.getById`
- [ ] **7.15** Migrate `src/app/(dashboard)/college/drives/[driveId]/tests/[testId]/results/retake-button.tsx` — tRPC mutation
- [ ] **7.16** Migrate `src/app/(dashboard)/college/students/page.tsx` — tRPC `student.list` + DataTable
- [ ] **7.17** Migrate `src/app/(dashboard)/college/students/[studentId]/page.tsx` — tRPC `student.getById`
- [ ] **7.18** Migrate `src/app/(dashboard)/college/students/upload/page.tsx` — tRPC `student.bulkCreate`
- [ ] **7.19** Replace `src/app/(dashboard)/college/library/page.tsx` → thin wrapper `<LibraryList scope="college" />`
- [ ] **7.20** Replace `src/app/(dashboard)/college/library/new/page.tsx` → thin wrapper `<QuestionForm target="library" mode="create" />`
- [ ] **7.21** Replace `src/app/(dashboard)/college/library/[questionId]/page.tsx` → thin wrapper `<QuestionForm target="library" mode="edit" />`
- [ ] **7.22** Migrate `src/app/(dashboard)/college/library/upload/page.tsx` — tRPC `library.bulkCreateQuestions`
- [ ] **7.23** Migrate `src/app/(dashboard)/college/reports/page.tsx` — tRPC query
- [ ] **7.24** Migrate `src/app/(dashboard)/college/reports/report-table.tsx` — DataTable + Pagination
- [ ] **7.25** Migrate `src/app/(dashboard)/college/reports/download-button.tsx` — tRPC `report.download` (base64 → blob download)
- [ ] **7.26** Migrate `src/app/(dashboard)/college/reports/email-button.tsx` — tRPC `report.sendEmail`
- [ ] **7.27** Migrate `src/app/(dashboard)/college/settings/page.tsx` + `profile-section.tsx`
- [ ] **7.28** Verify: all college pages work correctly

### Phase 8: Page Migration — Student Dashboard
> Convert all student pages to use tRPC.

- [ ] **8.1** Migrate `src/app/(dashboard)/student/page.tsx` — tRPC caller + StatsCard
- [ ] **8.2** Migrate `src/app/(dashboard)/student/drives/page.tsx` — tRPC `drive.list`
- [ ] **8.3** Migrate `src/app/(dashboard)/student/tests/page.tsx` — tRPC query
- [ ] **8.4** Migrate `src/app/(dashboard)/student/results/page.tsx` — tRPC `attempt.list`
- [ ] **8.5** Migrate `src/app/(dashboard)/student/results/[attemptId]/page.tsx` — tRPC `attempt.getById`
- [ ] **8.6** Migrate `src/app/(dashboard)/student/settings/page.tsx` — tRPC `student.getProfile` + `student.update`
- [ ] **8.7** Verify: all student pages work correctly

### Phase 9: Auth Pages Migration
> Convert login/register pages to use tRPC where applicable.

- [ ] **9.1** Migrate `src/app/(auth)/register/page.tsx` — tRPC mutation for college admin registration (replaces fetch to `/api/auth/register-college-admin`)
- [ ] **9.2** Migrate `src/app/(auth)/register/student/page.tsx` — tRPC mutation for student registration (replaces fetch + useEffect for departments)
- [ ] **9.3** Login page: Better Auth `signIn` stays (not tRPC) — but remove any useEffect if present
- [ ] **9.4** Verify: auth flows work end-to-end

### Phase 10: Test Interface Decomposition
> Break apart test-interface.tsx god component.

- [ ] **10.1** Create `src/components/test/hooks/use-test-timer.ts`
- [ ] **10.2** Create `src/components/test/hooks/use-test-answers.ts` — with debounced tRPC mutation
- [ ] **10.3** Create `src/components/test/hooks/use-test-violations.ts` — wraps useProctoring + tRPC
- [ ] **10.4** Create `src/components/test/hooks/use-test-navigation.ts`
- [ ] **10.5** Create `src/components/test/hooks/index.ts` — barrel export
- [ ] **10.6** Create `src/components/test/test-provider.tsx` — TestContext combining all hooks
- [ ] **10.7** Create `src/components/test/question-renderer.tsx` — MCQ + coding display
- [ ] **10.8** Create `src/components/test/question-navigator.tsx` — sidebar question list
- [ ] **10.9** Create `src/components/test/test-timer.tsx` — countdown display
- [ ] **10.10** Create `src/components/test/violation-manager.tsx` — event listener registration
- [ ] **10.11** Rewrite `src/components/test/test-interface.tsx` — thin shell composing sub-components
- [ ] **10.12** Update `src/app/test/[testId]/page.tsx` — use tRPC caller for initial data + TestProvider
- [ ] **10.13** Verify: test-taking flow works end-to-end (start, answer, code run, submit, violations, timer)

### Phase 11: Cleanup
> Delete old code, verify everything builds and works.

- [ ] **11.1** Delete all old API route directories (colleges, departments, drives, tests, students, attempts, library, reports, stats, users, notifications, auth/register-college-admin, auth/register-student, auth/departments)
- [ ] **11.2** Remove `swr` import from any remaining file (should be none after migration)
- [ ] **11.3** Remove unused imports across all migrated files
- [ ] **11.4** Remove old `auth-guard.ts` functions if fully replaced (keep if cron route still uses it)
- [ ] **11.5** Run `npm run lint` — fix all lint errors
- [ ] **11.6** Run `npm run build` — fix all build errors
- [ ] **11.7** Update `CLAUDE.md` — document new architecture, tRPC patterns, file structure
- [ ] **11.8** Verify full app walkthrough: login → each dashboard → CRUD operations → test taking → logout

---

## Task Dependency Graph

```
Phase 1 (Infrastructure)
  └── Phase 2 (Schemas)
        └── Phase 3 (Routers)
              ├── Phase 4 (Shared Components) ← depends on routers being callable
              │     ├── Phase 6 (Admin Pages)
              │     ├── Phase 7 (College Pages)
              │     └── Phase 8 (Student Pages)
              ├── Phase 5 (Auth Provider) ← can run parallel with Phase 4
              │     ├── Phase 6 (Admin Pages)
              │     ├── Phase 7 (College Pages)
              │     └── Phase 8 (Student Pages)
              ├── Phase 9 (Auth Pages) ← depends on routers only
              └── Phase 10 (Test Interface) ← depends on attempt router
  Phase 11 (Cleanup) ← depends on ALL above
```

**Parallelizable:**
- Phase 4 + Phase 5 can run in parallel
- Phase 6 + Phase 7 + Phase 8 + Phase 9 can run in parallel (after 4 + 5)
- Phase 10 can run in parallel with Phase 6-9

**Critical path:** 1 → 2 → 3 → (4+5) → (6+7+8+9+10) → 11
