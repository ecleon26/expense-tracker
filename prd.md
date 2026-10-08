## 1. Overview

A web app for a student club committee to track event expenses across multiple clubs (Digital VJTI, GDG, TEDxVJTI Mumbai). Club members upload photos of bills and enter the amount manually. An administrator reviews each bill against its image, approves or rejects it, and sees total spending, per-student spending, and how spending is distributed. Only approved bills count toward the total.

Everything runs on free tiers (Supabase Free, Vercel/Netlify Free). There is **no OCR and no AI**: amounts are entered by hand and verified by a human admin.

## 2. Goals and non-goals

### Goals

- Replace paper or chat-based bill collection with one trusted record.
- Make the admin's review fast: bill image next to the entered details.
- Give the admin a clear picture of spending by student, event, month, and club.
- Enforce roles at the database level so students can never see others' data.
- Stay within free-tier limits.

### Non-goals (v1)

- OCR or automatic bill reading
- Duplicate detection, budget limits, CSV/PDF export, email notifications
- Reimbursement or payment processing
- Editing or deleting a bill after submission (except admins who can undo reviews)
- Native mobile apps (a responsive web app is enough)

## 3. Users and roles

| Role        | Who                         | Can do                                                                                              |
| ----------- | --------------------------- | --------------------------------------------------------------------------------------------------- |
| **Student** | Club member                 | Upload a bill, view only their own uploads and statuses                                             |
| **Admin**   | Committee head or treasurer | Review all bills, approve/reject, view totals, per-student data, bill images, charts, manage events |

Rules:

- Everyone who signs up is a **student**. There is no way to choose "admin" in the UI.
- An admin is created by manually setting `role = 'admin'` on a profile in the Supabase dashboard.
- v1 supports one or more admins with identical permissions.

## 4. Features

### 4.1 Authentication (both roles)

- Sign up with full name, email, password. Email verification enabled.
- Log in and log out. Session persists across reloads.
- Forgot Password and Reset Password functionality.
- After login, route by role: students to `/student/upload`, admins to `/admin`.
- A user visiting a route for the other role is redirected to their own home.

### 4.2 Student module (exactly two capabilities)

**A. Upload a bill**
Form fields:

- Club (dropdown, required)
- Event (dropdown of active events for the selected club, required)
- Title / what it was for (required, max 120 chars)
- Amount (required, number greater than 0, 2 decimals)
- Date of expense (required, not in the future)
- Notes (optional)
- Bill photo (required; JPG, PNG, or WebP; camera capture supported on mobile)

Behaviour:

- The image is compressed in the browser before upload (target under about 500 KB, max 1600px).
- A preview of the image is shown before submit.
- On submit, the image goes to private storage and an expense row is created with status `pending`.
- If the database insert fails after the image uploaded, the image is deleted (no orphan files).
- Success message and the form resets.

**B. My expenses**

- Table of only the student's own uploads: date, club, event, title, amount, status badge, reject reason if rejected.
- Click a row to view their own bill image.
- Read-only: no edit, no delete, no totals for others, no club-wide numbers.

### 4.3 Admin module

**A. Review queue**

- List of `pending` bills, oldest first, with student name, club, event, amount, date.
- Detail view: bill image (zoom, rotate) beside the entered details.
- **Approve**: status becomes `approved`; reviewer and timestamp recorded.
- **Reject**: a reason is required; status becomes `rejected`.
- The admin cannot change the amount. If it is wrong, reject with a reason and the student re-uploads.

**B. Dashboard**

- Club filter (All clubs or specific club) affecting all data on the page.
- Four KPI cards:
  1. Total approved expenditure (sum of approved amounts)
  2. Approved bills count
  3. Pending bills count (bills in review queue)
  4. Pending amount (total awaiting approval)
- Total expenditure = sum of `amount` where `status = 'approved'`. Pending and rejected never count.
- Distribution charts (approved only):
  - Pie: spending by event
  - Pie or bar: spending by student
  - Bar: spending by month
  - Bar: spending by club (only visible when "All Clubs" is selected)

**C. All Bills & Undo Review**

- Paginated list of all bills, filterable by club, event, status, date, and searchable by text.
- Click to view full details and the bill's audit timeline.
- **Undo Review**: Admins can revert an approved or rejected bill back to `pending`. A reason must be provided.

**D. History (Audit Log)**

