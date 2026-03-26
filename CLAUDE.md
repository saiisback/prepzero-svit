# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Active Migration Plan

**IMPORTANT:** This project is undergoing a full tRPC migration. Before making any changes, read:
- `docs/plans/2026-03-26-trpc-migration-design.md` — Full design document with architecture, guidelines, and task breakdown
- Follow Section 11 (Guidelines — Do's and Don'ts) strictly for all new code
- Execute tasks in phase order as described in Section 12 (Task Breakdown)

## Project Overview

PrepZero is a placement testing and proctoring platform built with Next.js 16 (App Router). It supports three user roles (SUPER_ADMIN, COLLEGE_ADMIN, STUDENT) managing colleges, placement drives, tests, and proctored test attempts with code execution via Judge0.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm start            # Start production server
npm run lint         # ESLint
npm run db:push      # Sync Prisma schema to database
npm run db:generate  # Regenerate Prisma client (after schema changes)
npm run db:seed      # Seed database with test data (tsx prisma/seed.ts)
npm run db:create-admin  # Create super admin: tsx prisma/create-admin.ts <name> <email> <password>
```

No test framework is configured. Utility scripts in `scripts/` run via `tsx scripts/<name>.ts`:
- `add-student.ts` — Add a single student to a college
- `fetch-data.ts` — Dump all users, colleges, drives, and tests from the database
- `register-college-admin.ts` — Register a college admin via API
- `generate-test-csv.ts` — Generate a CSV of random students from DB
- `test-eligibility.ts` — Run eligibility logic tests against live DB
- `reset-and-seed-students.ts` — Reset and re-seed student data
- `seed-students.ts` — Seed student records into a college

Judge0 (code execution engine for coding questions):
```bash
docker compose up -d   # Start Judge0 services (server, workers, postgres, redis)
```
Judge0 config is in `judge0.conf` (referenced by `docker-compose.yml`).

## Architecture

### Tech Stack
- **Next.js 16** with App Router, React 19, TypeScript 5
- **Prisma 7** with PostgreSQL (Neon cloud DB) via `PrismaPg` driver adapter (not the default Prisma engine)
- **Better Auth** for session-based authentication with email/password
- **shadcn/ui** (new-york style) + Tailwind CSS 4 + Radix UI
- **Judge0** (Docker) for sandboxed code execution (Python, Java, C, C++)
- **Monaco Editor** for in-browser coding questions

### Route Structure
- `src/app/(auth)/` — Public auth pages (login, register, register/student)
- `src/app/(dashboard)/admin/` — Super admin dashboard (colleges, users, settings, question library)
- `src/app/(dashboard)/college/` — College admin dashboard (drives, tests, students, departments, library)
- `src/app/(dashboard)/student/` — Student dashboard (drives, tests, results, settings)
- `src/app/test/[testId]/` — Test-taking interface (separate from dashboard, uses proctoring)
- `src/app/api/` — REST API routes (see API Route Patterns below)

### Key Modules
- `src/lib/auth.ts` — Better Auth config with Prisma adapter; extends User with `role` and `collegeId` fields. Students are limited to one active session (previous sessions deleted on login).
- `src/lib/auth-client.ts` — Client-side auth helpers (`signIn`, `signUp`, `signOut`, `useSession`)
- `src/lib/auth-guard.ts` — Server-side helpers: `getSession()`, `requireAuth()`, `requireRole(role)`, `getRoleRedirect(role)`
- `src/lib/judge0.ts` — Code execution: `executeCode()` for single runs (synchronous, `wait=true`), `executeBatch()` for test case validation (polls every 2s, max 15 attempts). Language IDs: PYTHON→71, JAVA→62, C→50, CPP→54
- `src/lib/prisma.ts` — Prisma client singleton using `PrismaPg` driver adapter (not the default Prisma engine)
- `src/lib/test-eligibility.ts` — `isStudentEligible()` checks test access by department, semester, and specific student lists. `buildEligibleStudentsWhere()` builds Prisma where clauses for querying eligible students. Tests use JSON fields (`allowedDepartmentIds`, `allowedSemesters`, `allowedStudentIds`) for eligibility restrictions.
- `src/lib/csv-parser.ts` — CSV parsing for bulk MCQ question import; also exports `parseEligibilityCSV()` for test eligibility CSVs (name, usn, email, department columns)
- `src/lib/student-csv-parser.ts` — CSV parsing for bulk student import with USN-based department extraction
- `src/lib/library-csv-parser.ts` — CSV parsing for question library bulk upload (adds `category` and `difficulty` columns)
- `src/lib/email.ts` — Nodemailer-based email sending via SMTP (used for test notifications and report emails)
- `src/lib/report-csv.ts` — `generateTestReportCsv()` builds CSV reports with per-student scores, violations, and summary stats
- `src/lib/test-notifications.ts` — `sendTestNotifications()` finds published tests starting within 15 minutes and emails eligible students. Called by Vercel cron every 5 minutes (`vercel.json`).
- `src/middleware.ts` — Route protection; checks `better-auth.session_token` cookie, redirects unauthenticated users to `/login`
- `src/lib/spreadsheet.ts` — Converts Excel (.xlsx/.xls) and CSV files to CSV text strings for the CSV parsers
- `src/hooks/use-proctoring.ts` — Client-side proctoring hook tracking tab switches, fullscreen exits, copy/paste. Auto-submits when `maxViolations` threshold is reached. Allows copy/paste within `.monaco-editor`.

### Database Schema
Defined in `prisma/schema.prisma`. Prisma client output goes to `src/generated/prisma`. Prisma config in `prisma.config.ts`. Import types from `@/generated/prisma/client`.

Key models: User, College, Department, PlacementDrive, Test, Question, TestAttempt, Answer, TestCase, LibraryQuestion, LibraryTestCase, Category.

Key enums: `Role` (SUPER_ADMIN, COLLEGE_ADMIN, STUDENT), `QuestionType` (SINGLE_SELECT, MULTI_SELECT, CODING), `DriveStatus` (DRAFT, UPCOMING, ACTIVE, COMPLETED, CANCELLED), `TestStatus` (DRAFT, PUBLISHED, CLOSED), `AttemptStatus` (IN_PROGRESS, SUBMITTED, TIMED_OUT), `CodingLanguage` (PYTHON, JAVA, C, CPP), `Difficulty` (EASY, MEDIUM, HARD), `ResultVisibility` (AFTER_SUBMISSION, MANUAL_RELEASE).

**JSON field patterns:** Question `options` stores `Array<{id: string, text: string}>`, `correctOptionIds` stores `string[]`. Answer `selectedOptionIds` follows the same `string[]` pattern.

**Key constraints:** TestAttempt has `@@unique([testId, studentId])` (one attempt per student per test). Answer has `@@unique([attemptId, questionId])` (one answer per question per attempt). User `usn` is unique.

**User model:** Extends auth user with `role`, `collegeId`, `usn`, `departmentId`, `semester`, `isGraduated`.

**TestAttempt proctoring fields:** `tabSwitchCount`, `fullscreenExitCount`, `copyPasteAttempts`, `totalViolations`, `maxViolations` (default 5), `autoSubmitted`.

**Library system:** `LibraryQuestion` stores reusable questions with `category` (string) and `difficulty` (enum). `LibraryTestCase` stores test cases for library coding questions. Library questions can be imported into specific tests.

**Category system:** `Category` model stores managed categories with `@@unique([name, collegeId])`. Categories are scoped: global (`collegeId: null`, managed by SUPER_ADMIN) or college-specific (managed by COLLEGE_ADMIN). College admins see both global and their own categories.

### Authentication & Authorization
- Middleware checks `better-auth.session_token` (dev) or `__Secure-better-auth.session_token` (prod) cookie on all non-public routes
- Public paths: `/`, `/login`, `/register`, `/register/student`, `/api/auth/**`
- Dashboard layouts enforce roles at the layout level via `requireRole()` — unauthorized users are redirected to `/login`
- Role-based access: API routes filter by user role and `collegeId`
- Role redirects: SUPER_ADMIN → `/admin`, COLLEGE_ADMIN → `/college`, STUDENT → `/student`

### API Route Patterns
- Next.js 16 dynamic route params are `Promise<>` — must `await params` before using:
  ```typescript
  type RouteParams = { params: Promise<{ testId: string }> };
  export async function GET(req: NextRequest, { params }: RouteParams) {
    const { testId } = await params;
  }
  ```
- API routes use role-based filtering: STUDENT sees own data, COLLEGE_ADMIN sees their college's data, SUPER_ADMIN sees all
- Request bodies are validated with Zod `schema.safeParse(body)`
- Handle Prisma unique constraint violations with error code `P2002` for race conditions (e.g., duplicate test attempts)

Key API endpoints:
- `/api/auth/**` — Better Auth + custom `/register-college-admin`, `/register-student`
- `/api/colleges` — CRUD + `/usn-structure` (reads college from auth session, no collegeId param) + `[collegeId]/stats`
- `/api/departments` — CRUD scoped to college
- `/api/drives` — CRUD for placement drives
- `/api/tests` — CRUD + `[testId]/questions` (CRUD + bulk), `[testId]/start`, `[testId]/submit`, `[testId]/monitor`
- `/api/students` — CRUD + `/bulk`, `/profile`, `/resolve`, `/validate`
- `/api/attempts` — CRUD + `[attemptId]/answers`, `[attemptId]/run` (code execution), `[attemptId]/violations`
- `/api/library/questions` — CRUD + `/bulk`, `/import` (import into test)
- `/api/library/categories` — CRUD for managed categories + `[categoryId]` (PUT rename, DELETE)
- `/api/reports/download` — Download test report as CSV
- `/api/reports/email` — Email test report to college admin
- `/api/cron/test-notifications` — Vercel cron endpoint (every 5 min) sends email reminders for tests starting within 15 minutes
- `/api/users/[userId]` — DELETE (super admin only)
- `/api/stats` — Aggregated dashboard stats

### Conventions
- Path alias: `@/*` maps to `src/*`
- Pages default to React Server Components; use `"use client"` only when needed
- Server pages query Prisma directly; client mutations go through API routes
- Forms use React Hook Form + Zod for validation
- shadcn/ui components live in `src/components/ui/`; add new ones via `npx shadcn@latest add <component>`
- `src/components/test/test-interface.tsx` is the core test-taking component (proctoring, timer, question rendering, code editor, submission)
- Toast notifications use `sonner` (`toast.success()`, `toast.error()`)
- IDs generated with `nanoid`; dates handled with `date-fns`
- Analytics charts use `recharts` (bar charts, pie charts for college/test statistics)
- Classname utility: `cn()` from `src/lib/utils.ts` (merges `clsx` + `tailwind-merge`)
- Root layout uses `ThemeProvider` (next-themes) with `defaultTheme="light"`

### Environment Variables
Required in `.env`: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `JUDGE0_API_URL` (default `http://localhost:2358` for local Docker). Optional: `JUDGE0_API_KEY` (only for RapidAPI-hosted Judge0), `DIRECT_URL` (direct DB connection for migrations). SMTP (for email notifications/reports): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `SMTP_FROM`.

### Seed Data
`npm run db:seed` creates test accounts for development:
- Super Admin: `admin@prepzero.com` / `admin123456`
- College Admin: `college@demo.com` / `college123456`
- Student: `student@demo.com` / `student123456`
- College code: `DEMO2026`

Also creates a sample placement drive, test, and questions.
