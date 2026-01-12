-- Create a security definer function to get admin and teacher user IDs for leaderboard exclusion
CREATE OR REPLACE FUNCTION public.get_excluded_leaderboard_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT DISTINCT user_id 
    FROM (
      -- Get users with admin or teacher roles
      SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'teacher')
      UNION
      -- Also get teacher user_ids from teachers table
      SELECT user_id FROM public.teachers WHERE user_id IS NOT NULL AND is_active = true
    ) combined
  )
$$;