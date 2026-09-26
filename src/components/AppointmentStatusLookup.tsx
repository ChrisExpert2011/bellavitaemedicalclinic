import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search } from "lucide-react";
import { getAppointmentStatus } from "@/lib/status.functions";

type Result = { code: string; status: string; doctor: string; requested_date: string; requested_time: string };

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-accent/20 text-accent-foreground",
  confirmed: "bg-primary/15 text-primary",
  completed: "bg-secondary text-secondary-foreground",
  cancelled: "bg-destructive/15 text-destructive",
};

export function AppointmentStatusLookup() {
  const check = useServerFn(getAppointmentStatus);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = code.trim().toUpperCase();
    if (value.length < 4) return setError("Please enter your appointment code");
    setBusy(true);
    setError(null);
    try {
      const r = await check({ data: { code: value } });
      setResult(r);
      if (!r) setError("No appointment found for this code. Please check and try again.");
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Could not check this code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-primary">Check your appointment status</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        No account needed — enter the code you received when booking.
      </p>
      <form onSubmit={submit} className="mt-4 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="BV-XXXXXX"
          aria-label="Appointment code"
          maxLength={20}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm uppercase tracking-widest outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          <Search className="h-4 w-4" /> {busy ? "Checking…" : "Check"}
        </button>
      </form>
      <AnimatePresence mode="wait">
        {result ? (
          <motion.div
            key={result.code}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 grid gap-2 rounded-xl bg-secondary/60 p-4 text-sm sm:grid-cols-2"
          >
            <p className="flex items-center gap-2 sm:col-span-2">
              <strong className="tracking-widest">{result.code}</strong>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[result.status] ?? "bg-muted"}`}>
                {result.status}
              </span>
            </p>
            <p><span className="text-muted-foreground">Doctor:</span> {result.doctor}</p>
            <p><span className="text-muted-foreground">When:</span> {result.requested_date} at {String(result.requested_time).slice(0, 5)}</p>
          </motion.div>
        ) : error ? (
          <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-sm text-destructive">
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
