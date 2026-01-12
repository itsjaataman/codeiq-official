-- Create achievements table for definitions
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  rarity text NOT NULL DEFAULT 'Common',
  requirement_type text NOT NULL,
  requirement_value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create user_achievements table for unlocked achievements
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Enable RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Achievements are publicly readable
CREATE POLICY "Anyone can view achievements"
ON public.achievements FOR SELECT
USING (true);

-- Users can view their own unlocked achievements
CREATE POLICY "Users can view own achievements"
ON public.user_achievements FOR SELECT
USING (auth.uid() = user_id);

-- Users can unlock achievements
CREATE POLICY "Users can unlock achievements"
ON public.user_achievements FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Insert default achievements
INSERT INTO public.achievements (key, name, description, icon, rarity, requirement_type, requirement_value) VALUES
('first_steps', 'First Steps', 'Solve your first problem', 'Star', 'Common', 'total_solved', 1),
('starter', 'Starter', 'Solve 10 problems', 'Target', 'Common', 'total_solved', 10),
('problem_solver', 'Problem Solver', 'Solve 25 problems', 'Target', 'Uncommon', 'total_solved', 25),
('half_century', 'Half Century', 'Solve 50 problems', 'Award', 'Rare', 'total_solved', 50),
('centurion', 'Centurion', 'Solve 100 problems', 'Trophy', 'Epic', 'total_solved', 100),
('master_coder', 'Master Coder', 'Solve 200 problems', 'Crown', 'Legendary', 'total_solved', 200),
('streak_beginner', 'Streak Beginner', 'Maintain a 3-day streak', 'Flame', 'Common', 'streak', 3),
('streak_master', 'Streak Master', 'Maintain a 7-day streak', 'Flame', 'Rare', 'streak', 7),
('streak_legend', 'Streak Legend', 'Maintain a 30-day streak', 'Flame', 'Legendary', 'streak', 30),
('easy_solver', 'Easy Solver', 'Solve 10 easy problems', 'Zap', 'Common', 'easy_solved', 10),
('medium_warrior', 'Medium Warrior', 'Solve 20 medium problems', 'Medal', 'Uncommon', 'medium_solved', 20),
('hard_conqueror', 'Hard Conqueror', 'Solve 10 hard problems', 'Crown', 'Epic', 'hard_solved', 10);