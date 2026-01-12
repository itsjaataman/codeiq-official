-- Create invite codes table
CREATE TABLE public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  created_by uuid NOT NULL,
  used_by uuid,
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Users can view their own created invites
CREATE POLICY "Users can view own invites"
ON public.invite_codes FOR SELECT
USING (auth.uid() = created_by);

-- Users can create invite codes
CREATE POLICY "Users can create invites"
ON public.invite_codes FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Anyone can check if a code is valid (for signup)
CREATE POLICY "Anyone can check valid codes"
ON public.invite_codes FOR SELECT
USING (used_by IS NULL AND expires_at > now());

-- Allow updating used_by when code is redeemed
CREATE POLICY "Allow redeeming codes"
ON public.invite_codes FOR UPDATE
USING (used_by IS NULL AND expires_at > now());

-- Add invited_by column to profiles
ALTER TABLE public.profiles ADD COLUMN invited_by uuid;
ALTER TABLE public.profiles ADD COLUMN invite_code_used text;