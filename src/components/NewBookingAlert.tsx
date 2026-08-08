import { useEffect, useRef, useState } from "react";
import { AlertTriangle, BellRing } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Appt = {
  id: string;
  code: string | null;
  patient_name: string;
  phone: string;
  doctor: string;
  insurance: string;
  requested_date: string;
  requested_time: string;
  reason: string | null;
};

/** Loops a phone-style ring tone until stopped. */
function useRinger() {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  const stop = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
  };

  const start = () => {
    if (timerRef.current) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    ctxRef.current = ctx;
    const ring = () => {
      if (!ctxRef.current) return;
      [0, 0.4].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + offset + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.32);
      });
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([300, 150, 300]);
    };
    ring();
    timerRef.current = window.setInterval(ring, 3000);
  };

  useEffect(() => stop, []);
  return { start, stop };
}

/**
 * Locked alert for the doctor: every new booking rings the phone and stays on
 * screen — it cannot be dismissed until the appointment is confirmed or declined.
 */
export function NewBookingAlert({ doctorName }: { doctorName: string }) {
  const [queue, setQueue] = useState<Appt[]>([]);
  const [busy, setBusy] = useState(false);
  const { start, stop } = useRinger();
  const current = queue[0];

  const load = async () => {
    if (!doctorName) return;
    const { data } = await supabase
      .from("appointments")
      .select("id, code, patient_name, phone, doctor, insurance, requested_date, requested_time, reason")
      .ilike("doctor", `%${doctorName}%`)
      .eq("status", "pending")
      .is("acknowledged_at", null)
      .order("created_at", { ascending: true });
    setQueue((data ?? []) as Appt[]);
  };

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("new-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => void load())
      .subscribe();
    const poll = window.setInterval(() => void load(), 20000);
    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorName]);

  useEffect(() => {
    if (current) start();
    else stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;

  const resolve = async (status: "confirmed" | "cancelled") => {
    setBusy(true);
    const { error } = await supabase
      .from("appointments")
      .update({ status, acknowledged_at: new Date().toISOString() })
      .eq("id", current.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    stop();
    setQueue((q) => q.slice(1));
    toast.success(status === "confirmed" ? "Appointment confirmed" : "Appointment declined");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border-2 border-accent bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 animate-pulse items-center justify-center rounded-full bg-accent/20">
            <BellRing className="h-6 w-6 text-accent-foreground" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-primary">New appointment request</h2>
            <p className="text-xs text-muted-foreground">
              {queue.length > 1 ? `${queue.length} requests waiting` : "Waiting for your answer"}
            </p>
          </div>
        </div>

        <dl className="mt-5 space-y-1.5 rounded-xl bg-secondary/60 p-4 text-sm">
          <Row label="Code" value={current.code ?? "—"} />
          <Row label="Patient" value={current.patient_name} />
          <Row label="Phone" value={current.phone} />
          <Row label="Insurance" value={current.insurance} />
          <Row label="When" value={`${current.requested_date} at ${current.requested_time}`} />
          {current.reason ? <Row label="Reason" value={current.reason} /> : null}
        </dl>

        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
          This alert is locked. It keeps ringing and cannot be closed until you confirm or decline
          the appointment.
        </p>

        <div className="mt-5 flex gap-3">
          <button
            disabled={busy}
            onClick={() => resolve("confirmed")}
            className="flex-1 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            Confirm appointment
          </button>
          <button
            disabled={busy}
            onClick={() => resolve("cancelled")}
            className="rounded-md border border-destructive px-4 py-3 text-sm font-semibold text-destructive disabled:opacity-60"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}