-- Drop the complex policy
DROP POLICY IF EXISTS "Teachers can view classroom student profiles" ON public.profiles;

-- Create a simpler security definer function for teachers to check if they can view a profile
CREATE OR REPLACE FUNCTION public.teacher_can_view_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM classroom_students cs
    JOIN classrooms c ON cs.classroom_id = c.id
    JOIN teachers t ON c.teacher_id = t.id
    WHERE cs.user_id = profile_user_id
      AND cs.is_active = true
      AND t.user_id = auth.uid()
  )
$$;

-- Create new policy using the function
CREATE POLICY "Teachers can view classroom student profiles v2" 
ON public.profiles 
FOR SELECT 
USING (public.teacher_can_view_profile(user_id));