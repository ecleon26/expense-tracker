# 1. Verdict

Ready with fixes. The app is close: production build passes, lint passes, RLS/storage tests mostly pass, and the main role/RLS model is present in the migrations. The top 5 risks before launch are: (1) the `bills` bucket and storage insert policy still allow PNG/WebP/non-`.jpg` objects even though the data model requires JPEG-only `{userId}/{uuid}.jpg`; (2) All Bills search concatenates raw user input into a PostgREST `.or(...)` filter, so commas/parentheses/percent/underscore can break or alter search semantics; (3) `/reset-password` treats any existing signed-in session as a valid recovery session; (4) date handling uses UTC assumptions that can reject "today" for IST users and make History date filters non-IST-inclusive; (5) `npm run test:rls` currently exits failing because the admin review-queue embed check did not see a non-empty student name or club name for the pending test row.

# 2. Test results table

| ID | Area | Check | Result | How verified | Evidence |
|---|---|---|---|---|---|
| T01 | Source of truth | Read `prd.md` completely | PASS | READ | `prd.md` states no OCR/AI, routes, RLS, storage, audit, undo, and V1 requirements. |
| T02 | Source of truth | Read `CLAUDE.md` completely | PASS | READ | `CLAUDE.md` lines 59-61 require private signed URLs and `{userId}/{uuid}.jpg`; lines 105-106 require no localStorage and no old views after 003. |
| T03 | Migrations | Read `001_init.sql`, `002_hardening.sql`, `003_v1_clubs_history.sql` | PASS | READ | `001_init.sql`, `002_hardening.sql`, and `003_v1_clubs_history.sql` were inspected fully. |
| T04 | Build | `npm run build` | PASS | RAN | Output: `tsc -b && vite build`; `2505 modules transformed`; `✓ built in 12.37s`. Warning: one JS chunk is `1,087.03 kB` after minification. |
| T05 | Lint | `npm run lint` | PASS | RAN | Output ended successfully after `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`. |
| T06 | Install | `npm install` | NOT VERIFIED | RAN | Blocked by tool policy because it may contact npm registry and modify dependencies. Existing `node_modules/` was present. |
| T07 | npm audit | `npm audit --omit=dev` | NOT VERIFIED | RAN | Blocked by tool policy because it may contact npm registry and is not a project script. No vulnerability result is claimed. |
| T08 | RLS script | `npm run test:rls` | FAIL | RAN | Script ran and exited `1`: `SUMMARY: 36/37 checks PASSED (1 FAILED)`. Failing check: Check 25, admin review queue embed missing `student.full_name` or `clubs.name`. User emails in output are intentionally redacted from this report. |
| T09 | Git status | Existing worktree state before report | PASS | RAN | Many source files and `003_v1_clubs_history.sql` were modified/untracked before this report. I did not modify app code. |
| T10 | Env ignores | `.gitignore` ignores `.env` and `.env.test`, keeps examples | PASS | READ | `.gitignore` contains `.env`, `.env.test`, `.env.local`, `.env.*.local`, `!.env.example`, `!.env.test.example`. |
| T11 | Env files in history | committed `.env` / `.env.test` | PASS | RAN | Metadata-only history check listed only `.env.example` and `.env.test.example`; full patches were not printed to avoid exposing secrets. |
| T12 | Secret terms | `service_role` in current repo | PARTIAL | READ | No service-role key found in app code. `service_role` appears in docs/requirements only. A metadata-only `git log -Sservice_role` found commit `197e8...`, affecting docs and source, but patch contents were not printed. |
| T13 | OCR/AI libraries | Search current repo | PASS | READ | No OCR/AI libraries in `package.json`; text references are requirements saying no OCR/AI. |
| T14 | localStorage/sessionStorage | Search current repo | PASS | READ | No app use found. Only docs mention "Never use localStorage". Supabase Auth may manage its own storage. |
| T15 | Signed URLs | Private signed URL usage | PASS | READ | `src/hooks/useSignedUrl.ts:11-16` calls `.createSignedUrl(path, SIGNED_URL_EXPIRY)`; `src/lib/config.ts:16-17` sets `300` seconds. No `getPublicUrl` use found. |
| T16 | Signed URL loading | Images requested lazily | PASS | READ | Lists render `bill_path` text data only; `ImageViewer` is mounted when a row/modal is opened, e.g. `src/admin/AllBillsPage.tsx:360-365`. |
| T17 | Storage JPEG-only | Bucket and storage policy enforce JPEG-only | FAIL | READ | `supabase/migrations/001_init.sql:202-205` allows JPEG, PNG, WebP; `001_init.sql:210-215` only checks bucket and owner folder, not `.jpg` name or MIME. |
| T18 | Expenses insert path | Expense row enforces owner `.jpg` path and active matching event | PASS | READ/RAN | `003_v1_clubs_history.sql:84-100` checks `user_id`, pending status, path regex, active event, and matching `event.club_id`. RLS script checks 4-8 and 7b passed. |
| T19 | Expense update guard | Immutable fields and valid transitions | PASS | READ/RAN | `003_v1_clubs_history.sql:115-157` blocks immutable fields and invalid transitions. RLS checks 14-17b passed. |
| T20 | Undo reason | Undo requires non-empty reason and clears review fields | PASS | READ/RAN | `003_v1_clubs_history.sql:144-153`; RLS checks 15b and 15c passed. |
| T21 | Audit trigger safety | Trigger functions are `SECURITY DEFINER` with `search_path = public` | PASS | READ | `003_v1_clubs_history.sql:195-199` and `231-235`. |
| T22 | Audit append-only client access | Client cannot write audit rows | PASS | READ/RAN | Only select policy exists at `003_v1_clubs_history.sql:189-191`; RLS check 28 passed. |
| T23 | Aggregate functions | Security invoker and approved-only logic | PASS | READ/RAN | `003_v1_clubs_history.sql:351-480` uses `security invoker`; RLS checks 13, 26, 27 passed. |
| T24 | Function EXECUTE grants | PUBLIC default revoked | FAIL | READ | `003_v1_clubs_history.sql:482-487` grants execute to `authenticated`, but there is no `revoke execute ... from public`; PostgreSQL grants function EXECUTE to PUBLIC by default. |
| T25 | Old views | Frontend no longer queries old `v_*` views | PASS | READ | Searches found `v_kpis`, `v_spend_by_*` only in docs/migrations, and `003_v1_clubs_history.sql:343-347` drops them. |
| T26 | Routes | Public/student/admin route split | PASS | READ | `src/App.tsx` public routes include login/signup/forgot/reset; student/admin routes are wrapped in `ProtectedRoute`. |
| T27 | Role redirect | Wrong role redirected to role home | PASS | READ | `src/auth/ProtectedRoute.tsx:33-38` redirects by `profile.role`; unauthenticated users go to `/login` at lines 28-30. |
| T28 | Profile fetch failure | Behavior if profile load fails | PARTIAL | READ | `src/auth/AuthProvider.tsx:27-31` logs in dev and sets `profile` null; `ProtectedRoute` sends logged-in user to `/login`. No user-facing recovery path. |
| T29 | Forgot password neutrality | Same message whether email exists | PASS | READ | `src/auth/AuthPages.tsx:293-304` ignores raw reset errors and always shows neutral message. |
| T30 | Reset password valid recovery only | Only recovery sessions can reset | FAIL | READ | `src/auth/AuthPages.tsx:366-380` treats any `SIGNED_IN` event or existing session as recovery-valid. |
| T31 | Change password | Logged-in change password | PASS | READ | `src/auth/AuthPages.tsx:487-557` uses `supabase.auth.updateUser` from the app layout modal. |
| T32 | Raw auth/database errors | Friendly error mapping | PARTIAL | READ | Many handlers call `friendlyError`; dev logging is gated in `AuthProvider.tsx:28` and `errorMessages.ts:51`. Some hook errors throw raw `error.message`, which QueryState displays. |
| T33 | XSS rendering | User text rendered via React text nodes | PASS | READ | Titles, reasons, names, clubs/events are rendered as JSX text, not `dangerouslySetInnerHTML`; no `dangerouslySetInnerHTML` found. |
| T34 | All Bills search filter | Input safely encoded in `.or(...)` | FAIL | READ | `src/hooks/useAdminBills.ts:78-81` directly interpolates `term` into `title.ilike.%${term}%,description.ilike.%${term}%`. |
| T35 | Upload validation | Club/event/title/amount/date/image validation | PARTIAL | READ | `src/utils/validators.ts:41-49` validates required fields, amount, date, file type/size. Date validation has IST/UTC edge issue. |
| T36 | Upload flow | Compress, upload, insert, cleanup, reset, invalidate | PASS | READ | `src/student/StudentPages.tsx:90-123` compresses/upload/inserts and cleans up on insert error; `126-143` revokes preview, resets, invalidates. |
| T37 | My Expenses | Own rows only, bill image via signed URL | PASS | READ/RAN | Hook reads `expenses` without user filter, relying on RLS (`src/hooks/useExpenses.ts:22-36`); RLS script check 2 passed. |
| T38 | Review Queue | Pending only, oldest first, club filter, image, approve/reject | PASS | READ | `src/hooks/useAdminReview.ts:24-36`; UI lines `274-312`, `401-459`. |
| T39 | Concurrent admin handling | Zero-row update surfaced in review queue | PASS | READ | `src/admin/AdminPages.tsx:277-283` and `298-305` check empty returned data and show already-reviewed message. |
| T40 | All Bills | Pagination 20, filters, detail, audit timeline, undo | PARTIAL | READ | `src/hooks/useAdminBills.ts:37-94` paginates; `AllBillsPage.tsx:97-127` checks undo zero-row. Search bug remains. |
| T41 | History | Read-only, newest first, paginated, filters | PARTIAL | READ | `src/hooks/useAdminHistory.ts:31-70`; UTC date filtering issue remains at lines 53-58. |
| T42 | Dashboard | Club filter, 4 KPIs, charts, approved-only RPCs | PASS | READ | `src/admin/AdminPages.tsx:637-797` and RPC hooks in `src/hooks/useAdminAnalytics.ts:5-100`. |
| T43 | Students | Per-student totals and detail | PASS | READ | `src/hooks/useAdminAnalytics.ts:117-195`; UI `src/admin/AdminPages.tsx:804-1026`. |
| T44 | Events | Create with club, list club, deactivate/reactivate | PASS | READ | `src/hooks/useAdminEvents.ts:41-75`; unique per club is DB constraint at `003_v1_clubs_history.sql:52-60`. |
| T45 | Money | Single helper, INR, en-IN | PASS | READ | `src/utils/formatCurrency.ts:7-15`; `src/lib/config.ts:4-5`. |
| T46 | Accessibility | Modals and icon buttons | PARTIAL | READ | Modal has `role="dialog"` and escape close (`src/components/Modal.tsx:28-57`); no focus trap/initial focus restoration observed. |
| T47 | Mobile/layout | 375px visual check | NOT VERIFIED | INFERRED | I did not run a browser or capture screenshots. Tables use `overflow-x-auto`, but actual 375px behavior is not verified. |

