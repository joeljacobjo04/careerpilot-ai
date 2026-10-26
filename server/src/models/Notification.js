import mongoose from "mongoose";

export const NOTIFICATION_TYPES = [
  "drive_new", "drive_update", "drive_deadline", "drive_cancelled",
  "application", "status", "student_joined", "system", "announcement",
];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: "system" },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, default: "", maxlength: 500 },
    link: String, // in-app path to open, e.g. /drives
    read: { type: Boolean, default: false },
    // notifications clean themselves up after 90 days
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
  },
  { versionKey: false }
);
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
