import crypto from "node:crypto";
import EmailOtp from "../models/EmailOtp.js";
import { HttpError } from "../middleware/error.js";

/**
 * Email one-time codes (used when registering).
 *   OTP_EXPIRY_MINUTES   how long a code works (default 10)
 */
export const OTP_MINUTES = Math.max(1, Number(process.env.OTP_EXPIRY_MINUTES) || 10);
export const RESEND_SECONDS = 60; // wait this long before asking for another code
const MAX_ATTEMPTS = 5; // wrong guesses allowed per code
const MAX_SENDS_PER_HOUR = 6; // codes per email address per hour
const HOUR = 60 * 60 * 1000;

const secret = () => process.env.JWT_SECRET || "";
const hashCode = (email, code) => crypto.createHash("sha256").update(`${email}:${code}:${secret()}`).digest("hex");
const safeEqual = (a, b) => {
  const x = Buffer.from(a, "hex"), y = Buffer.from(b, "hex");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/**
 * Create (or replace) a code for this email. Returns the plain code so the caller can email it.
 * Throws 429 if the person asks too quickly or too often.
 */
export async function issueOtp(rawEmail, purpose = "register") {
  const email = rawEmail.toLowerCase().trim();
  const now = Date.now();
  const existing = await EmailOtp.findOne({ email, purpose });

  let windowStart = new Date(now), windowCount = 1;
  if (existing) {
    const wait = RESEND_SECONDS * 1000 - (now - existing.lastSentAt.getTime());
    if (wait > 0) throw Object.assign(new HttpError(429, `Please wait ${Math.ceil(wait / 1000)} seconds before asking for a new code.`), { retryAfter: Math.ceil(wait / 1000) });
    if (now - existing.windowStart.getTime() < HOUR) {
      if (existing.windowCount >= MAX_SENDS_PER_HOUR) throw new HttpError(429, "Too many codes requested for this email. Try again in an hour.");
      windowStart = existing.windowStart;
      windowCount = existing.windowCount + 1;
    }
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await EmailOtp.findOneAndUpdate(
    { email, purpose },
    { codeHash: hashCode(email, code), attempts: 0, lastSentAt: new Date(now), windowStart, windowCount, expiresAt: new Date(now + OTP_MINUTES * 60 * 1000) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { code, minutes: OTP_MINUTES, resendIn: RESEND_SECONDS };
}

/** Forget a code (used when the email could not be delivered, so the person can retry straight away). */
export const discardOtp = (email, purpose = "register") => EmailOtp.deleteOne({ email: email.toLowerCase().trim(), purpose });

/** Check a code. Succeeds once: a correct code is deleted so it cannot be used again. */
export async function verifyOtp(rawEmail, code, purpose = "register") {
  const email = rawEmail.toLowerCase().trim();
  // count the guess first (atomically), so parallel requests cannot get extra tries
  const row = await EmailOtp.findOneAndUpdate(
    { email, purpose, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { new: true }
  );
  if (!row) {
    const stale = await EmailOtp.findOne({ email, purpose }).lean();
    if (stale && stale.expiresAt > new Date()) throw new HttpError(429, "Too many wrong attempts. Request a new code.");
    throw new HttpError(400, "This code has expired or was never requested. Request a new code.");
  }
  if (!safeEqual(row.codeHash, hashCode(email, String(code)))) {
    const left = MAX_ATTEMPTS - row.attempts;
    throw new HttpError(400, left > 0 ? `Incorrect code. ${left} ${left === 1 ? "try" : "tries"} left.` : "Incorrect code. Request a new one.");
  }
  await EmailOtp.deleteOne({ _id: row._id });
  return true;
}
