-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Teachers can view student profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create a more permissive policy for teachers to view profiles of their classroom students
CREATE POLICY "Teachers can view classroom student profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.classroom_students cs
    JOIN public.classrooms c ON cs.classroom_id = c.id
    JOIN public.teachers t ON c.teacher_id = t.id
    WHERE cs.user_id = profiles.user_id
      AND cs.is_active = true
      AND t.user_id = auth.uid()
  )
);

-- Ensure admins can view all profiles
CREATE POLICY "Admins can view all profiles v2" 
ON public.profiles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'::app_role));