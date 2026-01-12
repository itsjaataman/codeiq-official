-- Add preferred DSA language column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_dsa_language TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.preferred_dsa_language IS 'User preferred programming language for DSA: java, python, c, cpp';