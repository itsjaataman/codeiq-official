-- Allow teachers to update their own record
CREATE POLICY "Teachers can update themselves"
ON public.teachers
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);