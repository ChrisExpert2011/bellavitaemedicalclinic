export type SmsResult = { sent: boolean; provider: string; error?: string };

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

/** Rwandan numbers are often typed as 0788… or 788… — normalise to E.164. */
export function toE164(raw: string): string {
  const digits = (raw || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.startsWith("250")) return `+${digits}`;
  if (digits.startsWith("0")) return `+250${digits.slice(1)}`;
  if (digits.length === 9) return `+250${digits}`;
  return `+${digits}`;
}

function sender() {
  const from = process.env["TWILIO_FROM_NUMBER"] ?? process.env["TWILIO_PHONE_NUMBER"];
  const service = process.env["TWILIO_MESSAGING_SERVICE_SID"];
  if (service) return { MessagingServiceSid: service };
  if (from) return { From: from };
  return null;
}

/**
 * Sends an SMS through the Twilio connector gateway when the Twilio connection
 * is linked, and falls back to direct Twilio API credentials if those are set.
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const destination = toE164(to);
  if (!destination) return { sent: false, provider: "none", error: "Invalid phone number" };

  const fromFields = sender();
  if (!fromFields) {
    console.warn("[sms] no sending number configured, message not sent");
    return { sent: false, provider: "none", error: "No Twilio sending number configured" };
  }

  const params = new URLSearchParams({ To: destination, Body: body, ...fromFields });

  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["TWILIO_API_KEY"];
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];

  let res: Response;
  if (lovableKey && connectionKey) {
    res = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
  } else if (sid && token) {
    res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
  } else {
    console.warn("[sms] provider not configured, message not sent");
    return { sent: false, provider: "none", error: "SMS provider not configured" };
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`[sms] send failed [${res.status}]: ${text}`);
    return { sent: false, provider: "twilio", error: `[${res.status}] ${text}` };
  }
  return { sent: true, provider: "twilio" };
}

export function smsConfigured() {
  const hasSender = Boolean(
    process.env["TWILIO_FROM_NUMBER"] ??
      process.env["TWILIO_PHONE_NUMBER"] ??
      process.env["TWILIO_MESSAGING_SERVICE_SID"],
  );
  const hasAuth = Boolean(
    (process.env["LOVABLE_API_KEY"] && process.env["TWILIO_API_KEY"]) ??
      (process.env["TWILIO_ACCOUNT_SID"] && process.env["TWILIO_AUTH_TOKEN"]),
  );
  return hasSender && hasAuth;
}
