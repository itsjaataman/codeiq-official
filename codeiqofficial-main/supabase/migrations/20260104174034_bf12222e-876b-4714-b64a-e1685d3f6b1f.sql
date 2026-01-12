-- Update profiles table: change trial default to 7 days and add subscription_started_at
ALTER TABLE public.profiles 
ALTER COLUMN trial_ends_at SET DEFAULT (now() + '7 days'::interval);

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_started_at timestamp with time zone;

-- Update payments table: add Cashfree columns
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS cashfree_order_id text,
ADD COLUMN IF NOT EXISTS cashfree_payment_id text,
ADD COLUMN IF NOT EXISTS payment_method text;

-- Create subscriptions table for tracking active subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('basic', 'pro', 'pro_plus', 'lifetime')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  starts_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  payment_id uuid REFERENCES public.payments(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- Enable RLS on subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscriptions
CREATE POLICY "Users can view own subscriptions"
ON public.subscriptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service can manage subscriptions"
ON public.subscriptions
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();