-- Add onboarding fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS mobile_number TEXT,
ADD COLUMN IF NOT EXISTS course TEXT,
ADD COLUMN IF NOT EXISTS pass_out_year INTEGER,
ADD COLUMN IF NOT EXISTS interested_roles TEXT,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.course IS 'User course: MCA, BCA, BTech, MTech, Other';
COMMENT ON COLUMN public.profiles.interested_roles IS 'Job interest: Internship, Full Time, Both';