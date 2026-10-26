import mongoose from "mongoose";

/**
 * One row per (email, purpose). Only a hash of the code is stored, never the code itself.
 * MongoDB removes the row by itself once `expiresAt` has passed (TTL index).
 */
const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: { type: String, default: "register" },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 }, // wrong guesses so far
    lastSentAt: { type: Date, default: Date.now },
    // how many codes were sent in the current hour (stops people using us to spam an inbox)
    windowStart: { type: Date, default: Date.now },
    windowCount: { type: Number, default: 1 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

otpSchema.index({ email: 1, purpose: 1 }, { unique: true });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("EmailOtp", otpSchema);
