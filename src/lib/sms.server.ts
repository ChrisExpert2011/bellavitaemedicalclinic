export type SmsResult = { sent: boolean; provider: string; error?: string };

/**
 * Sends an SMS. No provider is configured yet — set TWILIO_ACCOUNT_SID,
 * TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER (or swap in another provider here)
 * and messages start going out with no other code change.
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  const from = process.env["TWILIO_FROM_NUMBER"];

  if (!sid || !token || !from) {
    console.warn("[sms] provider not configured, message not sent:", to);
    return { sent: false, provider: "none", error: "SMS provider not configured" };
  }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[sms] send failed [${res.status}]: ${text}`);
    return { sent: false, provider: "twilio", error: `[${res.status}] ${text}` };
  }
  return { sent: true, provider: "twilio" };
}

export function smsConfigured() {
  return Boolean(
    process.env["TWILIO_ACCOUNT_SID"] &&
      process.env["TWILIO_AUTH_TOKEN"] &&
      process.env["TWILIO_FROM_NUMBER"],
  );
}
