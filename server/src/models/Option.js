import mongoose from "mongoose";

/**
 * Choices for the drop-downs students fill in (department, batch, programme).
 * Placement officers manage these on the "Manage lists" page; students can only pick from them.
 */
export const OPTION_TYPES = {
  department: { label: "Department", plural: "departments", field: "department", driveField: "eligibility.departments" },
  batch: { label: "Batch", plural: "batches", field: "batch", driveField: "eligibility.batches" },
  program: { label: "Programme", plural: "programs", field: "program", driveField: null },
};

const optionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: Object.keys(OPTION_TYPES), required: true },
    value: { type: String, required: true, trim: true, maxlength: 80 },
    key: { type: String, required: true }, // lower-case copy of value, so "cse" and "CSE" count as the same
    // Programmes belong to a department ("B.Tech" under Computer Science). "" means open to every department.
    // Always "" for the other lists.
    department: { type: String, default: "", trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// the same programme name can exist in different departments
optionSchema.index({ type: 1, department: 1, key: 1 }, { unique: true });

export const keyOf = (v) => String(v).trim().replace(/\s+/g, " ").toLowerCase();

export default mongoose.model("Option", optionSchema);
