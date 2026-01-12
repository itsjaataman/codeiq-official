-- Add columns to store AI-generated solutions
ALTER TABLE public.user_problem_progress 
ADD COLUMN ai_solution TEXT DEFAULT NULL,
ADD COLUMN ai_solution_language TEXT DEFAULT NULL;