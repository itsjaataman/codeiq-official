-- Create function to check if user is a classroom student (based on classroom_students table)
CREATE OR REPLACE FUNCTION public.is_classroom_student(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classroom_students
    WHERE user_id = check_user_id AND is_active = true
  )
$$;

-- Create function to get all classmate user_ids for a user
CREATE OR REPLACE FUNCTION public.get_classmate_user_ids(check_user_id uuid DEFAULT auth.uid())
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT cs2.user_id
  FROM public.classroom_students cs1
  JOIN public.classroom_students cs2 ON cs1.classroom_id = cs2.classroom_id
  WHERE cs1.user_id = check_user_id
    AND cs1.is_active = true
    AND cs2.is_active = true
$$;

-- Update profiles RLS to allow students to view other students in same classroom
DROP POLICY IF EXISTS "Students can view classmates profiles" ON public.profiles;
CREATE POLICY "Students can view classmates profiles" 
ON public.profiles 
FOR SELECT 
USING (
  user_id IN (SELECT public.get_classmate_user_ids(auth.uid()))
);