# 3. Confirmed bugs, sorted by severity

## High

### BUG-001: Storage accepts non-JPEG bill objects and does not enforce the `{userId}/{uuid}.jpg` path at upload time

File and line: `supabase/migrations/001_init.sql:202-215`; `src/lib/config.ts:7-10`

What is wrong: The PRD data model says Storage is private bucket `bills`, path `{user_id}/{uuid}.jpg`, 5 MB limit, JPEG only. The app compresses to JPEG, but the bucket still allows `image/png` and `image/webp`, and the storage insert policy only checks the first folder equals `auth.uid()`. A direct Supabase client can upload PNG/WebP objects, and can upload a PNG/WebP object named `...jpg` because path and MIME are not tied together at storage policy level.

Exact reproduction steps:

1. Sign in as any student with the anon client.
2. Upload to `bills/<student-id>/<uuid>.jpg` with `contentType: 'image/png'`.
3. Observe storage accepts the object if it is under 5 MB, because the bucket allows PNG and the policy checks only folder ownership.

Suggested fix as a migration snippet:

```sql
-- supabase/migrations/004_storage_jpeg_only.sql
begin;

update storage.buckets
set allowed_mime_types = array['image/jpeg']
where id = 'bills';

drop policy if exists "bills_insert_own_folder" on storage.objects;

create policy "bills_insert_own_jpeg_path" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bills'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$')
    and lower(coalesce(metadata->>'mimetype', '')) = 'image/jpeg'
  );

commit;
```

