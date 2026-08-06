ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name text NOT NULL,
  sender_email text,
  sender_phone text,
  subject text NOT NULL DEFAULT 'General enquiry',
  message text NOT NULL,
  to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_label text,
  status text NOT NULL DEFAULT 'new',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can send a message"
  ON public.contact_messages FOR INSERT TO anon, authenticated
  WITH CHECK (char_length(trim(sender_name)) >= 2 AND char_length(trim(message)) >= 2);

CREATE POLICY "Admins and recipients read messages"
  ON public.contact_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR to_user_id = auth.uid());

CREATE POLICY "Admins and recipients update messages"
  ON public.contact_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR to_user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR to_user_id = auth.uid());

CREATE POLICY "Admins delete messages"
  ON public.contact_messages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER contact_messages_touch
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX contact_messages_to_user_idx ON public.contact_messages (to_user_id, created_at DESC);