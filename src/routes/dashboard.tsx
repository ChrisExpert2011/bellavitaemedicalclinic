import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Doctor dashboard | Bella Vitae Medical Clinic" },
      {
        name: "description",
        content:
          "Private dashboard for Bella Vitae doctors and staff: patient messages, appointments and password settings.",
      },
      { property: "og:title", content: "Doctor dashboard | Bella Vitae Medical Clinic" },
      { property: "og:description", content: "Messages and appointments for Bella Vitae clinic staff." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, loading, isStaff } = useAuth();
  const qc = useQueryClient();
  const [profileName, setProfileName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfileName(data?.full_name ?? ""));
  }, [user]);

  const { data: messages } = useQuery({
    enabled: !!user,
    queryKey: ["my_messages", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: appointments } = useQuery({
    enabled: !!profileName,
    queryKey: ["my_doctor_appointments", profileName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .ilike("doctor", `%${profileName}%`)
        .order("requested_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (loading) {
    return (
      <SiteLayout>
        <p className="mx-auto max-w-5xl px-4 py-16 text-muted-foreground">Loading…</p>
      </SiteLayout>
    );
  }

  if (!isStaff) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-primary">Staff area</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in with the credentials given to you by the administrator.
          </p>
          <Link to="/auth" className="mt-4 inline-block text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const markRead = async (id: string) => {
    const { error } = await supabase
      .from("contact_messages")
      .update({ status: "read", read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["my_messages"] });
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["my_doctor_appointments"] });
  };

  const changePassword = async () => {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    toast.success("Password changed");
  };

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold text-primary">My dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {profileName || user?.email} · messages and appointments addressed to you
        </p>

        <section className="mt-8">
          <h2 className="text-xl font-semibold">Messages</h2>
          <div className="mt-3 space-y-3">
            {(messages ?? []).map((m) => (
              <div key={m.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{m.subject}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      m.status === "new" ? "bg-accent/20 text-accent-foreground" : "bg-secondary"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  From {m.sender_name}
                  {m.sender_phone ? ` · ${m.sender_phone}` : ""}
                  {m.sender_email ? ` · ${m.sender_email}` : ""}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{m.message}</p>
                {m.status === "new" ? (
                  <button onClick={() => markRead(m.id)} className="mt-2 text-xs text-primary hover:underline">
                    Mark as read
                  </button>
                ) : null}
              </div>
            ))}
            {(messages ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            ) : null}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">My appointments</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left">
                <tr>
                  {["Code", "Patient", "Phone", "Insurance", "When", "Status"].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(appointments ?? []).map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono">{a.code}</td>
                    <td className="px-3 py-2">{a.patient_name}</td>
                    <td className="px-3 py-2">{a.phone}</td>
                    <td className="px-3 py-2">{a.insurance}</td>
                    <td className="px-3 py-2">{a.requested_date} {a.requested_time}</td>
                    <td className="px-3 py-2">
                      <select
                        value={a.status}
                        onChange={(e) => setStatus(a.id, e.target.value)}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      >
                        {["pending", "confirmed", "completed", "cancelled"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(appointments ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No appointments booked with you yet.</p>
            ) : null}
          </div>
        </section>

        <section className="mt-10 max-w-md space-y-3 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Change my password</h2>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">New password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <button
            onClick={changePassword}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Update password
          </button>
        </section>
      </div>
    </SiteLayout>
  );
}