Note: verify the exact metadata key Supabase exposes for MIME in storage policies in your project before applying. If `metadata->>'mimetype'` is not populated, keep the bucket MIME restriction and enforce the path regex in the policy.

## Medium

### BUG-002: All Bills search concatenates raw input into a PostgREST `.or()` filter

File and line: `src/hooks/useAdminBills.ts:78-81`

What is wrong: The search term is interpolated into `query.or("title.ilike.%${term}%,description.ilike.%${term}%")`. Inputs containing PostgREST filter grammar characters such as `,`, `(`, `)`, `%`, and `_` can break the query or alter wildcard behavior. The prompt specifically asked to test `a,b`, `(x)`, `100%`, `_`, quotes, and long text; the current implementation has no escaping or length limit.

Exact reproduction steps:

1. Log in as admin.
2. Open `/admin/bills`.
3. Search for `a,b` or `(x)`.
4. Expected: literal text search or no results. Actual risk: malformed PostgREST filter or unintended OR grammar/wildcard semantics.

Suggested fix as a code snippet:

```ts
function escapeLikeTerm(value: string) {
  return value
    .trim()
    .slice(0, 120)
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/[(),]/g, ' ')
}

// Better long-term: replace the .or string with a parameterized SQL RPC.
if (filters.search && filters.search.trim()) {
  const term = escapeLikeTerm(filters.search)
  if (term) {
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`)
  }
}
```

Best fix: create a `search_admin_bills(...)` RPC that accepts search text as a SQL parameter and uses `ILIKE '%' || p_search || '%'` server-side.

### BUG-003: `/reset-password` accepts any existing logged-in session as a recovery session

File and line: `src/auth/AuthPages.tsx:363-381`

What is wrong: `ResetPasswordPage` sets `isRecoverySession` true for `SIGNED_IN` and for any existing `session`. That means a normal signed-in user can browse directly to `/reset-password` and get the reset-password form, even without a recovery link. The app has a separate logged-in change-password modal, so this page should require Supabase's password recovery event/session.

Exact reproduction steps:

1. Log in normally as a student or admin.
2. Navigate to `/reset-password`.
3. Expected: invalid/expired recovery link message unless the session came from a recovery link.
4. Actual by code: `getSession()` sees a session and sets `isRecoverySession(true)`.

Suggested fix as a code snippet:

```ts
useEffect(() => {
  let sawRecovery = false
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      sawRecovery = true
      setIsRecoverySession(true)
    }
  })

  const timer = window.setTimeout(() => {
    if (!sawRecovery) setIsRecoverySession(false)
  }, 1000)

  return () => {
    window.clearTimeout(timer)
    subscription.unsubscribe()
  }
}, [])
```

### BUG-004: Date validation and History date filters use UTC boundaries, not IST user dates

File and line: `src/utils/validators.ts:17-20`; `src/hooks/useAdminHistory.ts:53-58`

What is wrong: `new Date('YYYY-MM-DD')` is parsed as UTC midnight. In India, early-morning users can have their local "today" parsed as a future UTC instant. History filters use `T00:00:00Z` through `T23:59:59Z`, which is a UTC day, not an IST day.

Exact reproduction steps:

1. In IST before 05:30, open upload form.
2. Select today's local date.
3. Expected: accepted. Actual by code: it can compare as future because `YYYY-MM-DD` becomes UTC midnight.
4. For History, filter one local date with records near midnight IST; records from 00:00-05:29 IST can be excluded or included on the wrong date boundary.

Suggested fix as a code snippet:

```ts
function localDateString(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const expenseDateSchema = z
  .string()
  .min(1, 'Date is required')
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v <= localDateString(), 'Date cannot be in the future')
```

For audit timestamps, convert selected local dates to ISO using local `new Date(year, monthIndex, day, 0,0,0)` and end-of-day local time rather than appending `Z`.

## Low

### BUG-005: New SQL functions are still executable by PUBLIC unless explicitly revoked

File and line: `supabase/migrations/003_v1_clubs_history.sql:482-487`

What is wrong: PostgreSQL grants `EXECUTE` on functions to `PUBLIC` by default. Migration 003 grants the aggregate RPCs to `authenticated`, but it never revokes `PUBLIC`. Because these functions are `security invoker`, RLS still prevents table data leakage for anon callers, but the execute surface is broader than intended and the audit brief explicitly called out default PUBLIC execute grants.

Exact reproduction steps:

1. On a migrated database, inspect `information_schema.routine_privileges` or call RPCs with an anon client and no session.
2. Expected: anon cannot execute app RPCs.
3. Actual risk by migration: functions likely retain PUBLIC execute unless revoked elsewhere.

Suggested fix as a migration snippet:

```sql
begin;

