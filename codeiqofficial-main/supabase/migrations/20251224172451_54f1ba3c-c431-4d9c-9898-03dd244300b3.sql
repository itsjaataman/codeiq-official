-- Drop the partially created tables to start fresh
DROP TABLE IF EXISTS public.test_submissions CASCADE;
DROP TABLE IF EXISTS public.test_questions CASCADE;
DROP TABLE IF EXISTS public.classroom_tests CASCADE;
DROP TABLE IF EXISTS public.classroom_assignments CASCADE;
DROP TABLE IF EXISTS public.classroom_students CASCADE;
DROP TABLE IF EXISTS public.classrooms CASCADE;
DROP TABLE IF EXISTS public.teachers CASCADE;
DROP TABLE IF EXISTS public.app_settings CASCADE;

-- Create app settings table for admin toggles
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings"
ON public.app_settings FOR SELECT
USING (true);

CREATE POLICY "Admins can update settings"
ON public.app_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert settings"
ON public.app_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.app_settings (key, value) VALUES
('paid_features_enabled', '{"enabled": true}'::jsonb),
('invite_system_enabled', '{"enabled": true}'::jsonb);

-- Create teachers table
CREATE TABLE public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage teachers"
ON public.teachers FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can view themselves"
ON public.teachers FOR SELECT
USING (auth.uid() = user_id);

-- Create classrooms table
CREATE TABLE public.classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  invite_code text UNIQUE NOT NULL DEFAULT substring(md5(random()::text), 1, 8),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;

-- Create classroom students table BEFORE policies that reference it
CREATE TABLE public.classroom_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE(classroom_id, user_id)
);

ALTER TABLE public.classroom_students ENABLE ROW LEVEL SECURITY;

-- Now add classroom policies
CREATE POLICY "Teachers can manage own classrooms"
ON public.classrooms FOR ALL
USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Students can view their classrooms"
ON public.classrooms FOR SELECT
USING (id IN (SELECT classroom_id FROM public.classroom_students WHERE user_id = auth.uid()));

CREATE POLICY "Anyone can view active classrooms"
ON public.classrooms FOR SELECT
USING (is_active = true);

-- Classroom students policies
CREATE POLICY "Teachers can manage classroom students"
ON public.classroom_students FOR ALL
USING (classroom_id IN (
  SELECT c.id FROM public.classrooms c
  JOIN public.teachers t ON c.teacher_id = t.id
  WHERE t.user_id = auth.uid()
));

CREATE POLICY "Students can view own membership"
ON public.classroom_students FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can join classrooms"
ON public.classroom_students FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Create classroom problem assignments
CREATE TABLE public.classroom_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  problem_id uuid NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  due_date timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(classroom_id, problem_id)
);

ALTER TABLE public.classroom_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage assignments"
ON public.classroom_assignments FOR ALL
USING (classroom_id IN (
  SELECT c.id FROM public.classrooms c
  JOIN public.teachers t ON c.teacher_id = t.id
  WHERE t.user_id = auth.uid()
));

CREATE POLICY "Students can view assignments"
ON public.classroom_assignments FOR SELECT
USING (classroom_id IN (SELECT classroom_id FROM public.classroom_students WHERE user_id = auth.uid()));

-- Create tests table
CREATE TABLE public.classroom_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  topic_id uuid REFERENCES public.topics(id),
  difficulty text,
  time_limit_minutes integer NOT NULL DEFAULT 60,
  is_active boolean DEFAULT false,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage tests"
ON public.classroom_tests FOR ALL
USING (classroom_id IN (
  SELECT c.id FROM public.classrooms c
  JOIN public.teachers t ON c.teacher_id = t.id
  WHERE t.user_id = auth.uid()
));

CREATE POLICY "Students can view tests"
ON public.classroom_tests FOR SELECT
USING (classroom_id IN (SELECT classroom_id FROM public.classroom_students WHERE user_id = auth.uid()));

-- Create test questions table
CREATE TABLE public.test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.classroom_tests(id) ON DELETE CASCADE,
  problem_id uuid NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  points integer DEFAULT 10,
  display_order integer DEFAULT 0,
  UNIQUE(test_id, problem_id)
);

ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage test questions"
ON public.test_questions FOR ALL
USING (test_id IN (
  SELECT ct.id FROM public.classroom_tests ct
  JOIN public.classrooms c ON ct.classroom_id = c.id
  JOIN public.teachers t ON c.teacher_id = t.id
  WHERE t.user_id = auth.uid()
));

CREATE POLICY "Students can view test questions"
ON public.test_questions FOR SELECT
USING (test_id IN (
  SELECT ct.id FROM public.classroom_tests ct
  WHERE ct.classroom_id IN (SELECT classroom_id FROM public.classroom_students WHERE user_id = auth.uid())
));

-- Create test submissions table
CREATE TABLE public.test_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.classroom_tests(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  submitted_at timestamp with time zone,
  score integer DEFAULT 0,
  max_score integer DEFAULT 0,
  UNIQUE(test_id, student_id)
);

ALTER TABLE public.test_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view submissions"
ON public.test_submissions FOR SELECT
USING (test_id IN (
  SELECT ct.id FROM public.classroom_tests ct
  JOIN public.classrooms c ON ct.classroom_id = c.id
  JOIN public.teachers t ON c.teacher_id = t.id
  WHERE t.user_id = auth.uid()
));

CREATE POLICY "Students can manage own submissions"
ON public.test_submissions FOR ALL
USING (student_id = auth.uid());