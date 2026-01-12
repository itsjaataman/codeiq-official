-- Allow teachers to view progress of their students
CREATE POLICY "Teachers can view classroom student progress"
ON public.user_problem_progress
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM classroom_students cs
    JOIN classrooms c ON cs.classroom_id = c.id
    JOIN teachers t ON c.teacher_id = t.id
    WHERE cs.user_id = user_problem_progress.user_id
      AND cs.is_active = true
      AND t.user_id = auth.uid()
  )
);