CREATE OR REPLACE FUNCTION public.get_appointment_status(_code text)
RETURNS TABLE(code text, status text, doctor text, requested_date date, requested_time text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.code::text, a.status::text, a.doctor::text, a.requested_date::date, a.requested_time::text
  FROM public.appointments a
  WHERE upper(a.code) = upper(trim(_code))
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_appointment_status(text) TO anon, authenticated;