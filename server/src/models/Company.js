import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    industry: String,
    website: String,
    headquarters: String, // NEW: shown on the company page
    description: String,
    // NEW: small logo stored as a data URL. The client shrinks it to <= 256px before upload.
    logo: String,
    roles: [String],
    packageRange: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Company", companySchema);
