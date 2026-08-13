ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS email text;

CREATE OR REPLACE FUNCTION public.book_appointment(_patient_name text, _phone text, _insurance text, _insurance_card text, _doctor text, _requested_date date, _requested_time text, _reason text, _email text DEFAULT NULL)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
BEGIN
  IF length(trim(_patient_name)) < 2 OR length(trim(_phone)) < 8 OR length(trim(_doctor)) < 2 THEN
    RAISE EXCEPTION 'Invalid appointment details';
  END IF;

  INSERT INTO public.appointments
    (patient_name, phone, email, insurance, insurance_card, doctor, requested_date, requested_time, reason, user_id)
  VALUES
    (left(trim(_patient_name),120), left(trim(_phone),40),
     nullif(left(trim(coalesce(_email,'')),160),''),
     left(trim(_insurance),40),
     nullif(left(trim(coalesce(_insurance_card,'')),60),''), left(trim(_doctor),160),
     _requested_date, left(trim(_requested_time),10),
     nullif(left(trim(coalesce(_reason,'')),500),''), auth.uid())
  RETURNING code INTO v_code;

  RETURN v_code;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_appointments_by_token(uuid);

CREATE FUNCTION public.get_appointments_by_token(_token uuid)
 RETURNS TABLE(code text, patient_name text, phone text, email text, doctor text, insurance text, insurance_card text, requested_date date, requested_time text, reason text, status text, cancellation_reason text, cancelled_at timestamp with time zone, rescheduled_at timestamp with time zone, previous_date date, previous_time text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.code, a.patient_name, a.phone, a.email, a.doctor, a.insurance, a.insurance_card,
         a.requested_date, a.requested_time, a.reason, a.status,
         a.cancellation_reason, a.cancelled_at, a.rescheduled_at,
         a.previous_date, a.previous_time, a.created_at
  FROM public.appointments a
  WHERE regexp_replace(a.phone, '[^0-9]', '', 'g') = public.phone_for_token(_token)
  ORDER BY a.requested_date DESC, a.requested_time DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_appointments_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_appointment(text, text, text, text, text, date, text, text, text) TO anon, authenticated;