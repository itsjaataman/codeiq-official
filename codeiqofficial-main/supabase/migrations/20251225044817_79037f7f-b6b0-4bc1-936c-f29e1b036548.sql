-- Drop the policy first, then update the function
DROP POLICY IF EXISTS "Teachers can manage own classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Students can view their classrooms" ON public.classrooms;

-- Now we can safely replace the function
CREATE OR REPLACE FUNCTION public.get_teacher_id_for_user()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  teacher_id uuid;
BEGIN
  SELECT t.id INTO teacher_id
  FROM public.teachers t
  WHERE t.user_id = auth.uid()
  AND t.is_active = true
  LIMIT 1;
  
  RETURN teacher_id;
END;
$$;

-- Create student policy function
CREATE OR REPLACE FUNCTION public.is_student_of_classroom(p_classroom_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.classroom_students cs
    WHERE cs.classroom_id = p_classroom_id
      AND cs.user_id = auth.uid()
      AND cs.is_active = true
  );
END;
$$;

-- Recreate policies using the security definer functions
CREATE POLICY "Teachers can manage own classrooms" 
ON public.classrooms 
FOR ALL 
USING (teacher_id = public.get_teacher_id_for_user());

CREATE POLICY "Students can view their classrooms" 
ON public.classrooms 
FOR SELECT 
USING (public.is_student_of_classroom(id));