revoke execute on function public.kpi_summary(uuid) from public;
revoke execute on function public.spend_by_student(uuid) from public;
revoke execute on function public.spend_by_event(uuid) from public;
revoke execute on function public.spend_by_month(uuid) from public;
revoke execute on function public.spend_by_club() from public;

grant execute on function public.kpi_summary(uuid) to authenticated;
grant execute on function public.spend_by_student(uuid) to authenticated;
grant execute on function public.spend_by_event(uuid) to authenticated;
grant execute on function public.spend_by_month(uuid) to authenticated;
grant execute on function public.spend_by_club() to authenticated;

commit;
```

### BUG-006: `npm run test:rls` fails one check in the configured dev project

File and line: `scripts/rls-check.mjs:235-255`

What is wrong: The test script exits non-zero because Check 25 requires a truthy `student.full_name` and `clubs.name` on the pending row. In the run I performed, all other RLS/storage checks passed, but this check failed. This may be a real embed issue or a brittle assertion against test users with blank `full_name`; either way, the prelaunch test command currently fails.

Exact reproduction steps:

1. Run `npm run test:rls`.
2. Observe `SUMMARY: 36/37 checks PASSED (1 FAILED)` and Check 25 failure.

Suggested fix as a test snippet:

```js
const reviewQueueHasStudent =
  !!reviewQueueRow?.student &&
  typeof reviewQueueRow.student.email === 'string'
const reviewQueueHasClub =
  !!reviewQueueRow?.clubs &&
  typeof reviewQueueRow.clubs.name === 'string' &&
  reviewQueueRow.clubs.name.length > 0

