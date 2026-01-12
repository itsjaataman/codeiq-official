-- Create function to increment discount code usage
CREATE OR REPLACE FUNCTION public.increment_discount_usage(code_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE discount_codes 
  SET used_count = used_count + 1 
  WHERE id = code_id;
END;
$$;