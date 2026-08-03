import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const requestPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ phone: z.string().trim().min(8).max(40) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendSms, smsConfigured } = await import("@/lib/sms.server");

    const { data: rows, error } = await supabaseAdmin.rpc("request_phone_otp", {
      _phone: data.phone,
    });
    if (error) throw new Error(error.message);

    const code = rows?.[0]?.code as string | undefined;
    if (!code) throw new Error("Could not create a verification code");

    const result = await sendSms(
      data.phone,
      `Bella Vitae Medical Clinic: your verification code is ${code}. It expires in 10 minutes.`,
    );

    return {
      sent: result.sent,
      smsConfigured: smsConfigured(),
      // Only returned while no SMS provider is connected, so the flow stays usable.
      devCode: result.sent ? null : code,
    };
  });
