import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CalendarCheck,
  CalendarClock,
  Clock,
  IdCard,
  Phone,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { requestPhoneOtp } from "@/lib/otp.functions";
import { TIME_SLOTS } from "@/lib/clinic";

export const Route = createFileRoute("/my-appointments")({
  head: () => ({
    meta: [
      { title: "My appointments | Bella Vitae Medical Clinic" },
      {
        name: "description",
        content:
          "Verify your phone number to view full details of your Bella Vitae appointments, reschedule an upcoming visit or cancel it with a reason.",
      },
      { property: "og:title", content: "My appointments | Bella Vitae Medical Clinic" },
      {
        property: "og:description",
        content: "Secure phone verification to view, reschedule or cancel your clinic bookings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyAppointmentsPage,
});

type PatientAppointment = {
  code: string | null;
  patient_name: string;
  phone: string;
  doctor: string;
  insurance: string;
  insurance_card: string | null;
  requested_date: string;
  requested_time: string;
  reason: string | null;
  status: string;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  rescheduled_at: string | null;
  previous_date: string | null;
  previous_time: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-accent/20 text-accent-foreground border-accent/40",
  confirmed: "bg-primary/10 text-primary border-primary/30",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting confirmation",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatStamp(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function isUpcoming(a: PatientAppointment) {
  const today = new Date().toISOString().slice(0, 10);
  return a.requested_date >= today && a.status !== "cancelled" && a.status !== "completed";
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function AppointmentCard({
  appt,
  onCancel,
  onReschedule,
  busyCode,
}: {
  appt: PatientAppointment;
  onCancel?: (code: string, reason: string) => Promise<void>;
  onReschedule?: (code: string, date: string, time: string) => Promise<void>;
  busyCode?: string | null;
}) {
  const [panel, setPanel] = useState<"none" | "cancel" | "reschedule">("none");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(appt.requested_date);
  const [time, setTime] = useState(appt.requested_time);
  const busy = busyCode === appt.code;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <li className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold tracking-wider text-primary">
            {appt.code ?? "—"}
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">{appt.patient_name}</p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            STATUS_STYLES[appt.status] ?? "border-border bg-muted text-muted-foreground"
          }`}
        >
          {STATUS_LABEL[appt.status] ?? appt.status}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Detail icon={Stethoscope} label="Doctor" value={appt.doctor} />
        <Detail icon={CalendarCheck} label="Date" value={formatDate(appt.requested_date)} />
        <Detail icon={Clock} label="Time" value={appt.requested_time} />
        <Detail icon={Phone} label="Phone" value={appt.phone} />
        <Detail
          icon={IdCard}
          label="Insurance"
          value={appt.insurance + (appt.insurance_card ? ` · ${appt.insurance_card}` : "")}
        />
        <Detail icon={CalendarClock} label="Booked on" value={formatStamp(appt.created_at) ?? "—"} />
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Reason for visit: </span>
        {appt.reason?.trim() ? appt.reason : "Not specified"}
      </p>

      {appt.rescheduled_at && appt.previous_date ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Rescheduled on {formatStamp(appt.rescheduled_at)} — previously{" "}
          {formatDate(appt.previous_date)} at {appt.previous_time}.
        </p>
      ) : null}

      {appt.status === "cancelled" ? (
        <p className="mt-2 text-sm text-destructive">
          Cancelled {formatStamp(appt.cancelled_at) ? `on ${formatStamp(appt.cancelled_at)}` : ""}
          {appt.cancellation_reason ? ` — reason: ${appt.cancellation_reason}` : ""}
        </p>
      ) : null}

      {onCancel && onReschedule && appt.code ? (
        <>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setPanel(panel === "reschedule" ? "none" : "reschedule")}
              className="inline-flex items-center gap-2 rounded-md border border-primary/40 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Reschedule
            </button>
            <button
              type="button"
              onClick={() => setPanel(panel === "cancel" ? "none" : "cancel")}
              className="inline-flex items-center gap-2 rounded-md border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <XCircle className="size-4" aria-hidden="true" />
              Cancel
            </button>
          </div>

          {panel === "reschedule" ? (
            <form
              className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-4"
              onSubmit={async (e) => {
                e.preventDefault();
                await onReschedule(appt.code as string, date, time);
                setPanel("none");
              }}
            >
              <p className="text-sm font-medium text-foreground">Choose a new date and time</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="date"
                  min={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  aria-label="New date"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <select
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  aria-label="New time"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Confirm new time"}
              </button>
            </form>
          ) : null}

          {panel === "cancel" ? (
            <form
              className="mt-4 space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
              onSubmit={async (e) => {
                e.preventDefault();
                await onCancel(appt.code as string, reason);
                setPanel("none");
              }}
            >
              <label
                htmlFor={`reason-${appt.code}`}
                className="block text-sm font-medium text-foreground"
              >
                Reason for cancelling <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id={`reason-${appt.code}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="e.g. I am travelling that week"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
              >
                {busy ? "Cancelling…" : "Confirm cancellation"}
              </button>
            </form>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

function MyAppointmentsPage() {
  const sendOtp = useServerFn(requestPhoneOtp);
  const [step, setStep] = useState<"phone" | "code" | "list">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<PatientAppointment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const load = async (t: string) => {
    const { data, error } = await supabase.rpc("get_appointments_by_token", { _token: t });
    if (error) throw error;
    return (data ?? []) as unknown as PatientAppointment[];
  };

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length < 8) {
      toast.error("Please enter the phone number you booked with");
      return;
    }
    setBusy(true);
    try {
      const res = await sendOtp({ data: { phone: phone.trim() } });
      setStep("code");
      if (res.sent) {
        setHint(null);
        toast.success("We sent a 6-digit code to your phone");
      } else {
        setHint(res.devCode);
        toast.info("SMS sending isn't connected yet — your code is shown below");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send a verification code");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("verify_phone_otp", {
        _phone: phone.trim(),
        _code: code.trim(),
      });
      if (error) throw error;
      const t = data?.[0]?.token as string | undefined;
      if (!t) throw new Error("Verification failed");
      setToken(t);
      const list = await load(t);
      setRows(list);
      setStep("list");
      if (list.length === 0) toast.info("No appointments found for this number");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Incorrect code");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (apptCode: string, reason: string) => {
    if (!token) return;
    setBusyCode(apptCode);
    try {
      const { data, error } = await supabase.rpc("cancel_appointment_by_token", {
        _token: token,
        _code: apptCode,
        _reason: reason,
      });
      if (error) throw error;
      if (data === true) {
        toast.success(`Appointment ${apptCode} cancelled`);
        setRows(await load(token));
      } else {
        toast.error("This appointment can no longer be cancelled. Please call the clinic.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel the appointment");
    } finally {
      setBusyCode(null);
    }
  };

  const reschedule = async (apptCode: string, date: string, time: string) => {
    if (!token) return;
    setBusyCode(apptCode);
    try {
      const { data, error } = await supabase.rpc("reschedule_appointment_by_token", {
        _token: token,
        _code: apptCode,
        _date: date,
        _time: time,
      });
      if (error) throw error;
      if (data === true) {
        toast.success(`Appointment ${apptCode} moved to ${date} at ${time}`);
        setRows(await load(token));
      } else {
        toast.error("This appointment can no longer be changed. Please call the clinic.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reschedule the appointment");
    } finally {
      setBusyCode(null);
    }
  };

  const upcoming = (rows ?? []).filter(isUpcoming);
  const past = (rows ?? []).filter((a) => !isUpcoming(a));

  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-3xl px-4 py-12 md:py-16">
        <h1 className="text-3xl font-bold text-primary md:text-4xl">My appointments</h1>
        <p className="mt-3 text-muted-foreground">
          Verify the phone number you booked with, then view every detail of your visits,
          reschedule an upcoming one or cancel it.
        </p>

        {step === "phone" ? (
          <form
            onSubmit={requestCode}
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
              <ShieldCheck className="size-4" aria-hidden="true" />
              {busy ? "Sending…" : "Send verification code"}
            </button>
          </form>
        ) : null}

        {step === "code" ? (
          <form
            onSubmit={verify}
            className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-foreground">
                Enter the 6-digit code sent to {phone}
              </label>
              <input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="mt-2 w-40 rounded-md border border-input bg-background px-3 py-2 text-center font-mono text-lg tracking-[0.4em] outline-none focus:border-primary"
              />
            </div>
            {hint ? (
              <p className="rounded-md bg-accent/15 px-3 py-2 text-sm text-accent-foreground">
                SMS delivery isn't connected yet, so here is your code:{" "}
                <span className="font-mono font-semibold">{hint}</span>
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={busy || code.length < 6}
                className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? "Verifying…" : "Verify and continue"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setHint(null);
                }}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Use another number
              </button>
            </div>
          </form>
        ) : null}

        {step === "list" && rows !== null ? (
          <div className="mt-10 space-y-10">
            <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Phone verified · {phone}
            </p>

            <div>
              <h2 className="text-xl font-semibold text-foreground">Upcoming ({upcoming.length})</h2>
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
                      onReschedule={reschedule}
                      busyCode={busyCode}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Past &amp; cancelled ({past.length})
              </h2>
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
