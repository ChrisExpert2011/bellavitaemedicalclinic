import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public: look up an appointment by code. Returns only non-private fields. */
export const getAppointmentStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ code: z.string().trim().min(4).max(20) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("get_appointment_status" as never, {
      _code: data.code,
    } as never);
    if (error) throw new Error("Could not check this code right now");
    const row = (rows as unknown as Array<{
      code: string;
      status: string;
      doctor: string;
      requested_date: string;
      requested_time: string;
    }> | null)?.[0];
    return row ?? null;
  });

/** Admin: send a test email to the configured notification address. */
export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin");
    if (!roles?.length) throw new Error("Only administrators can send test emails");
    const { data: settings } = await context.supabase
      .from("clinic_settings")
      .select("notification_email")
      .limit(1)
      .maybeSingle();
    const to = (settings?.notification_email ?? "").trim();
    if (!to) return { sent: false, error: "No notification email saved yet" };
    const { sendEmail, emailConfigured } = await import("@/lib/email.server");
    if (!emailConfigured()) {
      return { sent: false, error: "Email sending is not active yet — the clinic sending domain must be set up first" };
    }
    return sendEmail({
      to,
      subject: "Test — Bella Vitae appointment notifications",
      html: "<p>This is a test. New appointment details will arrive at this address automatically.</p>",
      text: "This is a test. New appointment details will arrive at this address automatically.",
    });
  });
