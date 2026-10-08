import { Router } from "express";
import { z } from "zod";
import Company from "../models/Company.js";
import PlacementDrive from "../models/PlacementDrive.js";
import { protect, authorize } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";

const router = Router();
router.use(protect, authorize("officer"));

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  industry: z.string().trim().max(80).optional(),
  website: z.string().trim().max(200).optional(),
  headquarters: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  // only small raster images; the client downsizes before sending
  logo: z.string().max(300_000).regex(/^(data:image\/(png|jpeg|webp);base64,|$)/, "Logo must be a PNG, JPEG or WebP image").optional(),
  // optional on purpose: the new forms don't send these, and an update must not wipe existing values
  roles: z.array(z.string().trim()).optional(),
  packageRange: z.string().trim().max(60).optional(),
});

// "Open" = a drive that is not completed
const isOpen = { status: { $ne: "completed" } };

router.get("/", asyncHandler(async (req, res) => {
  const [companies, open] = await Promise.all([
    Company.find().sort("createdAt").lean(),
    PlacementDrive.aggregate([{ $match: isOpen }, { $group: { _id: "$company", n: { $sum: 1 } } }]),
  ]);
  const openBy = new Map(open.map((o) => [String(o._id), o.n]));
  res.json(companies.map((c) => ({ ...c, openDrives: openBy.get(String(c._id)) || 0 })));
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id).lean();
  if (!company) throw new HttpError(404, "Company not found");
  const drives = await PlacementDrive.find({ company: company._id }).sort("-date")
    .select("title role date status eligibility").lean();
  res.json({ ...company, drives });
}));

router.post("/", validate(schema), asyncHandler(async (req, res) =>
  res.status(201).json(await Company.create({ ...req.body, createdBy: req.user._id }))));

router.put("/:id", validate(schema), asyncHandler(async (req, res) => {
  const c = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!c) throw new HttpError(404, "Company not found");
  res.json(c);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  if (await PlacementDrive.exists({ company: req.params.id })) {
    throw new HttpError(409, "This company has placement drives. Delete those first.");
  }
  await Company.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

export default router;
