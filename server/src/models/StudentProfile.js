import mongoose from "mongoose";
const { Schema } = mongoose;

const profileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    rollNo: { type: String, trim: true },
    department: { type: String, trim: true },
    // degree programme such as "B.Tech" or "MCA" (chosen from the programmes the placement officer added for the student's department)
    program: { type: String, trim: true, maxlength: 80 },
    batch: { type: String, trim: true },
    cgpa: { type: Number, min: 0, max: 10 },
    backlogs: { type: Number, min: 0, default: 0 },
    phone: { type: String, trim: true },
    // NEW: shown under your name on the resume (e.g. "UI/UX Designer") and next to your contact details
    headline: { type: String, trim: true, maxlength: 120 },
    location: { type: String, trim: true, maxlength: 120 },
    links: { github: String, linkedin: String, portfolio: String },
    education: [{ degree: String, institution: String, year: String, score: String }],
    // NEW: work experience, internships and leadership roles.
    // `description` holds one point per line; the resume builder turns each line into a bullet.
    experience: [
      {
        role: { type: String, required: true, trim: true },
        company: { type: String, required: true, trim: true },
        location: { type: String, trim: true },
        start: { type: String, trim: true },
        end: { type: String, trim: true },
        description: String,
      },
    ],
    skills: [
      {
        name: { type: String, required: true, trim: true },
        level: { type: String, enum: ["Beginner", "Intermediate", "Advanced"], default: "Intermediate" },
      },
    ],
    certifications: [{ title: { type: String, required: true }, issuer: String, date: String, url: String }],
    projects: [
      {
        title: { type: String, required: true },
        description: String,
        techStack: [String],
        link: String,
      },
    ],
    // NEW: spoken languages
    languages: [
      {
        name: { type: String, required: true, trim: true },
        proficiency: { type: String, trim: true },
      },
    ],
    targetRole: { type: String, trim: true },
    interests: [String],
    // Only the numeric score is kept. The resume file / text is never stored.
    latestAtsScore: { score: Number, at: Date },
    readiness: { score: { type: Number, default: 0 }, updatedAt: Date },
  },
  { timestamps: true }
);

export default mongoose.model("StudentProfile", profileSchema);