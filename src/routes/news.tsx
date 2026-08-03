import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "News & health tips | Bella Vitae Medical Clinic" },
      {
        name: "description",
        content:
          "Latest news, announcements and health advice from Bella Vitae Medical Clinic in Kigali.",
      },
      { property: "og:title", content: "News | Bella Vitae Medical Clinic" },
      { property: "og:description", content: "Announcements and health advice from our clinic." },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const { data: posts, isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <SiteLayout>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold text-primary">News & announcements</h1>
        {isLoading ? <p className="mt-6 text-muted-foreground">Loading…</p> : null}
        <div className="mt-8 space-y-6">
          {(posts ?? []).map((p) => (
            <article key={p.id} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.title}
                  loading="lazy"
                  className="mb-4 h-56 w-full rounded-xl object-cover"
                />
              ) : null}
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {new Date(p.created_at).toLocaleDateString()}
              </p>
              <h2 className="mt-1 text-xl font-semibold">{p.title}</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{p.body}</p>
            </article>
          ))}
          {!isLoading && (posts ?? []).length === 0 ? (
            <p className="text-muted-foreground">No news published yet.</p>
          ) : null}
        </div>
      </div>
    </SiteLayout>
  );
}