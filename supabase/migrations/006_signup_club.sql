-- ============================================================================
-- 006_signup_club.sql
-- Signup club selection: validate club_id in handle_new_user(), never trust
-- client role, ensure anon can read clubs for signup dropdown.
-- Safe to run once on top of 001–005.
-- ============================================================================

BEGIN;

-- Anon read for signup club dropdown (idempotent)
DROP POLICY IF EXISTS "clubs_select_anon" ON public.clubs;
CREATE POLICY "clubs_select_anon" ON public.clubs
  FOR SELECT TO anon
  USING (true);

-- Backfill: legacy signups always received Digital VJTI club_id when they completed
-- the old "member = yes" flow; fill any remaining rows that have club details but no club.
UPDATE public.profiles p
SET club_id = c.id
FROM public.clubs c
WHERE c.name = 'Digital VJTI'
  AND p.club_id IS NULL
  AND p.role = 'student'
  AND (
    p.club_role IS NOT NULL
    OR p.approval_status IN ('pending', 'approved', 'rejected')
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_parsed uuid;
BEGIN
  -- Parse club_id from signup metadata; ignore invalid UUIDs
  BEGIN
    IF (new.raw_user_meta_data ->> 'club_id') IS NOT NULL
       AND TRIM(new.raw_user_meta_data ->> 'club_id') <> '' THEN
      v_parsed := (new.raw_user_meta_data ->> 'club_id')::uuid;
    ELSE
      v_parsed := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_parsed := NULL;
  END;

  -- Only accept club ids that exist in public.clubs
  IF v_parsed IS NOT NULL THEN
    SELECT id INTO v_club_id
    FROM public.clubs
    WHERE id = v_parsed
    LIMIT 1;
  END IF;

  -- role is never taken from client metadata (including role = 'admin' attempts)
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
    'pending',
    v_club_id,
    NULLIF(TRIM(new.raw_user_meta_data ->> 'club_role'), ''),
    NULLIF(TRIM(new.raw_user_meta_data ->> 'year'), ''),
    NULLIF(TRIM(new.raw_user_meta_data ->> 'branch'), ''),
    NULLIF(TRIM(new.raw_user_meta_data ->> 'roll_number'), '')
  );
  RETURN new;
END;
$$;

COMMIT;
