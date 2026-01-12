-- Create table for tracking individual problem answers during tests
CREATE TABLE public.test_problem_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_submission_id UUID NOT NULL,
  problem_id UUID NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(test_submission_id, problem_id)
);

-- Enable RLS
ALTER TABLE public.test_problem_answers ENABLE ROW LEVEL SECURITY;

-- Students can manage their own answers
CREATE POLICY "Students can manage own answers" 
ON public.test_problem_answers 
FOR ALL 
USING (test_submission_id IN (SELECT id FROM public.test_submissions WHERE student_id = auth.uid()));

-- Teachers can view answers for their classroom tests
CREATE POLICY "Teachers can view test answers" 
ON public.test_problem_answers 
FOR SELECT 
USING (test_submission_id IN (
  SELECT ts.id FROM public.test_submissions ts
  JOIN public.classroom_tests ct ON ts.test_id = ct.id
  JOIN public.classrooms c ON ct.classroom_id = c.id
  JOIN public.teachers t ON c.teacher_id = t.id
  WHERE t.user_id = auth.uid()
));