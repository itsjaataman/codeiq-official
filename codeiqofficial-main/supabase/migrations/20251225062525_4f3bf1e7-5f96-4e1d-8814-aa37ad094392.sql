-- Allow teachers to view profiles of students in their classrooms
CREATE POLICY "Teachers can view student profiles"
ON public.profiles
FOR SELECT
USING (
  user_id IN (
    SELECT cs.user_id
    FROM classroom_students cs
    JOIN classrooms c ON cs.classroom_id = c.id
    JOIN teachers t ON c.teacher_id = t.id
    WHERE t.user_id = auth.uid() AND cs.is_active = true
  )
);

-- Allow admins to view all profiles (already exists but adding for safety)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));