assert(
  25,
  'Admin review queue embed with explicit FK hint: includes student email + clubs.name',
  !reviewQueueErr && !!expense1Id && reviewQueueHasStudent && reviewQueueHasClub,
  reviewQueueErr?.message ||
    (expense1Id ? 'missing student embed/email or clubs.name on pending row' : 'no expense from check 1'),
)
```

If `clubs.name` is actually null, fix the database relationship or query. If only `student.full_name` is blank, fix test-user setup or assert email instead.

### BUG-007: Migration 003 is not rerunnable because it creates policies without dropping them first

File and line: `supabase/migrations/003_v1_clubs_history.sql:29-31`; `189-191`

What is wrong: Migration 003 says it is safe to run once, and it mostly uses idempotent DDL, but `create policy "clubs_select_authenticated"` and `create policy "audit_select_admin"` are not guarded by `drop policy if exists`. Running 003 a second time will fail with duplicate policy errors before reaching the rest of the script.

Exact reproduction steps:

1. Apply migrations 001, 002, 003.
2. Run 003 again.
3. Expected if idempotent: no changes or safe replacement. Actual by code: duplicate policy error at the first existing policy.

Suggested fix as a migration snippet:

```sql
drop policy if exists "clubs_select_authenticated" on public.clubs;
create policy "clubs_select_authenticated" on public.clubs
  for select to authenticated
  using (true);

drop policy if exists "audit_select_admin" on public.expense_audit_log;
create policy "audit_select_admin" on public.expense_audit_log
  for select to authenticated
  using (public.is_admin());
```

# 4. Possible concerns (not confirmed)

- Profile fetch failure UX: `AuthProvider` sets `profile` null on profile fetch errors, and `ProtectedRoute` redirects to `/login`. Confirm by simulating a transient Supabase failure while already signed in.
- Modal accessibility: `Modal` has dialog semantics and Escape close, but I did not see a focus trap or focus restoration. Confirm with keyboard-only testing and a screen reader.
- Student access to inactive events via direct API: `events_select_all` allows authenticated users to select all events. The UI filters active events, and expense insert blocks inactive events. Confirm whether inactive event names are considered sensitive.
- `spend_by_event` and `spend_by_club` under student RLS: security-invoker RLS means students should only see aggregates from their own visible expenses, but `events`/`clubs` rows are visible. Confirm exact RPC output as Student A with approved expenses.
- Huge audit log performance: indexes exist for created, club, expense, student, but not combined `(club_id, created_at desc)` or `(action, created_at desc)`. Confirm with `EXPLAIN` after realistic row growth.
- Phone EXIF rotation: browser compression may strip or normalize metadata depending on library behavior. Confirm by uploading a rotated phone image.
- PDF/GIF renamed `.jpg`: app validates browser MIME and bucket MIME rejects GIF/text in RLS script, but JPEG file-content sniffing is not verified.
- Browser Back after logout and expired session mid-action were not manually tested.
- Mobile 375px screenshots were not captured, so layout quality is not visually verified.

# 5. PRD acceptance criteria table

| ID | Acceptance criterion | Result | How verified | Evidence |
|---|---|---|---|---|
| A1 | Signup, login, logout, role redirect, session persistence | PARTIAL | READ | Auth pages and provider implement flows; email confirmation and session persistence require live manual verification. |
| A2 | Forgot password neutral message | PASS | READ | `AuthPages.tsx:293-304`. |
| A3 | Reset password only with valid recovery link | FAIL | READ | `AuthPages.tsx:366-380` accepts any existing session. |
| A4 | Change password only when logged in | PASS | READ | Change modal is rendered inside authenticated layout; `AuthPages.tsx:487-557`. |
| A5 | Branding in navbar/login/signup/title/meta | PASS | READ | Login/signup show Budget Tracker and By Digital VJTI; `index.html` contains title/meta. |
| A6 | Student upload requires club and filters active events by club | PASS | READ | `StudentPages.tsx:66-83`, `useEvents.ts:16-24`. |
| A7 | Changing club clears event | PASS | READ | `StudentPages.tsx:76-83`. |
| A8 | No active events message | PASS | READ | `StudentPages.tsx:216-232`. |
| A9 | Upload zod validations | PARTIAL | READ | `validators.ts:41-49`; date validation has IST bug. |
| A10 | Compress to JPEG and path `{userId}/{uuid}.jpg` | PASS | READ | `StudentPages.tsx:90-100`. |
| A11 | Insert pending with `club_id` and cleanup uploaded file on insert failure | PASS | READ | `StudentPages.tsx:107-123`. |
| A12 | Preview URL revoked, form reset, invalidation | PASS | READ | `StudentPages.tsx:126-143`. |
| A13 | My Expenses own rows, club column, status/reject reason, own image | PASS | READ/RAN | `useExpenses.ts`; RLS script check 2 passed. |
| A14 | Review Queue pending only, oldest first, club filter, image, approve/reject with reason | PASS | READ | `useAdminReview.ts:24-36`; `AdminPages.tsx:274-312`. |
| A15 | Review Queue concurrent admin handling | PASS | READ | `AdminPages.tsx:277-283`, `298-305`. |
| A16 | All Bills pagination 20 and filters | PARTIAL | READ | Pagination/filter code present; search filter unsafe. |
| A17 | All Bills detail includes required fields and audit timeline | PASS | READ | `AllBillsPage.tsx:353-500`. |
| A18 | Undo requires reason, returns pending, handles changed by someone else | PASS | READ/RAN | `AllBillsPage.tsx:97-127`; RLS checks 15b/15c passed. |
| A19 | History read-only, newest first, paginated, filters, System actor fallback | PARTIAL | READ | Implemented; UTC date boundary bug remains. |
| A20 | Dashboard club filter, 4 KPIs, event/student/month/club charts | PASS | READ | `AdminPages.tsx:637-797`. |
| A21 | Totals approved only | PASS | READ | RPCs filter `status = 'approved'` in `003_v1_clubs_history.sql`. |
| A22 | Students pages respect club filter and show club/status | PASS | READ | `useStudentDetail`, `AdminPages.tsx:887-1026`. |
| A23 | Events create requires club, unique per club, deactivate/reactivate, list club | PASS | READ | Hook and DB constraint verified. |
| A24 | Students never see inactive events | PARTIAL | READ | UI filters active events; direct authenticated event SELECT can read inactive rows. |
| A25 | Admin nav order Dashboard, Review Queue, All Bills, History, Students, Events | PASS | READ | `AppLayout` nav order inspected. |
| A26 | Money helper uses INR/en-IN | PASS | READ | `formatCurrency.ts` and `config.ts`. |
| A27 | No OCR/AI | PASS | READ | No OCR/AI deps; docs explicitly prohibit. |
| A28 | Private signed URLs only, short expiry | PASS | READ | `useSignedUrl.ts`; no public URL usage found. |
| A29 | Storage JPEG-only | FAIL | READ | Bucket allows PNG/WebP. |
| A30 | Permanent audit log written only by triggers | PASS | READ/RAN | No client write policy; RLS check 28 passed. |

# 6. Additional automated tests (JavaScript snippets for `scripts/rls-check.mjs`)

```js
// Extra Check A: storage must reject PNG/WebP even if path ends in .jpg.
const uuidA = crypto.randomUUID()
const pngAsJpgPath = `${userA.id}/${uuidA}.jpg`
const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47])
const { error: pngAsJpgErr } = await clientA.storage
  .from('bills')
  .upload(pngAsJpgPath, fakePng, { contentType: 'image/png' })
