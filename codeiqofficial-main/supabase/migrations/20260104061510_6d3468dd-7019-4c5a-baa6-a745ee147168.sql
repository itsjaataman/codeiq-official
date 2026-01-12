-- Create a table for caching AI solutions globally
CREATE TABLE public.ai_solution_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  problem_id TEXT NOT NULL,
  problem_title TEXT NOT NULL,
  language TEXT NOT NULL,
  solution TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  usage_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(problem_id, language)
);

-- Enable RLS
ALTER TABLE public.ai_solution_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read cached solutions
CREATE POLICY "Anyone can read cached solutions"
ON public.ai_solution_cache
FOR SELECT
USING (true);

-- Service role can insert/update cached solutions (edge function uses service role)
CREATE POLICY "Service can manage cached solutions"
ON public.ai_solution_cache
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_ai_solution_cache_lookup ON public.ai_solution_cache(problem_id, language);

-- Add trigger for updated_at
CREATE TRIGGER update_ai_solution_cache_updated_at
BEFORE UPDATE ON public.ai_solution_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();