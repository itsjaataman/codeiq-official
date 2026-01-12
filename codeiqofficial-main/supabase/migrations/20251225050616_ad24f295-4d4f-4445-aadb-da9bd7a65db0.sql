-- Insert company_problems_enabled setting
INSERT INTO public.app_settings (key, value)
VALUES ('company_problems_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;