assert('A', 'Student cannot upload image/png bill object even with .jpg path', !!pngAsJpgErr, pngAsJpgErr?.message)
```

```js
// Extra Check B: anon should not execute aggregate RPCs.
const anonClient = makeClient()
const { error: anonKpiErr } = await anonClient.rpc('kpi_summary', { p_club_id: null })
assert('B', 'Anon cannot execute kpi_summary RPC', !!anonKpiErr, anonKpiErr?.message)
```

```js
// Extra Check C: audit log cannot be updated or deleted by admin client.
const { data: auditOne } = await clientAdmin
  .from('expense_audit_log')
  .select('id, reason')
  .eq('expense_id', expense1Id)
  .limit(1)
  .single()

if (auditOne?.id) {
  await clientAdmin
    .from('expense_audit_log')
    .update({ reason: 'tampered by test' })
    .eq('id', auditOne.id)
  const { data: auditAfterUpdate } = await clientAdmin
    .from('expense_audit_log')
    .select('reason')
    .eq('id', auditOne.id)
    .single()
  assert('C1', 'Admin cannot UPDATE audit rows', auditAfterUpdate?.reason === auditOne.reason)

  await clientAdmin.from('expense_audit_log').delete().eq('id', auditOne.id)
  const { data: auditAfterDelete } = await clientAdmin
    .from('expense_audit_log')
    .select('id')
    .eq('id', auditOne.id)
    .single()
  assert('C2', 'Admin cannot DELETE audit rows', auditAfterDelete?.id === auditOne.id)
}
```

```js
// Extra Check D: review queue embed should not require non-empty full_name.
const reviewQueueHasStudent =
  !!reviewQueueRow?.student &&
  typeof reviewQueueRow.student.email === 'string'
const reviewQueueHasClub =
  !!reviewQueueRow?.clubs &&
  typeof reviewQueueRow.clubs.name === 'string' &&
  reviewQueueRow.clubs.name.length > 0
