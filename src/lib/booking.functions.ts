import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const bookingSchema = z.object({
  patient_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
  email: z.string().trim().email().max(160).or(z.literal("")),
  insurance: z.string().trim().min(1).max(80),
  insurance_card: z.string().trim().max(80),
  doctor: z.string().trim().min(2).max(160),
  requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requested_time: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().max(500),
});

function esc(value: string) {
  return value.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

/**
 * Single booking action: validates the request, creates the appointment and
 * emails the clinic's chosen notification address. A failed email never
 * cancels a saved appointment.
 */
export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bookingSchema.parse(data))
  .handler(async ({ data }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(`${data.requested_date}T00:00:00`) < today) {
      throw new Error("Please choose today or a future date");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: code, error } = await supabaseAdmin.rpc("book_appointment", {
      _patient_name: data.patient_name,
      _phone: data.phone,
      _insurance: data.insurance,
      _insurance_card: data.insurance_card,
      _doctor: data.doctor,
      _requested_date: data.requested_date,
      _requested_time: data.requested_time,
      _reason: data.reason,
      _email: data.email,
    });

    if (error || !code) {
      throw new Error(error?.message ?? "Could not save the appointment");
    }

    const appointmentCode = code as string;
    let notified = false;
    let notifyError: string | undefined;

    try {
      const { sendEmail } = await import("@/lib/email.server");
      const { data: settings } = await supabaseAdmin
        .from("clinic_settings")
        .select("notification_email")
        .limit(1)
        .maybeSingle();

      const to = (settings?.notification_email ?? "").trim();
      if (!to) {
        notifyError = "No notification email is set in the admin panel";
      } else {
        const rows: Array<[string, string]> = [
          ["Appointment code", appointmentCode],
          ["Patient", data.patient_name],
          ["Phone", data.phone],
          ["Email", data.email || "—"],
          ["Doctor", data.doctor],
          ["Date", data.requested_date],
          ["Time", data.requested_time],
          ["Insurance", data.insurance],
          ["Insurance card", data.insurance_card || "—"],
          ["Reason", data.reason || "—"],
        ];
        const html =
          `<h2>New appointment request — ${esc(appointmentCode)}</h2><table cellpadding="6">` +
          rows
            .map(([k, v]) => `<tr><td><strong>${esc(k)}</strong></td><td>${esc(v)}</td></tr>`)
            .join("") +
          `</table><p>Open the admin panel to confirm this appointment.</p>`;
        const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");

        const res = await sendEmail({
          to,
          subject: `New appointment ${appointmentCode} — ${data.patient_name}`,
          html,
          text,
          idempotencyKey: `appointment-${appointmentCode}`,
        });
        notified = res.sent;
        if (!res.sent && res.error) notifyError = res.error;

        if (res.sent && data.email) {
          await sendEmail({
            to: data.email,
            subject: `Your appointment code ${appointmentCode} — Bella Vitae Medical Clinic`,
            html:
              `<h2>Thank you, ${esc(data.patient_name)}</h2>` +
              `<p>Your appointment code is <strong>${esc(appointmentCode)}</strong>.</p>` +
              `<p>${esc(data.requested_date)} at ${esc(data.requested_time)} with ${esc(data.doctor)}.</p>` +
              `<p>Please present this code at the reception.</p>`,
            text: `Your appointment code is ${appointmentCode} — ${data.requested_date} at ${data.requested_time} with ${data.doctor}.`,
            idempotencyKey: `appointment-patient-${appointmentCode}`,
          }).catch(() => undefined);
        }
      }
    } catch (err) {
      notifyError = err instanceof Error ? err.message : "Could not send the notification email";
    }

    return { code: appointmentCode, notified, ...(notifyError ? { notifyError } : {}) };
  });
