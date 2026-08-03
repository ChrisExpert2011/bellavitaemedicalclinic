
CREATE TYPE public.app_role AS ENUM ('admin','staff','patient');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  email text,
  specialty text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone', NEW.email)
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) IN ('nibellasheja@gmail.com','ntakiruchris@yahoo.fr','mucyochristhecla@gmail.com') THEN
    v_role := 'admin';
  ELSIF NEW.raw_user_meta_data->>'role' = 'staff' THEN
    v_role := 'staff';
  ELSE
    v_role := 'patient';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Contacts
CREATE TABLE public.clinic_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clinic_contacts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_contacts TO authenticated;
GRANT ALL ON public.clinic_contacts TO service_role;
ALTER TABLE public.clinic_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contacts are public" ON public.clinic_contacts FOR SELECT USING (true);
CREATE POLICY "Admins manage contacts" ON public.clinic_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER contacts_touch BEFORE UPDATE ON public.clinic_contacts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.clinic_contacts (label, phone, email, sort_order) VALUES
('Reception - Bella Sheja', '+250788275617', 'nibellasheja@gmail.com', 1),
('Administration - Chris Ntakiru', '+250788515358', 'ntakiruchris@yahoo.fr', 2);

-- Team
CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  specialty text NOT NULL,
  phones text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.staff_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_members TO authenticated;
GRANT ALL ON public.staff_members TO service_role;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team is public" ON public.staff_members FOR SELECT USING (true);
CREATE POLICY "Admins manage team" ON public.staff_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER staff_touch BEFORE UPDATE ON public.staff_members
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.staff_members (full_name, specialty, phones, sort_order) VALUES
('Antoine HABIYAMBERE', 'General practitioner', '(+250) 784 259 304 / (+250) 788 427 371', 1),
('Carine KANEZA', 'General practitioner', NULL, 2),
('Pascaline ISHIMWE', 'Dental therapist', NULL, 3),
('Theodomir SEBAZUNGU', 'Gynecologist', NULL, 4),
('Marcellin MUSABENDE', 'Internal medicine specialist', NULL, 5);

-- Appointments
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  patient_name text NOT NULL,
  phone text NOT NULL,
  insurance text NOT NULL,
  insurance_card text,
  doctor text NOT NULL,
  requested_date date NOT NULL,
  requested_time text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.appointments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can book" ON public.appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff and admins read appointments" ON public.appointments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR user_id = auth.uid());
CREATE POLICY "Staff and admins update appointments" ON public.appointments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Admins delete appointments" ON public.appointments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER appointments_touch BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.set_appointment_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_code text;
  v_exists boolean;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN RETURN NEW; END IF;
  LOOP
    v_code := 'BV-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.appointments WHERE code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  NEW.code := v_code;
  RETURN NEW;
END; $$;

ALTER TABLE public.appointments ALTER COLUMN code DROP NOT NULL;
CREATE TRIGGER appointments_code BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.set_appointment_code();

-- News / posts
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  published boolean NOT NULL DEFAULT true,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published posts are public" ON public.posts FOR SELECT USING (published = true OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Admins and staff write posts" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Admins and staff edit posts" ON public.posts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR author_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR author_id = auth.uid());
CREATE POLICY "Admins delete posts" ON public.posts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER posts_touch BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.posts (title, body) VALUES
('Bella Vitae Medical Clinic is open every day, 07:00 - 23:00', 'Our team of general practitioners, dentists, gynecologists and internal medicine specialists welcomes you seven days a week at KN 5 Rd, Kigali. Walk in or book an appointment online.'),
('We now accept all major insurance schemes', 'RSSB, UAP, MMI, RADIANT, BRITAM, PRIME and SANLAM are accepted. You can also pay by cash, card, cheque or mobile money.');

-- Community
CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Community is public" ON public.community_posts FOR SELECT USING (true);
CREATE POLICY "Members post" ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors or admins delete" ON public.community_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
