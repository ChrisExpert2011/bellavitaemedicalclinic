import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function ContactForm() {
  const [form, setForm] = useState({
    sender_name: "",
    sender_email: "",
    sender_phone: "",
    subject: "General enquiry",
    message: "",
    to: "",
  });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const { data: team } = useQuery({
    queryKey: ["staff_members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_members").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.sender_name.trim().length < 2) {
      toast.error("Please enter your name");
      return;
    }
    if (form.message.trim().length < 5) {
      toast.error("Please write your message");
      return;
    }
    setBusy(true);
    try {
      const doctor = (team ?? []).find((d) => d.id === form.to);
      const { error } = await supabase.from("contact_messages").insert({
        sender_name: form.sender_name.trim().slice(0, 120),
        sender_email: form.sender_email.trim().slice(0, 255) || null,
        sender_phone: form.sender_phone.trim().slice(0, 40) || null,
        subject: form.subject.trim().slice(0, 160) || "General enquiry",
        message: form.message.trim().slice(0, 2000),
        to_user_id: doctor?.user_id ?? null,
        to_label: doctor ? `${doctor.full_name} — ${doctor.specialty}` : "Reception / administration",
      });
      if (error) throw error;
      setSent(true);
      toast.success("Message sent to the clinic");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your message");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-xl border border-accent bg-accent/10 p-6">
        <h3 className="font-semibold text-primary">Thank you, your message was received</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          It is now in the clinic dashboard and a member of our team will reply to you.
        </p>
        <button
          onClick={() => {
            setSent(false);
            setForm({ sender_name: "", sender_email: "", sender_phone: "", subject: "General enquiry", message: "", to: "" });
          }}
          className="mt-3 rounded-md border border-border px-4 py-2 text-sm"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-border bg-card p-6 shadow-sm sm:grid-cols-2">
      <h3 className="sm:col-span-2 text-lg font-semibold">Send us a message</h3>
      <Input label="Your name" value={form.sender_name} onChange={(v) => set("sender_name", v)} required />
      <Input label="Phone number" value={form.sender_phone} onChange={(v) => set("sender_phone", v)} />
      <Input label="Email (optional)" type="email" value={form.sender_email} onChange={(v) => set("sender_email", v)} />
      <Input label="Subject" value={form.subject} onChange={(v) => set("subject", v)} />
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block font-medium">Send to</span>
        <select
          value={form.to}
          onChange={(e) => set("to", e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Reception / administration</option>
          {(team ?? []).filter((d) => d.user_id).map((d) => (
            <option key={d.id} value={d.id}>
              {d.full_name} — {d.specialty}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block font-medium">Message</span>
        <textarea
          value={form.message}
          maxLength={2000}
          onChange={(e) => set("message", e.target.value)}
          className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="sm:col-span-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}

function Input({
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
        maxLength={255}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
