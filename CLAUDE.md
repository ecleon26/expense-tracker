# CLAUDE.md: Club Budget Tracker

Read this file at the start of every session. Full requirements are in `PRD.md`. The database schema and security policies are in `supabase/migrations/001_init.sql` and are the source of truth.

## What this project is

A web app where student club members upload bill photos and enter the amount manually, and an admin approves or rejects them and views spending analytics. **There is no OCR and no AI in this project. Do not add any.**

## Stack (do not swap without asking)

- React + Vite + Tailwind CSS (JavaScript or TypeScript: use TypeScript)
- React Router, TanStack Query, react-hook-form, zod
- Supabase: Auth, Postgres, Storage, Row Level Security
- browser-image-compression, Recharts, lucide-react
- Hosting: Vercel or Netlify. Everything must stay on free tiers.
- No custom backend server. No Edge Functions in v1.

## Commands

```bash
npm install
npm run dev       # local dev server
npm run build     # must pass before any phase is considered done
npm run lint
```

## Environment variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Provide `.env.example` with these names and empty values. Never commit `.env`. **Never use or mention the Supabase `service_role` key in frontend code.**

## Folder structure

```
src/
  lib/            supabaseClient.ts, config.ts (currency, limits), queryClient.ts, queryKeys.ts
  auth/           AuthProvider, useAuth, ProtectedRoute, Login, Signup, ForgotPassword, ResetPassword, ChangePasswordModal
  student/        UploadBill, MyExpenses
  admin/          AdminPages.tsx (Dashboard, ReviewQueue, Students, StudentDetail, Events),
                  AllBillsPage.tsx, HistoryPage.tsx
  components/     shared UI (Button, Input, Select, Badge, Modal, Spinner, EmptyState, ImageViewer, QueryState, Toast)
  hooks/          useExpenses, useEvents, useClubs, useAdminEvents, useAdminAnalytics,
                  useAdminReview, useAdminBills, useAdminHistory, useSignedUrl
  utils/          compressImage.ts, formatCurrency.ts, validators.ts, errorMessages.ts
supabase/
  migrations/     001_init.sql, 002_hardening.sql, 003_v1_clubs_history.sql
```

## Hard rules (security)

1. Authorization lives in the database (RLS). Frontend role checks are for UX only. Never rely on hiding a button.
2. Never add a way to sign up as admin. Admin is set manually in the database.
3. Never add UPDATE or INSERT access to `profiles` from the client.
4. Never add DELETE for expenses.
5. Bill images are in a private bucket. Display them only via `createSignedUrl(path, 300)`. Never use public URLs. Store the **path** in `bill_path`, not a URL.
6. Upload path format: `${userId}/${crypto.randomUUID()}.jpg`.
7. Do not log tokens, passwords, or signed URLs.

## Business rules

- Only `approved` expenses count toward any total, chart, or per-student figure. Pending and rejected never count.
- New expenses are always created with `status = 'pending'`.
- After submission a student cannot edit or delete anything.
- The admin cannot edit the amount. To fix a wrong amount: reject with a reason, and the student re-uploads.
- Rejecting requires a non-empty reason.
- Events: admins create and deactivate them. Students see only active events in the upload dropdown. Do not delete events that have bills.

## Upload flow (student)

1. Validate form with zod: event required, title 1-120 chars, amount > 0 (max 2 decimals), date not in the future, image required.
2. Validate file: JPG/PNG/WebP only, max 5 MB before compression.
3. Compress with browser-image-compression: `maxSizeMB: 0.5`, `maxWidthOrHeight: 1600`, `initialQuality: 0.7`, `useWebWorker: true`.
4. Upload to Storage `bills` bucket.
5. Insert the expense row. If the insert fails, delete the uploaded file and show an error.
6. Show success, reset the form, invalidate the "my expenses" query.

## Money handling

- Amounts are `numeric(12,2)` in the database. Treat them as numbers with 2 decimals.
- Format all money through one `formatCurrency()` helper using `Intl.NumberFormat` and the currency in `config.ts` (default INR, locale `en-IN`).
- Do not sum floating point values carelessly on the client. Prefer the SQL views for totals; if summing in JS, round to 2 decimals at the end.

## UI and UX standards

- Mobile-first; students upload from phones. Use `<input type="file" accept="image/*" capture="environment">` plus a gallery option.
- Every data view needs loading, empty, and error states.
- Status badges: pending (amber), approved (green), rejected (red).
- Admin review screen: image on one side, details on the other (stacked on mobile). Image zoom and rotate.
- Confirm dialogs for approve/reject; reject opens a reason field.
- Accessible: labelled inputs, focus states, keyboard-usable controls, readable contrast.
- Keep the design clean and consistent: one accent colour, generous spacing, no clutter.

## Code conventions

- TypeScript strict mode. No `any` unless commented why.
- Small components, one responsibility each. Data fetching in hooks, not inside JSX.
- Use TanStack Query for all Supabase reads/writes. **Always use `src/lib/queryKeys.ts`** for all query keys and cache invalidations to prevent drift.
- **Always map errors through `src/utils/errorMessages.ts`** to show friendly user messages; raw details are logged to the console only in development (`import.meta.env.DEV`).
- **expenses has TWO foreign keys to profiles**: `expenses_user_id_fkey` (student) and `expenses_reviewed_by_fkey` (reviewer). Every PostgREST embed MUST use explicit hints: `student:profiles!expenses_user_id_fkey(...)` and `reviewer:profiles!expenses_reviewed_by_fkey(...)`. Never write a bare `profiles(...)` embed.
- **In RLS policies on expenses**, the events table also has a `club_id` column — qualify outer references as `public.expenses.club_id` to avoid self-comparison in subqueries.
- **Never use localStorage** for anything except what Supabase Auth manages itself. Do not remember club selection.
- Database migrations: `001_init.sql` (baseline), `002_hardening.sql` (trigger guard, regex policy, unique index, v_kpis), `003_v1_clubs_history.sql` (clubs, club_id, undo-review, audit log, SQL aggregate functions).
- Every data view uses `QueryState` (loading / error with retry / empty / not-found).
- Aggregate queries call the SQL functions (`kpi_summary`, `spend_by_student`, `spend_by_event`, `spend_by_month`, `spend_by_club`) via `supabase.rpc(...)` — not old views.
- Run automated security tests with `npm run test:rls`.
- No unused dependencies. Do not add libraries that are not in the stack without asking.
- Commit messages: short, imperative (`Add student upload form`).

## Do not

- Add OCR, AI, or any paid service.
- Use `localStorage` for anything except what Supabase Auth manages itself.
- Put secrets in the repo.
- Skip RLS testing.
- Build features outside `PRD.md` without asking.

## Definition of done for every phase

1. `npm run build` and `npm run lint` pass.
2. The phase's behaviour works in the browser.
3. Security rules above are still respected.
4. Summarize what changed, how to test it, and anything the human must do manually (for example, running SQL or setting an env variable). Then stop and wait for approval before the next phase.

## Final test checklist (before deploy)

- Two student accounts and one admin account exist.
- Student A cannot see Student B's expenses or images (try direct Supabase queries and storage URLs).
- A student cannot update their own role, status, or amount.
- Admin sees all pending bills, can approve and reject, reject requires a reason.
- Dashboard total equals the sum of approved amounts only.
- Files over 5 MB or wrong types are rejected.
- Visiting `/admin` as a student redirects away; visiting `/student/*` as admin redirects away.
- Production build runs with only the two env variables set.
