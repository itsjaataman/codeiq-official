-- Fix RLS policies for admin operations and classroom management

-- 1. Add DELETE policy for classrooms (admin)
CREATE POLICY "Admins can delete classrooms" 
ON public.classrooms 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Add UPDATE policy for classrooms (admin)
CREATE POLICY "Admins can update classrooms" 
ON public.classrooms 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Add DELETE policy for classroom_students (admin) 
CREATE POLICY "Admins can delete classroom students" 
ON public.classroom_students 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Add DELETE policy for classroom_tests (admin)
CREATE POLICY "Admins can delete classroom tests" 
ON public.classroom_tests 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Add DELETE policy for classroom_assignments (admin)
CREATE POLICY "Admins can delete classroom assignments" 
ON public.classroom_assignments 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Add DELETE policy for profiles (admin) - for user deletion
CREATE POLICY "Admins can delete profiles" 
ON public.profiles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 7. Add DELETE policy for user_problem_progress (admin)
CREATE POLICY "Admins can delete user progress" 
ON public.user_problem_progress 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 8. Add DELETE policy for user_achievements (admin)
CREATE POLICY "Admins can delete user achievements" 
ON public.user_achievements 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));