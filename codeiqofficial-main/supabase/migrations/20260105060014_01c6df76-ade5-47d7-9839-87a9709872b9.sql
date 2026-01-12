-- Create domain_plans table for custom pricing per domain
CREATE TABLE public.domain_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID NOT NULL REFERENCES public.email_domain_whitelist(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 30,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_combo BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.domain_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage domain plans"
  ON public.domain_plans
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active domain plans"
  ON public.domain_plans
  FOR SELECT
  USING (is_active = true);

-- Add index for faster lookups
CREATE INDEX idx_domain_plans_domain_id ON public.domain_plans(domain_id);

-- Create trigger for updated_at
CREATE TRIGGER update_domain_plans_updated_at
  BEFORE UPDATE ON public.domain_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();