assert('D', 'Review queue embeds student email and club name', reviewQueueHasStudent && reviewQueueHasClub)
```

```js
// Extra Check E: admin cannot review a pending bill while changing immutable fields.
const uuidE = crypto.randomUUID()
const pathE = `${userA.id}/${uuidE}.jpg`
await clientA.storage.from('bills').upload(pathE, VALID_JPEG, { contentType: 'image/jpeg' })
const { data: expE } = await clientA.from('expenses').insert({
  user_id: userA.id,
  club_id: testClubId,
  event_id: activeEvent.id,
  title: 'RLS-TEST E: Immutable review attempt',
  amount: 75,
  expense_date: '2026-10-01',
  bill_path: pathE,
  status: 'pending',
}).select().single()
const { error: immutableReviewErr } = await clientAdmin
  .from('expenses')
  .update({ status: 'approved', amount: 76 })
  .eq('id', expE.id)
const { data: expEAfter } = await clientAdmin
  .from('expenses')
  .select('status, amount')
  .eq('id', expE.id)
  .single()
assert('E', 'Admin cannot approve while changing amount', !!immutableReviewErr && expEAfter.status === 'pending' && Number(expEAfter.amount) === 75)
```

```js
// Extra Check F: whitespace-only undo reason is blocked and row remains reviewed.
const { error: whitespaceUndoErr } = await clientAdmin
  .from('expenses')
  .update({ status: 'pending', revert_reason: '   ' })
  .eq('id', exp16.id)
  .eq('status', 'rejected')
const { data: exp16AfterWhitespace } = await clientAdmin
  .from('expenses')
  .select('status')
  .eq('id', exp16.id)
  .single()
