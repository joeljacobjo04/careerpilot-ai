import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["student", "officer"], default: "student" },
    // NEW: optional details shown on the placement officer's profile page
    phone: { type: String, trim: true },
    designation: { type: String, trim: true },
    institution: { type: String, trim: true },
    officeLocation: { type: String, trim: true },
    bio: { type: String, trim: true },
    // NEW: SMS alerts are on by default; people can switch them off on the Notifications page
    smsAlerts: { type: Boolean, default: true },
    // Email alerts are on by default too; switch off on the Notifications page
    emailAlerts: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
