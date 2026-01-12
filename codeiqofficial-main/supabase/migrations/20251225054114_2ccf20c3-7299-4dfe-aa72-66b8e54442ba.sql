-- Insert landing page stats settings
INSERT INTO public.app_settings (key, value)
VALUES 
  ('landing_stats', '{"problems_count": "500+", "companies_count": "50+", "topics_count": "15+"}'::jsonb)
ON CONFLICT (key) DO NOTHING;