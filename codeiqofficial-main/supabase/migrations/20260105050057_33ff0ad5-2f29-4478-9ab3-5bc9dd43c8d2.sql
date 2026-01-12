-- Create table for email domain whitelist with feature access
CREATE TABLE public.email_domain_whitelist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  features JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_domain_whitelist ENABLE ROW LEVEL SECURITY;

-- Only admins can manage domain whitelist
CREATE POLICY "Admins can manage domain whitelist"
ON public.email_domain_whitelist
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can read active domains (needed for feature checking)
CREATE POLICY "Anyone can view active domains"
ON public.email_domain_whitelist
FOR SELECT
USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_email_domain_whitelist_updated_at
BEFORE UPDATE ON public.email_domain_whitelist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for clarity
COMMENT ON TABLE public.email_domain_whitelist IS 'Stores email domains that get free access to selected features';
COMMENT ON COLUMN public.email_domain_whitelist.features IS 'JSON object with feature keys like ai_solver, notes, company_wise, revision, all_features';