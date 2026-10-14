import mongoose from "mongoose";

const jobRoleSchema = new mongoose.Schema({
  title: { type: String, required: true, unique: true },
  category: String,
  description: String,
  // roles typed in by students are generated once by the AI and then reused, so the same role always gets the same requirements
  source: { type: String, enum: ["seed", "ai"], default: "seed" },
  requiredSkills: [{ name: String, weight: { type: Number, default: 1 } }],
});

export default mongoose.model("JobRole", jobRoleSchema);
