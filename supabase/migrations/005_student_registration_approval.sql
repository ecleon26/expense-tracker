-- ============================================================================
-- 005_student_registration_approval.sql
-- Adds:
--  1. Member approval workflow: club, club_role, year, branch, roll_number,
--     approval_status on public.profiles
--  2. Anon select policy on public.clubs (for signup dropdown)
--  3. Updated handle_new_user() trigger function to capture registration metadata
--  4. Admin update policy and atomic RPC functions: approve_student, reject_student
--  5. Hardened expenses and storage RLS: only approved students/admins can insert
-- ============================================================================

BEGIN;

-- 1. Add student registration and approval columns to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS club_role text,
  ADD COLUMN IF NOT EXISTS year text,
  ADD COLUMN IF NOT EXISTS branch text,
  ADD COLUMN IF NOT EXISTS roll_number text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Ensure all current users & admins are set to 'approved'
UPDATE public.profiles
SET approval_status = 'approved'
WHERE approval_status IS NULL OR role = 'admin';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS profiles_approval_status_idx ON public.profiles (approval_status);
CREATE INDEX IF NOT EXISTS profiles_club_id_idx ON public.profiles (club_id);
CREATE INDEX IF NOT EXISTS profiles_roll_number_idx ON public.profiles (roll_number);

-- 2. Allow anonymous users to view club names during registration
DROP POLICY IF EXISTS "clubs_select_anon" ON public.clubs;
CREATE POLICY "clubs_select_anon" ON public.clubs
  FOR SELECT TO anon
  USING (true);

-- 3. Update handle_new_user() to extract registration metadata and default student to 'pending'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
BEGIN
  -- Safely parse club_id if provided in raw_user_meta_data
  BEGIN
    IF (new.raw_user_meta_data ->> 'club_id') IS NOT NULL AND (new.raw_user_meta_data ->> 'club_id') <> '' THEN
      v_club_id := (new.raw_user_meta_data ->> 'club_id')::uuid;
    ELSE
      v_club_id := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_club_id := NULL;
  END;

  -- Default to Digital VJTI club if not explicitly passed
  IF v_club_id IS NULL THEN
    SELECT id INTO v_club_id FROM public.clubs WHERE name ILIKE '%Digital VJTI%' LIMIT 1;
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    approval_status,
    club_id,
    club_role,
    year,
    branch,
    roll_number
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    'student',
    'pending', -- Requires admin confirmation before platform access
    v_club_id,
    NULLIF(TRIM(new.raw_user_meta_data ->> 'club_role'), ''),
    NULLIF(TRIM(new.raw_user_meta_data ->> 'year'), ''),
    NULLIF(TRIM(new.raw_user_meta_data ->> 'branch'), ''),
    NULLIF(TRIM(new.raw_user_meta_data ->> 'roll_number'), '')
  );
  RETURN new;
END;
$$;

-- 4. Admin update policy for profiles
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. Secure RPC functions for admin to approve or reject student registration
CREATE OR REPLACE FUNCTION public.approve_student(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can approve student registrations';
  END IF;

  UPDATE public.profiles
  SET approval_status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      rejection_reason = NULL
  WHERE id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_student(target_user_id uuid, reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can reject student registrations';
  END IF;

  UPDATE public.profiles
  SET approval_status = 'rejected',
      approved_by = auth.uid(),
      approved_at = now(),
      rejection_reason = reason
  WHERE id = target_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_student(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reject_student(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_student(uuid, text) TO authenticated;

-- 6. Hardened Row Level Security: block unapproved students from inserting expenses
DROP POLICY IF EXISTS "expenses_insert_own_pending" ON public.expenses;
CREATE POLICY "expenses_insert_own_pending" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND reject_reason IS NULL
    AND bill_path ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.approval_status = 'approved')
    )
    AND EXISTS (
      SELECT 1 FROM public.events ev
      WHERE ev.id = public.expenses.event_id
        AND ev.is_active = true
        AND ev.club_id = public.expenses.club_id
    )
  );

-- 7. Hardened Storage Policy: block unapproved students from uploading bill images
DROP POLICY IF EXISTS "bills_insert_own_folder" ON storage.objects;
CREATE POLICY "bills_insert_own_folder" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
    bucket_id = 'bills' 
    AND (auth.uid())::text = (string_to_array(name, '/'))[1]
    AND name ~ ('^' || (auth.uid())::text || '/[0-9a-f-]{36}\.jpg$')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.approval_status = 'approved')
    )
);

COMMIT;