- Read-only paginated log of all actions on bills (uploaded, approved, rejected, review_reverted).
- Identifies the actor (student or admin) and the reason for the action.

**E. Students and per-student view**

- Table of students: name, email, number of approved bills, approved total.
- Click a student to see all their bills (any status) with images and statuses, plus their approved total.

**F. Events management**

- Create an event (name, club, optional date).
- Deactivate an event (it stops appearing in the student dropdown; old bills keep it).
- Events cannot be deleted if bills reference them.

## 5. Data model

Full SQL, including security policies, is in `supabase/migrations/` (001, 002, 003).

**clubs**: `id`, `name` (unique), `created_at`

**profiles**: `id` (= auth user id), `full_name`, `email`, `role` (`student` | `admin`), `created_at`

**events**: `id`, `name`, `club_id`, `event_date`, `is_active`, `created_at`. Unique on `(club_id, name)`.

**expenses**: `id`, `user_id`, `club_id`, `event_id`, `title`, `description`, `amount` (numeric 12,2, > 0), `expense_date`, `bill_path`, `status` (`pending` | `approved` | `rejected`), `reject_reason`, `revert_reason`, `reviewed_by`, `reviewed_at`, `created_at`

**expense_audit_log**: Append-only table written entirely by DB triggers for historical tracking of actions.

**Storage**: private bucket `bills`, path `{user_id}/{uuid}.jpg`, 5 MB limit, JPEG only. Unique index on `expenses(bill_path)` prevents reusing the same image across multiple bills.

## 6. Security requirements

1. Roles are enforced by Row Level Security, not by hiding buttons.
2. Students can `SELECT` and `INSERT` only their own expenses. A student insert is permitted only when `status = 'pending'`, review metadata fields (`reviewed_by`, `reviewed_at`, `reject_reason`) are null, `bill_path` strictly matches `^<user_id>/[0-9a-f-]{36}\.jpg$`, and the associated event exists, is `is_active = true`, and the club ID matches the event's club ID.
3. Only admins can update review fields. A trigger blocks changing amount, event, date, title, owner, or image path after submission.
4. An admin can review a bill (pending -> approved/rejected) or undo a review (approved/rejected -> pending with a reason). Other transitions are blocked.
5. Nobody can `DELETE` expenses (audit trail).
6. Users cannot change their own role. There is no client-side update policy on `profiles`.
7. The `bills` bucket is private. Images are shown only through short-lived signed URLs (about 5 minutes).
8. Storage policies: a student can write only into their own folder and read only their own files; admins can read all.
9. The Supabase `service_role` key must never appear in frontend code. Only the anon key is used.

## 7. Tech stack

| Layer                | Choice                                  |
| -------------------- | --------------------------------------- |
| Frontend             | React + Vite + Tailwind CSS             |
| Routing              | React Router                            |
| Data fetching        | TanStack Query                          |
| Forms and validation | react-hook-form + zod                   |
| Backend              | Supabase (Auth, Postgres, Storage, RLS) |
| Image prep           | browser-image-compression               |
| Charts               | Recharts                                |
| Icons                | lucide-react                            |
| Hosting              | Vercel or Netlify                       |

No custom server and no Edge Functions are needed in v1.

## 8. Pages and routes

| Route                 | Role    | Page                         |
| --------------------- | ------- | ---------------------------- |
| `/login`, `/signup`   | public  | Auth                         |
| `/forgot-password`    | public  | Reset request                |
| `/reset-password`     | public  | Set new password             |
| `/student/upload`     | student | Upload bill                  |
| `/student/expenses`   | student | My expenses                  |
| `/admin`              | admin   | Dashboard                    |
| `/admin/review`       | admin   | Review queue                 |
| `/admin/bills`        | admin   | All bills (paginated list)   |
| `/admin/history`      | admin   | Audit log                    |
| `/admin/students`     | admin   | Students table               |
| `/admin/students/:id` | admin   | One student's bills          |
| `/admin/events`       | admin   | Manage events                |

## 9. Free-tier constraints and mitigations

| Constraint                       | Mitigation                                                     |
| -------------------------------- | -------------------------------------------------------------- |
| Supabase file storage about 1 GB | Compress images client-side to about 300-500 KB                |
| 500 MB database                  | Not a concern for this data size                               |
| Project pauses after 7 days idle | Scheduled ping (GitHub Actions or UptimeRobot) or weekly login |
| Limits can change                | Re-check supabase.com/pricing before launch                    |
