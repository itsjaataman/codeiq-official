-- Create discount_codes table for admin-generated codes
CREATE TABLE public.discount_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL DEFAULT 10,
  max_uses INTEGER DEFAULT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  applies_to TEXT DEFAULT 'all', -- 'all', 'basic', 'pro'
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Admins can manage discount codes
CREATE POLICY "Admins can view all discount codes"
ON public.discount_codes FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create discount codes"
ON public.discount_codes FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update discount codes"
ON public.discount_codes FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete discount codes"
ON public.discount_codes FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow anyone to validate codes (for checkout)
CREATE POLICY "Anyone can validate active codes"
ON public.discount_codes FOR SELECT
USING (is_active = true AND (valid_until IS NULL OR valid_until > now()) AND (max_uses IS NULL OR used_count < max_uses));

-- Add is_disabled column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false;

-- Create payments table to track PhonePe transactions
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  merchant_transaction_id TEXT NOT NULL UNIQUE,
  phonepay_transaction_id TEXT,
  amount INTEGER NOT NULL, -- in paise
  plan TEXT NOT NULL, -- 'basic' or 'pro'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  discount_code_id UUID REFERENCES public.discount_codes(id),
  discount_amount INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "Users can view own payments"
ON public.payments FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all payments
CREATE POLICY "Admins can view all payments"
ON public.payments FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role inserts/updates payments (via edge function)
CREATE POLICY "Service can manage payments"
ON public.payments FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for payments updated_at
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();