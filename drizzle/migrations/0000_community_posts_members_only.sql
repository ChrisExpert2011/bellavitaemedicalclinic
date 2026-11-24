DROP POLICY IF EXISTS "Community is public" ON public.community_posts;
CREATE POLICY "Members read community" ON public.community_posts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.community_posts FROM anon;