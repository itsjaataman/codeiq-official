-- Create password_reset_otps table to store OTPs persistently
CREATE TABLE public.password_reset_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_password_reset_otps_email ON public.password_reset_otps(email);

-- Enable RLS (but allow service role to manage)
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role operations (edge functions use service role)
CREATE POLICY "Service role can manage OTPs" ON public.password_reset_otps
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Clean up expired OTPs automatically (old entries)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.password_reset_otps WHERE expires_at < now() OR used = true;
END;
$$;