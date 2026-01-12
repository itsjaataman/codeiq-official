-- Add discount_percent column to email_domain_whitelist for domain-based discounts
ALTER TABLE public.email_domain_whitelist 
ADD COLUMN discount_percent integer DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.email_domain_whitelist.discount_percent IS 'Discount percentage (0-100) to auto-apply for users with this email domain';