
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_appointment_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

DROP POLICY "Anyone can book" ON public.appointments;
CREATE POLICY "Anyone can book" ON public.appointments FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
