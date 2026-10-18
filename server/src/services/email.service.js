/**
 * Email delivery through Brevo's HTTP API (no extra npm package needed).
 * HTTP is used instead of SMTP because Render's free tier blocks outgoing SMTP ports (25, 465, 587).
 * If the variables are not set, emails are only logged, so the rest of the app keeps working.
 *
 *   BREVO_API_KEY      (Brevo > SMTP & API > API Keys)
 *   EMAIL_FROM         (a sender you verified in Brevo, e.g. placement@yourcollege.edu)
 *   EMAIL_FROM_NAME    (optional, default "CareerPilot")
 */
const env = () => process.env;

export const emailConfigured = () => !!(env().BREVO_API_KEY && env().EMAIL_FROM);

const mask = (e) => e.replace(/^(.).*(@.*)$/, "$1***$2");
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Full link back into the app, built from the first CLIENT_URL. */
export const appUrl = (path = "/") => {
  const base = (env().CLIENT_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

export function renderEmail({ title, message, link, cta = "Open CareerPilot", footer = "You can switch off email alerts on the Notifications page." }) {
  const url = link ? appUrl(link) : null;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#10281c">
<div style="max-width:520px;margin:0 auto;padding:24px">
  <div style="background:#fff;border:1px solid #e1e8e4;border-radius:14px;padding:24px">
    <p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#15803d;letter-spacing:.5px">CAREERPILOT</p>
    <h2 style="margin:0 0 12px;font-size:18px">${esc(title)}</h2>
    ${message ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#44564c">${esc(message)}</p>` : ""}
    ${url ? `<a href="${esc(url)}" style="display:inline-block;background:#22c55e;color:#06210f;text-decoration:none;font-weight:bold;font-size:14px;padding:10px 18px;border-radius:10px">${esc(cta)}</a>` : ""}
  </div>
  <p style="font-size:11px;color:#7a8a81;text-align:center;margin-top:14px">${esc(footer)}</p>
</div></body></html>`;
  const text = [title, message, url].filter(Boolean).join("\n\n");
  return { html, text };
}

export async function sendEmail(to, { title, message, link, cta, footer }) {
  if (!emailConfigured()) {
    console.log(`[email not configured] would send to ${mask(to)}: ${title}`);
    return { sent: false };
  }
  const { html, text } = renderEmail({ title, message, link, cta, footer });
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env().BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: env().EMAIL_FROM, name: env().EMAIL_FROM_NAME || "CareerPilot" },
      to: [{ email: to }],
      subject: title,
      htmlContent: html,
      textContent: text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`Brevo rejected the email for ${mask(to)} (HTTP ${res.status}) ${detail}`);
  }
  return { sent: true };
}

const RESET_FOOTER = "If you did not ask for this, you can ignore this email. Your password will not change.";

/** Link is a full path like /reset-password?token=... (built by the auth route). */
export async function sendPasswordResetEmail(to, link, minutes = 30) {
  return sendEmail(to, {
    title: "Reset your CareerPilot password",
    message: `We received a request to reset your password. This link works for ${minutes} minutes and can be used once.`,
    link, cta: "Choose a new password", footer: RESET_FOOTER,
  });
}

export async function sendPasswordChangedEmail(to) {
  return sendEmail(to, {
    title: "Your CareerPilot password was changed",
    message: "Your password was just changed. If this was not you, reset it again right away and contact your placement cell.",
    link: "/forgot-password", cta: "Reset password", footer: "This is a security notice sent to your account email.",
  });
}
