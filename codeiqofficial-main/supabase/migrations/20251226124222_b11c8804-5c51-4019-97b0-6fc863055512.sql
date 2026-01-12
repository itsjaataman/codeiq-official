-- Drop problematic RLS policies that cause infinite recursion
DROP POLICY IF EXISTS "Students can view own membership" ON public.classroom_students;
DROP POLICY IF EXISTS "Classroom students can view classmate profiles via join" ON public.profiles;
DROP POLICY IF EXISTS "Students can view classmates profiles" ON public.profiles;

-- Recreate policies using security definer functions to avoid recursion

-- Policy for students to view their own classroom membership
CREATE POLICY "Students can view own membership" 
ON public.classroom_students 
FOR SELECT 
USING (user_id = auth.uid());

-- Drop and recreate the classmate profiles policy to use the existing function
-- The is_classroom_student and get_classmate_user_ids functions already exist as SECURITY DEFINER