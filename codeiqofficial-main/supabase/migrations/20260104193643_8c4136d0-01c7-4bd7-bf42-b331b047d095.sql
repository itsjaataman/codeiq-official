-- Add GitHub-related columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS github_username text,
ADD COLUMN IF NOT EXISTS github_repos integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS github_contributions integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS github_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_github_sync timestamp with time zone;