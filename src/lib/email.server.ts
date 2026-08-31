const SENDER_DOMAIN = process.env["LOVABLE_EMAIL_DOMAIN"] ?? "";
const FROM_NAME = "Bella Vitae Medical Clinic";

export function emailConfigured() {
  return Boolean(SENDER_DOMAIN && process.env["LOVABLE_API_KEY"]);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey || !SENDER_DOMAIN) {
    return { sent: false, error: "Email sending is not configured yet" };
  }
  try {
    const { sendLovableEmail } = await import("@lovable.dev/email-js");
    const emailOptions: { apiKey: string; idempotencyKey?: string } = { apiKey };
    if (opts.idempotencyKey) emailOptions.idempotencyKey = opts.idempotencyKey;
    const res = await sendLovableEmail(
      {
        to: opts.to,
        from: `${FROM_NAME} <no-reply@${SENDER_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        purpose: "transactional",
      },
      emailOptions,
    );
    return { sent: Boolean(res.success) };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "Could not send the email" };
  }
}
