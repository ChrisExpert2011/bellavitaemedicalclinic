CREATE TABLE public.insurances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.insurances TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurances TO authenticated;
GRANT ALL ON public.insurances TO service_role;

ALTER TABLE public.insurances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insurances are public" ON public.insurances
  FOR SELECT USING (true);

CREATE POLICY "Admins manage insurances" ON public.insurances
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER insurances_touch BEFORE UPDATE ON public.insurances
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.insurances (name, sort_order) VALUES
  ('RSSB', 1), ('UAP', 2), ('MMI', 3), ('RADIANT', 4),
  ('BRITAM', 5), ('PRIME', 6), ('SANLAM', 7);

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid;

ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;