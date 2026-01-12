-- Create a SECURITY DEFINER function to check if user is the teacher for a classroom
-- This avoids infinite recursion in RLS policies
CREATE OR REPLACE FUNCTION public.is_teacher_of_classroom(classroom_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classrooms c
    JOIN public.teachers t ON c.teacher_id = t.id
    WHERE c.id = classroom_id
      AND t.user_id = auth.uid()
  )
$$;

-- Create a function to get teacher_id for current user
CREATE OR REPLACE FUNCTION public.get_teacher_id_for_user()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1
$$;

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Teachers can manage own classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Students can view their classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Anyone can view active classrooms" ON public.classrooms;

-- Recreate policies using the SECURITY DEFINER functions
CREATE POLICY "Teachers can manage own classrooms" 
ON public.classrooms 
FOR ALL 
USING (teacher_id = public.get_teacher_id_for_user());

CREATE POLICY "Students can view their classrooms" 
ON public.classrooms 
FOR SELECT 
USING (id IN (
  SELECT classroom_id FROM public.classroom_students WHERE user_id = auth.uid()
));

CREATE POLICY "Anyone can view active classrooms for joining" 
ON public.classrooms 
FOR SELECT 
USING (is_active = true);