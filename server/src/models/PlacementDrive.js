import mongoose from "mongoose";
const { Schema } = mongoose;

const driveSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    title: { type: String, required: true },
    role: { type: String, required: true },
    description: String,
    location: String,
    package: String,
    // NEW: what kind of opening it is (used by the job type filter)
    jobType: { type: String, enum: ["full_time", "internship", "internship_ppo"], default: "full_time" },
    date: Date,
    deadline: Date,
    deadlineReminderSent: { type: Boolean, default: false }, // set once the 24-hour reminder has gone out
    eligibility: {
      minCgpa: { type: Number, default: 0 },
      maxBacklogs: { type: Number, default: 0 },
      departments: [String], // empty = all departments
      batches: [String], // NEW: empty = all batches (graduation years)
    },
    rounds: [String],
    status: { type: String, enum: ["upcoming", "ongoing", "completed"], default: "upcoming" },
    registeredStudents: [
      {
        student: { type: Schema.Types.ObjectId, ref: "User" },
        status: {
          type: String,
          enum: ["registered", "shortlisted", "selected", "rejected"],
          default: "registered",
        },
        registeredAt: { type: Date, default: Date.now },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("PlacementDrive", driveSchema);
