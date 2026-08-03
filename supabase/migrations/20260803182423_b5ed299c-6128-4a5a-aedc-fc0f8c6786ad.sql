-- 1. Appointment columns
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS previous_date date,
  ADD COLUMN IF NOT EXISTS previous_time text;

-- 2. OTP table
CREATE TABLE IF NOT EXISTS public.phone_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_digits text NOT NULL,
  code text NOT NULL,
  token uuid,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  token_expires_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.phone_otps TO service_role;
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS phone_otps_phone_idx ON public.phone_otps (phone_digits);
CREATE INDEX IF NOT EXISTS phone_otps_token_idx ON public.phone_otps (token);
DROP TRIGGER IF EXISTS phone_otps_touch ON public.phone_otps;
CREATE TRIGGER phone_otps_touch BEFORE UPDATE ON public.phone_otps
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Reminder log
CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  kind text NOT NULL,
  phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, kind)
);
GRANT SELECT ON public.appointment_reminders TO authenticated;
GRANT ALL ON public.appointment_reminders TO service_role;
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins read reminders" ON public.appointment_reminders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
DROP TRIGGER IF EXISTS appointment_reminders_touch ON public.appointment_reminders;
CREATE TRIGGER appointment_reminders_touch BEFORE UPDATE ON public.appointment_reminders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. OTP request / verify
CREATE OR REPLACE FUNCTION public.request_phone_otp(_phone text)
RETURNS TABLE (code text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text := regexp_replace(coalesce(_phone,''), '[^0-9]', '', 'g');
  v_code text;
  v_recent int;
BEGIN
  IF length(v_digits) < 8 THEN
    RAISE EXCEPTION 'Please enter a valid phone number';
  END IF;

  SELECT count(*) INTO v_recent FROM public.phone_otps o
   WHERE o.phone_digits = v_digits AND o.created_at > now() - interval '15 minutes';
  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'Too many codes requested. Please try again later.';
  END IF;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  INSERT INTO public.phone_otps (phone_digits, code, expires_at)
  VALUES (v_digits, v_code, now() + interval '10 minutes');

  RETURN QUERY SELECT v_code, now() + interval '10 minutes';
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_phone_otp(_phone text, _code text)
RETURNS TABLE (token uuid, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text := regexp_replace(coalesce(_phone,''), '[^0-9]', '', 'g');
  v_row public.phone_otps%ROWTYPE;
  v_token uuid := gen_random_uuid();
  v_exp timestamptz := now() + interval '30 minutes';
BEGIN
  SELECT * INTO v_row FROM public.phone_otps o
   WHERE o.phone_digits = v_digits AND o.verified_at IS NULL AND o.expires_at > now()
   ORDER BY o.created_at DESC LIMIT 1;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'This code has expired. Please request a new one.';
  END IF;

  IF v_row.attempts >= 5 THEN
    RAISE EXCEPTION 'Too many incorrect attempts. Please request a new code.';
  END IF;

  IF trim(coalesce(_code,'')) <> v_row.code THEN
    UPDATE public.phone_otps SET attempts = attempts + 1 WHERE id = v_row.id;
    RAISE EXCEPTION 'Incorrect code';
  END IF;

  UPDATE public.phone_otps
     SET verified_at = now(), token = v_token, token_expires_at = v_exp
   WHERE id = v_row.id;

  RETURN QUERY SELECT v_token, v_exp;
END;
$$;

CREATE OR REPLACE FUNCTION public.phone_for_token(_token uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.phone_digits FROM public.phone_otps o
   WHERE o.token = _token AND o.token_expires_at > now()
   LIMIT 1;
$$;

-- 5. Verified patient actions
CREATE OR REPLACE FUNCTION public.get_appointments_by_token(_token uuid)
RETURNS TABLE (
  code text,
  patient_name text,
  phone text,
  doctor text,
  insurance text,
  insurance_card text,
  requested_date date,
  requested_time text,
  reason text,
  status text,
  cancellation_reason text,
  cancelled_at timestamptz,
  rescheduled_at timestamptz,
  previous_date date,
  previous_time text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.code, a.patient_name, a.phone, a.doctor, a.insurance, a.insurance_card,
         a.requested_date, a.requested_time, a.reason, a.status,
         a.cancellation_reason, a.cancelled_at, a.rescheduled_at,
         a.previous_date, a.previous_time, a.created_at
  FROM public.appointments a
  WHERE regexp_replace(a.phone, '[^0-9]', '', 'g') = public.phone_for_token(_token)
  ORDER BY a.requested_date DESC, a.requested_time DESC;
$$;

CREATE OR REPLACE FUNCTION public.cancel_appointment_by_token(_token uuid, _code text, _reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := public.phone_for_token(_token);
  v_updated int;
BEGIN
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Your verification has expired. Please verify your phone number again.';
  END IF;

  UPDATE public.appointments a
     SET status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = nullif(trim(coalesce(_reason,'')), '')
   WHERE upper(trim(a.code)) = upper(trim(coalesce(_code,'')))
     AND regexp_replace(a.phone, '[^0-9]', '', 'g') = v_phone
     AND a.status NOT IN ('cancelled', 'completed')
     AND a.requested_date >= current_date;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_appointment_by_token(_token uuid, _code text, _date date, _time text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := public.phone_for_token(_token);
  v_updated int;
BEGIN
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Your verification has expired. Please verify your phone number again.';
  END IF;
  IF _date IS NULL OR _date < current_date THEN
    RAISE EXCEPTION 'Please choose a future date';
  END IF;
  IF _time !~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RAISE EXCEPTION 'Please choose a valid time';
  END IF;
  IF _time < '07:00' OR _time > '23:00' THEN
    RAISE EXCEPTION 'The clinic is open from 07:00 to 23:00';
  END IF;

  UPDATE public.appointments a
     SET previous_date = a.requested_date,
         previous_time = a.requested_time,
         requested_date = _date,
         requested_time = _time,
         rescheduled_at = now(),
         status = 'pending'
   WHERE upper(trim(a.code)) = upper(trim(coalesce(_code,'')))
     AND regexp_replace(a.phone, '[^0-9]', '', 'g') = v_phone
     AND a.status NOT IN ('cancelled', 'completed')
     AND a.requested_date >= current_date;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    DELETE FROM public.appointment_reminders r
     USING public.appointments a
     WHERE r.appointment_id = a.id
       AND upper(trim(a.code)) = upper(trim(coalesce(_code,'')))
       AND r.status <> 'sent';
  END IF;

  RETURN v_updated > 0;
END;
$$;

-- 6. Reminder queue helper (used by the scheduled reminder endpoint)
CREATE OR REPLACE FUNCTION public.due_appointment_reminders()
RETURNS TABLE (
  appointment_id uuid,
  kind text,
  code text,
  patient_name text,
  phone text,
  doctor text,
  requested_date date,
  requested_time text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, k.kind, a.code, a.patient_name, a.phone, a.doctor, a.requested_date, a.requested_time
  FROM public.appointments a
  CROSS JOIN (VALUES ('24h', interval '24 hours'), ('2h', interval '2 hours')) AS k(kind, lead_time)
  WHERE a.status NOT IN ('cancelled', 'completed')
    AND ((a.requested_date::text || ' ' || a.requested_time)::timestamp) BETWEEN now() AND now() + k.lead_time
    AND NOT EXISTS (
      SELECT 1 FROM public.appointment_reminders r
       WHERE r.appointment_id = a.id AND r.kind = k.kind
    );
$$;

REVOKE EXECUTE ON FUNCTION public.request_phone_otp(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_phone_otp(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.phone_for_token(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_appointments_by_token(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_appointment_by_token(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reschedule_appointment_by_token(uuid, text, date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.due_appointment_reminders() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.verify_phone_otp(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_appointments_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_token(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_by_token(uuid, text, date, text) TO anon, authenticated;

-- Old phone-only lookup/cancel are replaced by the verified-token flow
DROP FUNCTION IF EXISTS public.get_appointments_by_phone(text);
DROP FUNCTION IF EXISTS public.cancel_appointment_by_phone(text, text);