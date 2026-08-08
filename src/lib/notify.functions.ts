import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Sends an SMS alert to the doctor's phone as soon as a patient books with them.
 * Public on purpose (booking does not require an account); it only ever reads an
 * appointment by its freshly issued code and never returns patient data.
 */
export const notifyDoctorOfBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ code: z.string().min(4).max(20) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendSms } = await import("@/lib/sms.server");

    const { data: appt } = await supabaseAdmin
      .from("appointments")
      .select("code, patient_name, doctor, requested_date, requested_time")
      .eq("code", data.code.trim().toUpperCase())
      .maybeSingle();

    if (!appt) return { notified: false };

    const { data: staff } = await supabaseAdmin
      .from("staff_members")
      .select("full_name, phones");

    const match = (staff ?? []).find(
      (s) => s.full_name && appt.doctor.toLowerCase().includes(s.full_name.toLowerCase()),
    );
    const phone = (match?.phones ?? "").split(/[,/]/)[0]?.replace(/[^0-9+]/g, "") ?? "";
    if (!phone || phone.length < 8) return { notified: false };

    const result = await sendSms(
      phone,
      `Bella Vitae: new appointment ${appt.code} — ${appt.patient_name} on ` +
        `${appt.requested_date} at ${appt.requested_time}. Open your dashboard to confirm.`,
    );
    return { notified: result.sent };
  });