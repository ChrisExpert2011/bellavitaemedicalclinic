
CREATE OR REPLACE FUNCTION public.book_appointment(
  _patient_name text,
  _phone text,
  _insurance text,
  _insurance_card text,
  _doctor text,
  _requested_date date,
  _requested_time text,
  _reason text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text;
BEGIN
  IF length(trim(_patient_name)) < 2 OR length(trim(_phone)) < 8 OR length(trim(_doctor)) < 2 THEN
    RAISE EXCEPTION 'Invalid appointment details';
  END IF;

  INSERT INTO public.appointments
    (patient_name, phone, insurance, insurance_card, doctor, requested_date, requested_time, reason, user_id)
  VALUES
    (left(trim(_patient_name),120), left(trim(_phone),40), left(trim(_insurance),40),
     nullif(left(trim(coalesce(_insurance_card,'')),60),''), left(trim(_doctor),160),
     _requested_date, left(trim(_requested_time),10),
     nullif(left(trim(coalesce(_reason,'')),500),''), auth.uid())
  RETURNING code INTO v_code;

  RETURN v_code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.book_appointment(text,text,text,text,text,date,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_appointment(text,text,text,text,text,date,text,text) TO anon, authenticated;
