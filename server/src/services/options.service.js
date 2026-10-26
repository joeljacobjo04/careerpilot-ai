import Option, { OPTION_TYPES, keyOf } from "../models/Option.js";
import StudentProfile from "../models/StudentProfile.js";
import { HttpError } from "../middleware/error.js";

const collapse = (v) => String(v).trim().replace(/\s+/g, " ");
const byText = (a, b) => a.localeCompare(b, undefined, { numeric: true });
const sortedUnique = (values) => {
  const seen = new Map();
  for (const v of values) if (v && String(v).trim() && !seen.has(keyOf(v))) seen.set(keyOf(v), collapse(v));
  return [...seen.values()].sort(byText);
};

/**
 * The lists as plain data:
 *   departments, batches (newest first)   arrays of text
 *   programs                every programme name, once each
 *   programsByDepartment    { "Computer Science": ["B.Tech", "M.Tech"] }
 *   generalPrograms         programmes open to every department
 */
export async function listManaged() {
  const rows = await Option.find({ type: { $in: Object.keys(OPTION_TYPES) } }).select("type value department").lean();
  const of = (type) => rows.filter((r) => r.type === type);
  const programRows = of("program");
  const programsByDepartment = {};
  for (const r of programRows) if (r.department) (programsByDepartment[r.department] ||= []).push(r.value);
  for (const d of Object.keys(programsByDepartment)) programsByDepartment[d] = sortedUnique(programsByDepartment[d]);
  return {
    departments: sortedUnique(of("department").map((r) => r.value)),
    batches: sortedUnique(of("batch").map((r) => r.value)).reverse(),
    programs: sortedUnique(programRows.map((r) => r.value)),
    programsByDepartment,
    generalPrograms: sortedUnique(programRows.filter((r) => !r.department).map((r) => r.value)),
  };
}

/** Officer-managed values plus any value already sitting on a student profile (older data), without duplicates. */
export async function listWithLegacy() {
  const [managed, ...distinct] = await Promise.all([
    listManaged(),
    ...Object.values(OPTION_TYPES).map((m) => StudentProfile.distinct(m.field)),
  ]);
  const out = { ...managed };
  Object.entries(OPTION_TYPES).forEach(([type, meta], i) => {
    const values = sortedUnique([...managed[meta.plural], ...distinct[i]]);
    out[meta.plural] = type === "batch" ? values.reverse() : values;
  });
  return out;
}

/** Programmes a student of `department` may pick: that department's own programmes plus the ones open to everyone. */
export const programsFor = (lists, department) =>
  sortedUnique([...(lists.programsByDepartment[department] || []), ...lists.generalPrograms]);

/**
 * Copy values students already have (from before drop-downs existed) into the managed lists.
 * Runs when the server starts. Safe to run again.
 */
export async function syncOptionsFromProfiles() {
  // Programmes belong to a department, so the old unique index (type + name) must go and the new one must exist
  await Option.syncIndexes().catch((e) => console.warn("[options] could not refresh indexes:", e.message));
  await Option.updateMany({ department: { $exists: false } }, { $set: { department: "" } });
  // classes were removed from the app: clear the old class list
  await Option.deleteMany({ type: "section" });

  let added = 0;
  const upsert = async (type, value, department = "") => {
    const res = await Option.updateOne({ type, department, key: keyOf(value) }, { $setOnInsert: { type, value, key: keyOf(value), department } }, { upsert: true });
    if (res.upsertedCount) added += 1;
  };
  for (const [type, meta] of Object.entries(OPTION_TYPES)) {
    for (const raw of (await StudentProfile.distinct(meta.field)).filter((v) => v && String(v).trim())) {
      const text = collapse(raw);
      // a programme the officer already filed under a department is left where it is
      if (type === "program" && (await Option.exists({ type, key: keyOf(text) }))) continue;
      await upsert(type, text);
    }
  }
  return added;
}

/**
 * Make sure `value` is one of the officer's choices and return it in its stored spelling.
 * A student may keep the value they already have (so old profiles can still be saved) and may clear it.
 * (Programmes are checked by resolveProgram, because they depend on the department.)
 */
export async function resolveChoice(type, value, current) {
  const meta = OPTION_TYPES[type];
  const text = value == null ? "" : collapse(value);
  if (!text) return "";
  if (current && keyOf(current) === keyOf(text)) return current;
  const row = await Option.findOne({ type, key: keyOf(text) }).select("value").lean();
  if (!row) throw new HttpError(400, `"${text}" is not an available ${meta.label.toLowerCase()}. Pick one from the list, or ask your placement officer to add it.`);
  return row.value;
}

/** Is `program` a programme of `department` (or one open to every department)? */
export async function programAllowed(program, department) {
  if (!program) return true;
  if (!department) return false;
  return !!(await Option.exists({ type: "program", key: keyOf(program), department: { $in: [department, ""] } }));
}

/**
 * Programme check for a student. It must be a programme of the student's own department (or open to all).
 * `currentProgram` / `currentDepartment` are what the profile has now: an unchanged old value can still be saved.
 */
export async function resolveProgram(value, department, currentProgram, currentDepartment) {
  const text = value == null ? "" : collapse(value);
  if (!text) return "";
  // nothing changed: keep it, so unrelated edits can still be saved
  if (currentProgram && keyOf(currentProgram) === keyOf(text) && keyOf(currentDepartment || "") === keyOf(department || "")) return currentProgram;
  if (!department) throw new HttpError(400, "Choose your department first, then pick your programme.");
  const row = await Option.findOne({ type: "program", key: keyOf(text), department: { $in: [department, ""] } }).select("value").lean();
  if (!row) throw new HttpError(400, `"${text}" is not a programme of ${department}. Pick one from the list, or ask your placement officer to add it.`);
  return row.value;
}
