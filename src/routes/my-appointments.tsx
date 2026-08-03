import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Clock, Search, XCircle } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/my-appointments")({
  head: () => ({
    meta: [
      { title: "My appointments | Bella Vitae Medical Clinic" },
      {
        name: "description",
        content:
          "Enter your phone number to view your upcoming and past appointments at Bella Vitae Medical Clinic, and cancel a booking you no longer need.",
      },
      { property: "og:title", content: "My appointments | Bella Vitae Medical Clinic" },
      {
        property: "og:description",
        content: "Look up your bookings with your phone number and cancel upcoming visits.",
      },
    ],
  }),
  component: MyAppointmentsPage,
});

type PatientAppointment = {
  code: string | null;
  patient_name: string;
  doctor: string;
  insurance: string;
  requested_date: string;
  requested_time: string;
  reason: string | null;
  status: string;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-accent/15 text-accent-foreground",
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

function formatDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isUpcoming(a: PatientAppointment) {
  const today = new Date().toISOString().slice(0, 10);
  return a.requested_date >= today && a.status !== "cancelled" && a.status !== "completed";
}

function AppointmentCard({
  appt,
  onCancel,
  cancelling,
}: {
  appt: PatientAppointment;
  onCancel?: (code: string) => void;
  cancelling?: boolean;
}) {
  return (
    <li className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold tracking-wider text-primary">
            {appt.code ?? "—"}
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">{appt.patient_name}</p>
          <p className="text-sm text-muted-foreground">{appt.doctor}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            STATUS_STYLES[appt.status] ?? "bg-muted text-muted-foreground"
          }`}
        >
          {appt.status}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-foreground/80">
        <span className="inline-flex items-center gap-2">
          <CalendarCheck className="size-4 text-primary" aria-hidden="true" />
          {formatDate(appt.requested_date)}
        </span>
        <span className="inline-flex items-center gap-2">
          <Clock className="size-4 text-primary" aria-hidden="true" />
          {appt.requested_time}
        </span>
        <span className="text-muted-foreground">Insurance: {appt.insurance}</span>
      </div>

      {appt.reason ? (
        <p className="mt-3 text-sm text-muted-foreground">Reason: {appt.reason}</p>
      ) : null}

      {onCancel && appt.code ? (
        <button
          type="button"
          disabled={cancelling}
          onClick={() => onCancel(appt.code as string)}
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
        >
          <XCircle className="size-4" aria-hidden="true" />
          {cancelling ? "Cancelling…" : "Cancel this appointment"}
        </button>
      ) : null}
    </li>
  );
}

function MyAppointmentsPage() {
  const [phone, setPhone] = useState("");
  const [searchedPhone, setSearchedPhone] = useState<string | null>(null);
  const [rows, setRows] = useState<PatientAppointment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = async (value: string) => {
    const { data, error } = await supabase.rpc("get_appointments_by_phone", { _phone: value });
    if (error) throw error;
    return (data ?? []) as PatientAppointment[];
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = phone.trim();
    if (value.replace(/\D/g, "").length < 8) {
      toast.error("Please enter the phone number you booked with");
      return;
    }
    setBusy(true);
    try {
      const list = await load(value);
      setRows(list);
      setSearchedPhone(value);
      if (list.length === 0) toast.info("No appointments found for this number");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load your appointments");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (code: string) => {
    if (!searchedPhone) return;
    setCancelling(code);
    try {
      const { data, error } = await supabase.rpc("cancel_appointment_by_phone", {
        _code: code,
        _phone: searchedPhone,
      });
      if (error) throw error;
      if (data === true) {
        toast.success(`Appointment ${code} cancelled`);
        setRows(await load(searchedPhone));
      } else {
        toast.error("This appointment can no longer be cancelled. Please call the clinic.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel the appointment");
    } finally {
      setCancelling(null);
    }
  };

  const upcoming = (rows ?? []).filter(isUpcoming);
  const past = (rows ?? []).filter((a) => !isUpcoming(a));

  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-3xl px-4 py-12 md:py-16">
        <h1 className="text-3xl font-bold text-primary md:text-4xl">My appointments</h1>
        <p className="mt-3 text-muted-foreground">
          Enter the phone number you used when booking to see your upcoming visits, cancel one you
          no longer need, and review your past appointments.
        </p>

        <form
          onSubmit={search}
          className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm sm:flex-row"
        >
          <label className="sr-only" htmlFor="patient-phone">
            Phone number
          </label>
          <input
            id="patient-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+250 7XX XXX XXX"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <Search className="size-4" aria-hidden="true" />
            {busy ? "Searching…" : "Find my appointments"}
          </button>
        </form>

        {rows !== null ? (
          <div className="mt-10 space-y-10">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Upcoming ({upcoming.length})
              </h2>
              {upcoming.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No upcoming appointments for this number.
                </p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {upcoming.map((a) => (
                    <AppointmentCard
                      key={a.code ?? a.created_at}
                      appt={a}
                      onCancel={cancel}
                      cancelling={cancelling === a.code}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground">Past & cancelled ({past.length})</h2>
              {past.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nothing here yet.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {past.map((a) => (
                    <AppointmentCard key={a.code ?? a.created_at} appt={a} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </SiteLayout>
  );
}