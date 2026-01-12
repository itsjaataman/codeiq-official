-- Allow admins to view all classrooms
CREATE POLICY "Admins can view all classrooms" 
ON public.classrooms 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all classroom students
CREATE POLICY "Admins can view all classroom students" 
ON public.classroom_students 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all classroom tests
CREATE POLICY "Admins can view all classroom tests" 
ON public.classroom_tests 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all test submissions
CREATE POLICY "Admins can view all test submissions" 
ON public.test_submissions 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));