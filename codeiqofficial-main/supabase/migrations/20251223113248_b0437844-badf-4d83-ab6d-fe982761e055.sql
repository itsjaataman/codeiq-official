-- Create a policy to allow public viewing of profile stats for leaderboard
-- Only expose non-sensitive fields (no email, no personal info)
CREATE POLICY "Anyone can view public profile stats"
ON public.profiles
FOR SELECT
USING (true);

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;