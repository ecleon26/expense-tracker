BEGIN;

-- 1. Storage JPEG-only

-- Update the bucket to only allow image/jpeg
UPDATE storage.buckets 
SET allowed_mime_types = array['image/jpeg'] 
WHERE id = 'bills';

-- Drop the old insert policy
DROP POLICY IF EXISTS "bills_insert_own_folder" ON storage.objects;

-- Create the new insert policy matching the strict folder/filename pattern without metadata checks
CREATE POLICY "bills_insert_own_folder" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
    bucket_id = 'bills' 
    AND (auth.uid())::text = (string_to_array(name, '/'))[1]
    AND name ~ ('^' || (auth.uid())::text || '/[0-9a-f-]{36}\.jpg$')
);

-- 2. Function privileges

-- Revoke execute from PUBLIC and anon for RPC aggregate functions
REVOKE EXECUTE ON FUNCTION public.kpi_summary(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.spend_by_student(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.spend_by_event(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.spend_by_month(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.spend_by_club() FROM PUBLIC, anon;

-- Grant execute to authenticated for RPC aggregate functions
GRANT EXECUTE ON FUNCTION public.kpi_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_by_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_by_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_by_month(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_by_club() TO authenticated;

-- Revoke execute from PUBLIC and anon for SECURITY DEFINER trigger functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_expense_insert() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_expense_update() FROM PUBLIC, anon;

COMMIT;
