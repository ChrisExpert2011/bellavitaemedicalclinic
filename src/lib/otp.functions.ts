import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const requestPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        phone: z.string().trim().min(8).max(40),
        email: z.string().trim().email().max(160).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendEmail, emailConfigured } = await import("@/lib/email.server");

    const digits = data.phone.replace(/\D/g, "");

    // Find the e-mail address stored with this patient's bookings.
    let email = data.email ?? null;
    if (!email) {
      const { data: appts } = await supabaseAdmin
        .from("appointments")
        .select("email, phone, created_at")
        .not("email", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      const match = (appts ?? []).find(
        (a: { phone: string | null; email: string | null }) =>
          (a.phone ?? "").replace(/\D/g, "") === digits,
      );
      email = (match?.email as string | null) ?? null;
    }

    const { data: rows, error } = await supabaseAdmin.rpc("request_phone_otp", {
      _phone: data.phone,
    });
    if (error) throw new Error(error.message);

    const code = rows?.[0]?.code as string | undefined;
    if (!code) throw new Error("Could not create a verification code");

    let result: { sent: boolean; error?: string | undefined } = {
      sent: false,
      error: email ? undefined : "No e-mail address is saved with this phone number",
    };

    if (email) {
      result = await sendEmail({
        to: email,
        subject: `Your Bella Vitae verification code: ${code}`,
        text: `Your Bella Vitae Medical Clinic verification code is ${code}. It expires in 10 minutes.`,
        html: `<div style="font-family:Arial,sans-serif;padding:24px">
          <h2 style="color:#0f766e;margin:0 0 12px">Bella Vitae Medical Clinic</h2>
          <p>Use this code to view or manage your appointments:</p>
          <p style="font-size:30px;letter-spacing:6px;font-weight:bold;color:#0f766e">${code}</p>
          <p style="color:#666">The code expires in 10 minutes.</p>
        </div>`,
      });
    }

    return {
      sent: result.sent,
      emailConfigured: emailConfigured(),
      maskedEmail: email ? email.replace(/^(.).*(@.*)$/, "$1•••$2") : null,
      error: result.sent ? null : (result.error ?? null),
      // Only returned while e-mail delivery is unavailable, so the flow stays usable.
      devCode: result.sent ? null : code,
    };
  });
