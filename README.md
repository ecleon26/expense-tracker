# Club Budget Tracker

A simple, role-based web application to track student expenses for club and committee events. Students can upload bills with their mobile cameras, and admins can review and approve them in a queue.

## Features
- **Role-based access:** Student and Admin roles with distinct views and strict RLS.
- **Mobile-friendly:** Responsive design, camera integration for bill photos, client-side JPEG image compression.
- **Admin Dashboard:** 4 KPI cards, monthly spend charts, spend by event, student, and club.
- **Secure:** Supabase Auth and Row Level Security (RLS). Storage bucket for bills is private, served only via signed URLs.
- **Audit Logging:** Every state change on an expense is recorded in an immutable audit log.
- **Undo Review:** Admins can revert approved or rejected bills to pending by providing a reason.

## Tech Stack
- Frontend: React + TypeScript + Vite, Tailwind CSS, TanStack Query, React Hook Form, Zod, Recharts, Lucide Icons.
- Backend: Supabase (Auth, Postgres DB, Storage, RLS).

## Local Setup

1. **Clone the repository**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Environment variables:**
   Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```bash
   cp .env.example .env
   ```
   ```env
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```
4. **Database setup:**
   Execute migrations in your Supabase SQL Editor in numerical order:
   - Run `supabase/migrations/001_init.sql` (baseline schema, storage bucket, triggers, RLS policies, aggregate views).
   - Run `supabase/migrations/002_hardening.sql` (hardened insert policies, unique bill_path index, trigger override for DB owner, and `v_kpis` view).
   - Run `supabase/migrations/003_v1_clubs_history.sql` (clubs, event club_id, undo reviews, immutable audit log, and RPC aggregate functions).
   - Run `supabase/migrations/004_prelaunch_fixes.sql` (strict JPEG-only storage checks and function execute permissions).
   - Run `supabase/migrations/005_student_registration_approval.sql` (student registration metadata: club, role, year, branch, roll number, and admin approval workflow).
5. **Start dev server:**
   ```bash
   npm run dev
   ```

## Creating the First Admin
By default, all new signups are granted the `student` role.
To promote your first account to an admin, sign up normally in the app, verify email, then run the following in your Supabase SQL Editor:
```sql
update public.profiles
set role = 'admin'
where email = 'your.email@example.com';
```

## Running Automated Security & RLS Tests

To run the automated security test suite against real Supabase API endpoints:

1. Copy `.env.test.example` to `.env.test`:
   ```bash
   cp .env.test.example .env.test
   ```
2. Populate `.env.test` with credentials for two student accounts and one admin account:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_anon_key
   STUDENT_A_EMAIL=student_a@example.com
   STUDENT_A_PASSWORD=password123
   STUDENT_B_EMAIL=student_b@example.com
   STUDENT_B_PASSWORD=password123
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=adminpassword123
   ```
3. Run the automated check:
   ```bash
   npm run test:rls
   ```
   This executes 29 comprehensive database and storage checks asserting strict isolation, read/write/delete constraints, upload validations, and tamper prevention.

## Deployment Notes (Free Tiers)

This app is designed to run entirely on free tiers. 

### Vercel / Netlify
- Build command: `npm run build`
- Publish directory: `dist`
- Environment Variables: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your hosting provider's project settings.

### Supabase Free Tier Limits
- **Storage:** Max 1 GB of file storage. This app limits image uploads to 5 MB each and compresses them client-side to under 500 KB before upload.
- **Inactivity Pause:** Free projects are paused after 7 days of inactivity. 
  - To prevent this, a GitHub Action is included (`.github/workflows/keep-alive.yml`).
  - Add your Supabase project URL as a GitHub Repository Secret named `SUPABASE_URL`.
  - The workflow will ping your database twice a week automatically.

## Known Limitations

- **No pagination on active events & students:** Active events and student lists are fetched as single result sets. Sufficient for clubs with modest annual expense volume; high-volume clubs should add cursor-based or limit/offset pagination. (Bills and history lists are paginated).
- **Open signup:** Anyone who visits the signup page can create a student account and upload expense claims. In production environments where membership is restricted, restrict signup in Supabase Auth settings or maintain an allowlist of approved club emails.
