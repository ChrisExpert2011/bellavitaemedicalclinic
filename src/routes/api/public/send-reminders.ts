import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/send-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (secret && request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendSms } = await import("@/lib/sms.server");

        const { data: due, error } = await supabaseAdmin.rpc("due_appointment_reminders");
        if (error) {
          console.error("[reminders] lookup failed:", error.message);
          return Response.json({ error: error.message }, { status: 500 });
        }

        let sent = 0;
        let failed = 0;

        for (const row of due ?? []) {
          const when = `${row.requested_date} at ${row.requested_time}`;
          const message =
            `Bella Vitae Medical Clinic reminder: ${row.patient_name}, your appointment ` +
            `(${row.code}) with ${row.doctor} is on ${when}. Reply or call +250788275617 to change it.`;

          const result = await sendSms(row.phone, message);
          if (result.sent) sent++;
          else failed++;

          await supabaseAdmin.from("appointment_reminders").upsert(
            {
              appointment_id: row.appointment_id,
              kind: row.kind,
              phone: row.phone,
              message,
              status: result.sent ? "sent" : "failed",
              error: result.error ?? null,
              sent_at: result.sent ? new Date().toISOString() : null,
            },
            { onConflict: "appointment_id,kind" },
          );
        }

        return Response.json({ due: due?.length ?? 0, sent, failed });
      },
    },
  },
});
