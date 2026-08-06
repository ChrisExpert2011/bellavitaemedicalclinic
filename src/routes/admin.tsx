import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { createWorker } from "@/lib/admin.functions";
import { listWorkers, deleteWorker } from "@/lib/staff.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel | Bella Vitae Medical Clinic" },
      {
        name: "description",
        content: "Manage contacts, staff accounts, appointments and news for Bella Vitae Medical Clinic.",
      },
      { property: "og:title", content: "Admin panel | Bella Vitae Medical Clinic" },
      { property: "og:description", content: "Internal management area for clinic administrators." },
    ],
  }),
  component: AdminPage,
});

const TABS = ["Appointments", "Messages", "Contacts", "Workers", "News", "Team"] as const;
type Tab = (typeof TABS)[number];

function AdminPage() {
  const { loading, isAdmin, isStaff } = useAuth();
  const [tab, setTab] = useState<Tab>("Appointments");

  if (loading) {
    return (
      <SiteLayout>
        <p className="mx-auto max-w-6xl px-4 py-16 text-muted-foreground">Loading…</p>
      </SiteLayout>
    );
  }

  if (!isStaff) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-primary">Restricted area</h1>
          <p className="mt-2 text-muted-foreground">
            This panel is reserved for clinic staff and administrators.
          </p>
          <Link to="/auth" className="mt-4 inline-block text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const visibleTabs = isAdmin ? TABS : (["Appointments", "Messages", "News"] as const);

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold text-primary">{isAdmin ? "Admin panel" : "Staff panel"}</h1>
        <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
          {visibleTabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-t-md px-4 py-2 text-sm font-medium ${
                tab === t ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="py-8">
          {tab === "Appointments" ? <AppointmentsTab /> : null}
          {tab === "Messages" ? <MessagesTab isAdmin={isAdmin} /> : null}
          {tab === "Contacts" && isAdmin ? <ContactsTab /> : null}
          {tab === "Workers" && isAdmin ? <WorkersTab /> : null}
          {tab === "News" ? <NewsTab /> : null}
          {tab === "Team" && isAdmin ? <TeamTab /> : null}
        </div>
      </div>
    </SiteLayout>
  );
}

function AppointmentsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin_appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("requested_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin_appointments"] });
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-secondary/60 text-left">
          <tr>
            {["Code", "Patient", "Phone", "Insurance", "Doctor", "When", "Status", ""].map((h) => (
              <th key={h} className="px-3 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((a) => (
            <tr key={a.id} className="border-t border-border">
              <td className="px-3 py-2 font-mono">{a.code}</td>
              <td className="px-3 py-2">{a.patient_name}</td>
              <td className="px-3 py-2">{a.phone}</td>
              <td className="px-3 py-2">{a.insurance}{a.insurance_card ? ` · ${a.insurance_card}` : ""}</td>
              <td className="px-3 py-2">{a.doctor}</td>
              <td className="px-3 py-2">{a.requested_date} {a.requested_time}</td>
              <td className="px-3 py-2">{a.status}</td>
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
      {(data ?? []).length === 0 ? (
        <p className="p-4 text-muted-foreground">No appointments yet.</p>
      ) : null}
    </div>
  );
}

function ContactsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["clinic_contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clinic_contacts").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const save = async (id: string, values: { label: string; phone: string; email: string }) => {
    const { error } = await supabase.from("clinic_contacts").update(values).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Contact updated");
    qc.invalidateQueries({ queryKey: ["clinic_contacts"] });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(data ?? []).map((c) => (
        <ContactCard key={c.id} contact={c} onSave={save} />
      ))}
    </div>
  );
}

function ContactCard({
  contact,
  onSave,
}: {
  contact: { id: string; label: string; phone: string; email: string };
  onSave: (id: string, v: { label: string; phone: string; email: string }) => void;
}) {
  const [label, setLabel] = useState(contact.label);
  const [phone, setPhone] = useState(contact.phone);
  const [email, setEmail] = useState(contact.email);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <Field label="Label" value={label} onChange={setLabel} />
      <Field label="Phone" value={phone} onChange={setPhone} />
      <Field label="Email" value={email} onChange={setEmail} type="email" />
      <button
        onClick={() => onSave(contact.id, { label, phone, email })}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        Save
      </button>
    </div>
  );
}

function WorkersTab() {
  const register = useServerFn(createWorker);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    specialty: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register({ data: { ...form, addToTeam: true } });
      toast.success(`Worker account created for ${form.email}`);
      setForm({ fullName: "", email: "", password: "", phone: "", specialty: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the worker");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-semibold">Register a worker</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Create login credentials for a staff member. They can change their name, phone and password
        themselves from “My account”.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4">
        <Field label="Full name" value={form.fullName} onChange={(v) => set("fullName", v)} required />
        <Field label="Specialty / job title" value={form.specialty} onChange={(v) => set("specialty", v)} required />
        <Field label="Work email" type="email" value={form.email} onChange={(v) => set("email", v)} required />
        <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
        <Field
          label="Temporary password (min. 8 characters)"
          type="password"
          value={form.password}
          onChange={(v) => set("password", v)}
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create worker account"}
        </button>
      </form>
    </div>
  );
}

function NewsTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const { data } = useQuery({
    queryKey: ["admin_posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const publish = async () => {
    if (title.trim().length < 3 || body.trim().length < 5) {
      toast.error("Add a title and a message");
      return;
    }
    const { error } = await supabase.from("posts").insert({
      title: title.trim(),
      body: body.trim(),
      image_url: imageUrl.trim() || null,
      author_id: user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle("");
    setBody("");
    setImageUrl("");
    toast.success("Published");
    qc.invalidateQueries({ queryKey: ["admin_posts"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin_posts"] });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">New post</h2>
        <Field label="Title" value={title} onChange={setTitle} />
        <Field label="Image URL (optional)" value={imageUrl} onChange={setImageUrl} />
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <button
          onClick={publish}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Publish
        </button>
      </div>
      <div className="space-y-3">
        {(data ?? []).map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold">{p.title}</h3>
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{p.body}</p>
            <button onClick={() => remove(p.id)} className="mt-2 text-xs text-destructive hover:underline">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamTab() {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [phones, setPhones] = useState("");

  const { data } = useQuery({
    queryKey: ["staff_members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_members").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    if (fullName.trim().length < 2 || specialty.trim().length < 2) {
      toast.error("Name and specialty are required");
      return;
    }
    const { error } = await supabase.from("staff_members").insert({
      full_name: fullName.trim(),
      specialty: specialty.trim(),
      phones: phones.trim() || null,
      sort_order: (data?.length ?? 0) + 1,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setFullName("");
    setSpecialty("");
    setPhones("");
    qc.invalidateQueries({ queryKey: ["staff_members"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("staff_members").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["staff_members"] });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Add a team member</h2>
        <Field label="Full name" value={fullName} onChange={setFullName} />
        <Field label="Specialty" value={specialty} onChange={setSpecialty} />
        <Field label="Phone(s)" value={phones} onChange={setPhones} />
        <button onClick={add} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Add
        </button>
      </div>
      <div className="space-y-3">
        {(data ?? []).map((m) => (
          <div key={m.id} className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold">{m.full_name}</p>
            <p className="text-sm text-muted-foreground">{m.specialty}</p>
            {m.phones ? <p className="text-sm text-muted-foreground">{m.phones}</p> : null}
            <button onClick={() => remove(m.id)} className="mt-2 text-xs text-destructive hover:underline">
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}