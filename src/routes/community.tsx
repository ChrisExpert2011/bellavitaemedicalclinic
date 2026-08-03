import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community | Bella Vitae Medical Clinic" },
      {
        name: "description",
        content:
          "Share questions, experiences and health tips with the Bella Vitae Medical Clinic community in Kigali.",
      },
      { property: "og:title", content: "Community | Bella Vitae Medical Clinic" },
      { property: "og:description", content: "A friendly space for patients and staff to talk." },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");

  const { data: posts } = useQuery({
    queryKey: ["community_posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const post = async () => {
    if (message.trim().length < 3) {
      toast.error("Write a longer message");
      return;
    }
    const { error } = await supabase.from("community_posts").insert({
      author_id: user!.id,
      author_name:
        (user!.user_metadata?.["full_name"] as string) || user!.email || "Member",
      message: message.trim().slice(0, 1000),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessage("");
    qc.invalidateQueries({ queryKey: ["community_posts"] });
    toast.success("Posted to the community");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("community_posts").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["community_posts"] });
  };

  return (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold text-primary">Community</h1>
        <p className="mt-2 text-muted-foreground">
          Ask questions, share experiences and read advice from other patients and our staff.
        </p>

        {user ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-4">
            <textarea
              value={message}
              maxLength={1000}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share something with the community…"
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={post}
              className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Post
            </button>
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-border bg-secondary/50 p-4 text-sm">
            <Link to="/auth" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>{" "}
            to join the conversation.
          </p>
        )}

        <div className="mt-8 space-y-4">
          {(posts ?? []).map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{p.author_name}</p>
                <span className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm">{p.message}</p>
              {isAdmin || p.author_id === user?.id ? (
                <button
                  onClick={() => remove(p.id)}
                  className="mt-2 text-xs text-destructive hover:underline"
                >
                  Delete
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </SiteLayout>
  );
}