assert('F', 'Whitespace-only undo reason is blocked', !!whitespaceUndoErr && exp16AfterWhitespace.status === 'rejected')
```

# 7. A manual test script for a human

Use two students and one admin. Use all three clubs: Digital VJTI, GDG, TEDxVJTI Mumbai.

1. Student A signs up with full name, email, password. Expected: cannot choose admin role; sees email confirmation or can log in after confirming.
2. Student B signs up. Expected: same as Student A.
3. Admin signs in. Expected: lands on `/admin`.
4. Admin opens Events. Create one active event for each club. Expected: each event appears with the correct club.
5. Admin creates another event with the same name in a different club. Expected: allowed.
6. Admin tries same event name in the same club. Expected: rejected by unique constraint with friendly error.
7. Admin deactivates one event. Expected: event remains listed as inactive.
8. Student A logs in and opens Upload. Select Digital VJTI. Expected: only active Digital VJTI events appear.
9. Student A changes club to GDG. Expected: event dropdown is cleared and now shows active GDG events.
10. Student A selects a club with no active events if available. Expected: clear "no active events" message.
11. Student A tries title blank, amount `0`, amount `10.123`, future date, PDF/GIF, file over 5 MB. Expected: each is blocked before upload.
12. Student A uploads a valid JPG/PNG/WebP under 5 MB. Expected: preview appears, submit succeeds, form resets, My Expenses shows pending with club/event/title/amount.
13. Student B opens My Expenses. Expected: Student A bill is not visible.
14. Student B attempts direct URL/image access to Student A bill if known. Expected: denied.
15. Admin opens Review Queue. Expected: Student A bill appears pending, oldest first, with club badge and image.
16. Admin rejects without reason. Expected: blocked.
17. Admin rejects with reason. Expected: bill becomes rejected; Dashboard pending count decreases; History records rejected.
18. Student A opens My Expenses. Expected: rejected badge and reject reason visible.
19. Admin opens All Bills, filters by club, event, rejected status, date range. Expected: rejected bill appears and filters combine correctly.
20. Admin opens bill detail. Expected: image, student, club, event, title, description, amount, expense date, uploaded-at, status, reviewer, reviewed-at, reject reason, and audit timeline are visible.
21. Admin clicks Undo rejection with blank reason. Expected: blocked.
22. Admin enters undo reason. Expected: bill returns to pending; Review Queue shows it again; History records review reverted.
23. Admin approves the same bill. Expected: approved status, reviewer metadata, approved totals update.
24. Admin tries to reject the approved bill without undo using a second browser/admin session or stale page. Expected: blocked or "changed by someone else".
25. Student A views the bill after undo/approve cycle. Expected: status updates; no edit/delete controls.
26. Admin Dashboard selects All Clubs. Expected: four KPIs, event/student/month charts, and Spend by Club visible.
27. Admin Dashboard selects each club. Expected: KPIs and charts filter to that club; Spend by Club disappears.
28. Admin Students page filters by each club. Expected: approved totals respect selected club.
29. Admin opens Student A detail. Expected: all Student A bills with club/status; bill images open by signed URL.
30. Admin History filters by club/action/date. Expected: newest first, 25 per page, no edit/delete controls, System when actor is null.
31. Test mobile width around 375px on Upload, Review Queue, All Bills, History, Dashboard. Expected: no overlapping text; tables scroll within containers.
32. Test keyboard only: tab through forms, open/close modals, Escape closes modals. Expected: focus order is usable.
33. Log out, press Back. Expected: protected data is not shown; user returns to login or protected route redirects.
34. Let session expire or sign out in another tab, then submit an action. Expected: friendly error and no raw database/auth details.

# 8. What I could NOT verify and why

- I did not run `npm install`; it was blocked because it may contact npm and run lifecycle scripts. Existing `node_modules/` was present.
- I did not run `npm audit --omit=dev`; it was blocked because it may contact npm registry and is not a project script.
- I did not print historical `.env` patches because that could expose secrets. I used metadata-only history checks.
- I did not run migrations on a fresh Supabase project from scratch. Migration conclusions are from SQL reading and the existing dev project RLS test.
- I did not inspect live database policy catalogs, function privileges, or `EXPLAIN` plans.
- I did not capture browser screenshots or run Playwright/mobile visual checks.
- I did not manually test reset email delivery, email confirmation, expired recovery links, browser Back after logout, slow network upload, EXIF rotation, or screen-reader behavior.

# 9. Prioritized fix list

Before launch:

1. Add `004_storage_jpeg_only.sql` to restrict the `bills` bucket to JPEG and enforce `{userId}/{uuid}.jpg` in the storage insert policy.
2. Add `004_revoke_public_execute.sql` or combine with the storage migration to revoke PUBLIC execute on app RPC functions and re-grant only to `authenticated`.
3. Replace All Bills raw `.or(...)` search with a safe RPC or robust escaping/length limit.
4. Fix `/reset-password` so only Supabase password recovery sessions can use it.
5. Fix local-date validation and History date filters for IST/local dates.
6. Fix `scripts/rls-check.mjs` Check 25 or seed test users with full names, then rerun until `npm run test:rls` passes.
7. Run a fresh database migration test and inspect final policies/function grants.
8. Run mobile and keyboard accessibility manual checks.

After launch:

1. Add combined indexes for audit history filters if row count grows: `(club_id, created_at desc)`, `(action, created_at desc)`, and possibly `(club_id, action, created_at desc)`.
2. Add code splitting to reduce the 1.08 MB minified JS chunk warning.
3. Improve profile-fetch failure UX with a retry or "profile unavailable" screen.
4. Add focus trap and focus restoration to `Modal`.
5. Add automated UI tests for search special characters, reset-password routing, and pagination edge cases.

# 10. Ready-to-paste fix prompt for the coding agent that built the app

You are working on Budget Tracker. Do not edit earlier migrations. Do the work in stages, report honestly, and do not claim tests passed unless you ran them. Run `npm run build`, `npm run lint`, and `npm run test:rls` after the changes if credentials are available.

Stage 1: database migration, create a new migration file named like `supabase/migrations/004_security_fixes.sql`.

- Fix BUG-001: make the `bills` bucket JPEG-only and replace the storage insert policy so authenticated users can upload only to their own `{userId}/{uuid}.jpg` path. Preserve the existing private bucket, 5 MB limit, admin/student read behavior, and unreferenced cleanup behavior.
- Fix BUG-005: explicitly `revoke execute ... from public` for `kpi_summary(uuid)`, `spend_by_student(uuid)`, `spend_by_event(uuid)`, `spend_by_month(uuid)`, and `spend_by_club()`, then grant execute to `authenticated`.
- Fix BUG-007 only if you need rerunnable migration behavior: do not edit 003; in 004, avoid duplicate policy creation and document that 003 itself is one-time.

Stage 2: frontend fixes.

- Fix BUG-002 in All Bills search. Prefer a parameterized SQL RPC for admin bill search. If you keep PostgREST `.or(...)`, add escaping/length limiting for commas, parentheses, `%`, `_`, backslashes, and quotes, and add tests/manual proof for `a,b`, `(x)`, `100%`, `_`, single quote, double quote, and very long text.
- Fix BUG-003 so `/reset-password` only shows the reset form after Supabase emits a `PASSWORD_RECOVERY` event. A normal signed-in session must not be enough.
- Fix BUG-004 by comparing upload dates as local `YYYY-MM-DD` strings and by constructing History date filters from local start/end-of-day times instead of hard-coded `Z` UTC boundaries.

Stage 3: tests.

- Fix BUG-006 in `scripts/rls-check.mjs`: Check 25 should not fail solely because a test profile has blank `full_name`; assert the embed exists and includes a usable email and club name, or seed full names reliably.
- Add tests for JPEG-only storage, anon RPC execution blocked, audit log update/delete blocked, immutable-field review attempts, and whitespace-only undo reason. Use Supabase client reads after attempted updates/deletes; do not treat "no error" as proof.

After each stage, run the relevant checks. At the end, run:

```bash
npm run build
npm run lint
npm run test:rls
```

Report exact command results. If `npm audit --omit=dev` is allowed in your environment, run it and assess whether each production finding affects this client-only Supabase app.
