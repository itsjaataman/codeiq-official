-- Add SRS fields to user_problem_progress
ALTER TABLE public.user_problem_progress
ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS interval_days INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS ease_factor NUMERIC(3,2) DEFAULT 2.50,
ADD COLUMN IF NOT EXISTS repetitions INTEGER DEFAULT 0;

-- Create index for efficient querying of due reviews
CREATE INDEX IF NOT EXISTS idx_user_progress_next_review 
ON public.user_problem_progress(user_id, next_review_at)
WHERE status IN ('solved', 'revision');