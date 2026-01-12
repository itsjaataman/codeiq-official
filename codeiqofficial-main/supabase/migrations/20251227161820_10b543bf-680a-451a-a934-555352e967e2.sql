-- Fix infinite recursion in teachers RLS policies
-- The issue is: teachers policy queries classrooms, and classrooms policy uses get_teacher_id_for_user() which queries teachers

-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Classroom students can view their teacher" ON public.teachers;

-- Create a security definer function to check if user is a student of a teacher's classroom
CREATE OR REPLACE FUNCTION public.is_student_of_teacher(teacher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM classrooms c
    JOIN classroom_students cs ON cs.classroom_id = c.id
    WHERE c.teacher_id = is_student_of_teacher.teacher_id
      AND cs.user_id = auth.uid()
      AND cs.is_active = true
  )
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Classroom students can view their teacher"
ON public.teachers
FOR SELECT
USING (public.is_student_of_teacher(id));