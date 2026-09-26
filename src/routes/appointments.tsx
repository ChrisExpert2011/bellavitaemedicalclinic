import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInsurances } from "@/hooks/useInsurances";
import { notifyDoctorOfBooking } from "@/lib/notify.functions";
import { createBooking } from "@/lib/booking.functions";
import { INSURANCES, TIME_SLOTS } from "@/lib/clinic";

export const Route = createFileRoute("/appointments")({
  head: () => ({
    meta: [
      { title: "Book an appointment | Bella Vitae Medical Clinic" },
      {
        name: "description",
        content:
          "Book an online appointment at Bella Vitae Medical Clinic in Kigali. Choose your doctor, date and time and receive a unique appointment code.",
      },
      { property: "og:title", content: "Book an appointment | Bella Vitae Medical Clinic" },
      {
        property: "og:description",
        content: "Pick your doctor, date and hour and get an instant appointment code.",
      },
    ],
  }),
  component: AppointmentsPage,
});

function AppointmentsPage() {
  const { user } = useAuth();
  const { names: insuranceNames } = useInsurances();
  const notifyDoctor = useServerFn(notifyDoctorOfBooking);
  const book = useServerFn(createBooking);
  const todayISO = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    patient_name: "",
    phone: "",
    email: "",
    insurance: INSURANCES[0] as string,
    insurance_card: "",
    doctor: "",
    requested_date: "",
    requested_time: TIME_SLOTS[0] ?? "07:00",
    reason: "",
  });
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookup, setLookup] = useState("");
  const [found, setFound] = useState<Record<string, unknown> | null>(null);

  const { data: doctors } = useQuery({
    queryKey: ["staff_members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_members").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.patient_name.trim().length < 2) {
      toast.error("Please enter the patient name");
      return;
    }
    if (form.phone.trim().length < 8) {
      toast.error("Please enter a valid phone number");
      return;
    }
    if (!form.doctor) {
      toast.error("Please choose a doctor");
      return;
    }
    if (!form.requested_date || form.requested_date < todayISO) {
      toast.error("Please choose today or a future date");
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    setBusy(true);
    try {
      const result = await book({
        data: {
          patient_name: form.patient_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          insurance: form.insurance,
          insurance_card: form.insurance_card.trim(),
          doctor: form.doctor,
          requested_date: form.requested_date,
          requested_time: form.requested_time,
          reason: form.reason.trim(),
        },
      });
      setCode(result.code);
      toast.success("Appointment requested!");
      if (!result.notified) {
        toast.warning(
          "Your appointment is saved, but the clinic notification email could not be delivered yet.",
        );
      }
      void notifyDoctor({ data: { code: result.code } }).catch(() => undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not book the appointment");
    } finally {
      setBusy(false);
    }
  };

  const search = async () => {
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("code", lookup.trim().toUpperCase())
      .maybeSingle();
    if (!data) toast.error("No appointment found for this code (sign in to view your bookings)");
    setFound(data as Record<string, unknown> | null);
  };

  return (
    <SiteLayout>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold text-primary">Online appointment booking</h1>
        <p className="mt-2 text-muted-foreground">
          Fill in the patient details, choose the doctor and the hour you want, and you will get a
          unique appointment code.
        </p>

        {code ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 rounded-2xl border-2 border-accent bg-accent/10 p-6 text-center"
          >
            <p className="text-sm uppercase tracking-widest text-muted-foreground">
              Your appointment code
            </p>
            <motion.p
              initial={{ letterSpacing: "0.6em", opacity: 0 }}
              animate={{ letterSpacing: "0.1em", opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.7 }}
              className="mt-2 text-4xl font-bold text-primary"
            >
              {code}
            </motion.p>
            <p className="mt-3 text-sm text-muted-foreground">
              Keep this code. Present it at the reception on{" "}
              <strong>
                {form.requested_date} at {form.requested_time}
              </strong>{" "}
              with <strong>{form.doctor}</strong>.
            </p>
            <button
              onClick={() => setCode(null)}
              className="mt-4 rounded-md border border-border px-4 py-2 text-sm"
            >
              Book another appointment
            </button>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="mt-8 grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:grid-cols-2"
          >
            <Field label="Patient full name" value={form.patient_name} onChange={(v) => set("patient_name", v)} required />
            <Field label="Phone number" value={form.phone} onChange={(v) => set("phone", v)} required />
            <Field
              label="Email (optional — we send your code here)"
              type="email"
              value={form.email}
              onChange={(v) => set("email", v)}
            />
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Insurance</span>
              <select
                value={form.insurance}
                onChange={(e) => set("insurance", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {insuranceNames.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </label>
            <Field
              label="Insurance card number"
              value={form.insurance_card}
              onChange={(v) => set("insurance_card", v)}
            />
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Doctor</span>
              <select
                value={form.doctor}
                onChange={(e) => set("doctor", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Choose a doctor…</option>
                {(doctors ?? []).map((d) => (
                  <option key={d.id} value={`${d.full_name} (${d.specialty})`}>
                    {d.full_name} — {d.specialty}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Hour</span>
              <select
                value={form.requested_time}
                onChange={(e) => set("requested_time", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {TIME_SLOTS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <Field
              label="Date"
              type="date"
              value={form.requested_date}
              onChange={(v) => set("requested_date", v)}
              min={todayISO}
              required
            />
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Reason for the visit (optional)</span>
              <textarea
                value={form.reason}
                maxLength={500}
                onChange={(e) => set("reason", e.target.value)}
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="sm:col-span-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Booking…" : "Get my appointment code"}
            </button>
          </form>
        )}

        <div className="mt-10">
          <AppointmentStatusLookup />
        </div>
      </div>
    </SiteLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  min?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        {...(min ? { min } : {})}
        maxLength={120}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}