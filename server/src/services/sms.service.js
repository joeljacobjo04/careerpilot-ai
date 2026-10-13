/**
 * SMS delivery through Twilio's REST API (no extra npm package needed).
 * If the Twilio variables are not set, messages are only logged, so the rest of the app keeps working.
 *
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 *   TWILIO_FROM                    (a Twilio number)   or
 *   TWILIO_MESSAGING_SERVICE_SID   (a messaging service)
 *   DEFAULT_COUNTRY_CODE           (digits only, default 91)
 */
const env = () => process.env;

export const smsConfigured = () =>
  !!(env().TWILIO_ACCOUNT_SID && env().TWILIO_AUTH_TOKEN && (env().TWILIO_FROM || env().TWILIO_MESSAGING_SERVICE_SID));

const mask = (n) => n.replace(/\d(?=\d{3})/g, "*");

/**
 * Turn what a person typed into E.164 (+919876543210), or null if it doesn't look like a phone number.
 * 10 digits  -> uses the default country code.  Starting with + or 00 -> treated as international.
 */
export function normalizePhone(raw, countryCode = env().DEFAULT_COUNTRY_CODE || "91") {
  if (!raw) return null;
  const text = String(raw).trim();
  const digits = text.replace(/\D/g, "");
  const ok = (d) => d.length >= 8 && d.length <= 15;

  if (text.startsWith("+")) return ok(digits) ? `+${digits}` : null;
  if (digits.startsWith("00")) return ok(digits.slice(2)) ? `+${digits.slice(2)}` : null;

  const local = digits.replace(/^0+/, "");
  if (local.length === 10) return `+${countryCode}${local}`;
  if (local.length === countryCode.length + 10 && local.startsWith(countryCode)) return `+${local}`;
  return null;
}

export async function sendSms(to, body) {
  if (!smsConfigured()) {
    console.log(`[sms not configured] would send to ${mask(to)}: ${body}`);
    return { sent: false };
  }
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from, TWILIO_MESSAGING_SERVICE_SID: service } = env();
  const form = new URLSearchParams({ To: to, Body: body });
  if (service) form.set("MessagingServiceSid", service); else form.set("From", from);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Twilio rejected the message for ${mask(to)} (HTTP ${res.status})`);
  return { sent: true };
}
