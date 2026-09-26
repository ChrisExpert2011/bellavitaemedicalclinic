REVOKE EXECUTE ON FUNCTION public.get_appointment_status(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_appointment_status(text) TO service_role;