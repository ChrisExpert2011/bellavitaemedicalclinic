
CREATE OR REPLACE FUNCTION public.get_appointments_by_phone(_phone text)
RETURNS TABLE (
  code text,
  patient_name text,
  doctor text,
  insurance text,
  requested_date date,
  requested_time text,
  reason text,
  status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.code, a.patient_name, a.doctor, a.insurance, a.requested_date,
         a.requested_time, a.reason, a.status, a.created_at
  FROM public.appointments a
  WHERE length(trim(_phone)) >= 8
    AND regexp_replace(a.phone, '[^0-9]', '', 'g') = regexp_replace(_phone, '[^0-9]', '', 'g')
  ORDER BY a.requested_date DESC, a.requested_time DESC;
$$;

CREATE OR REPLACE FUNCTION public.cancel_appointment_by_phone(_code text, _phone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF length(trim(coalesce(_phone,''))) < 8 OR length(trim(coalesce(_code,''))) < 4 THEN
    RETURN false;
  END IF;

  UPDATE public.appointments a
     SET status = 'cancelled'
   WHERE upper(trim(a.code)) = upper(trim(_code))
     AND regexp_replace(a.phone, '[^0-9]', '', 'g') = regexp_replace(_phone, '[^0-9]', '', 'g')
     AND a.status NOT IN ('cancelled', 'completed')
     AND a.requested_date >= current_date;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_appointments_by_phone(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_appointment_by_phone(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_appointments_by_phone(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_phone(text, text) TO anon, authenticated;
