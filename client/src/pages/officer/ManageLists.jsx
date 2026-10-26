import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import api, { errMsg } from "../../api/client";
import useApi from "../../hooks/useApi";
import { Empty, ErrorBox, Input, Select, Spinner } from "../../components/ui";
import { Btn, OfficerHeader, Panel } from "../../components/officerUi";
import { useConfirm, useToast } from "../../components/Feedback";

/** The drop-downs students fill in on My profile, and that drive eligibility and the student filters use. */
const LISTS = [
  { type: "department", title: "Departments", placeholder: "e.g. Computer Science", help: "Shown in the Department drop-down." },
  { type: "program", title: "Programmes", placeholder: "e.g. B.Tech, MCA", help: "The degree programme, such as B.Tech or MBA. Each programme belongs to a department. Students only see the programmes of their own department." },
  { type: "batch", title: "Batches", placeholder: "e.g. 2026, 2027", help: "Graduation year." },
];

// "2026, 2027\n2028" -> ["2026", "2027", "2028"]
const ALL = "__all"; // a programme open to every department
const splitValues = (text) => text.split(/[,\n;]/).map((x) => x.trim()).filter(Boolean);

function ListCard({ meta, data, departments = [], onChanged }) {
  const confirm = useConfirm();
  const toast = useToast();
  const items = data?.items || [];
  const isProgram = meta.type === "program";
  const [dept, setDept] = useState(""); // programmes only: the department the new programmes go under
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");

  // programmes are listed under their department; the other lists are one flat list
  const rows = !isProgram ? items : (() => {
    const out = [];
    const names = [...new Set(items.map((i) => i.department))].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
    for (const d of names) { out.push({ header: d || "Open to all departments" }); out.push(...items.filter((i) => i.department === d)); }
    return out;
  })();

  async function add(e) {
    e.preventDefault();
    const values = splitValues(text);
    if (!values.length || (isProgram && !dept)) return;
    setBusy(true); setErr("");
    try {
      const { data: r } = await api.post("/officer/lists", { type: meta.type, values, ...(isProgram ? { department: dept === ALL ? "" : dept } : {}) });
      setText("");
      toast(r.added.length
        ? `Added ${r.added.length} ${meta.title.toLowerCase()}${r.skipped.length ? ` (${r.skipped.length} already in the list)` : ""}`
        : "Those are already in the list");
      onChanged();
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  }

  async function saveEdit(item) {
    const value = editText.trim();
    if (!value || value === item.value) return setEditId(null);
    try {
      await api.put(`/officer/lists/${item._id}`, { value });
      setEditId(null);
      toast(item.students ? `Renamed. ${item.students} student${item.students === 1 ? "" : "s"} updated.` : "Renamed");
      onChanged();
    } catch (x) { toast(errMsg(x), "error"); }
  }

  async function remove(item) {
    const ok = await confirm({
      title: `Remove "${item.value}"?`,
      message: "Students will no longer be able to pick it. Existing students keep their value only if you rename it instead of removing it.",
      confirmText: "Remove", tone: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/officer/lists/${item._id}`);
      toast("Removed");
      onChanged();
    } catch (x) { toast(errMsg(x), "error"); }
  }

  return (
    <Panel className="flex flex-col !p-0 overflow-hidden">
      <div className="border-b border-line px-5 pb-4 pt-5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="font-bold">{meta.title}</h2>
          <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-dark">{items.length}</span>
        </div>
        <p className="mb-3 text-xs text-ink-soft">{meta.help} Add several at once by separating them with commas.</p>
        <form onSubmit={add} className="space-y-2">
          {isProgram && (
            <Select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department for the new programmes">
              <option value="">Choose a department...</option>
              {departments.map((d) => <option key={d._id} value={d.value}>{d.value}</option>)}
              <option value={ALL}>All departments</option>
            </Select>
          )}
          <div className="flex gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={meta.placeholder} maxLength={400} aria-label={`Add ${meta.title.toLowerCase()}`} />
            <Btn type="submit" disabled={busy || !splitValues(text).length || (isProgram && !dept)} aria-label={`Add to ${meta.title}`}><Plus size={16} aria-hidden="true" /> Add</Btn>
          </div>
        </form>
        {isProgram && !departments.length && <p className="mt-2 text-xs text-ink-soft">Add a department first, or choose "All departments".</p>}
        {err && <div className="mt-2"><ErrorBox>{err}</ErrorBox></div>}
      </div>

      {items.length === 0 ? (
        <div className="p-5"><Empty>Nothing here yet. Students will see an empty drop-down until you add some.</Empty></div>
      ) : (
        <ul className="thin-scroll max-h-80 divide-y divide-line overflow-y-auto">
          {rows.map((i) => i.header ? (
            <li key={`h-${i.header}`} className="sticky top-0 bg-paper px-5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-soft">{i.header}</li>
          ) : (
            <li key={i._id} className="flex items-center justify-between gap-3 px-5 py-2.5 transition hover:bg-mint">
              {editId === i._id ? (
                <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={(e) => { e.preventDefault(); saveEdit(i); }}>
                  <Input autoFocus value={editText} maxLength={80} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setEditId(null)} aria-label={`Rename ${i.value}`} />
                  <button type="submit" aria-label="Save name" title="Save" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ok hover:bg-ok-soft"><Check size={16} aria-hidden="true" /></button>
                  <button type="button" onClick={() => setEditId(null)} aria-label="Cancel" title="Cancel" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-paper"><X size={16} aria-hidden="true" /></button>
                </form>
              ) : (
                <>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{i.value}</p>
                    <p className="text-xs text-ink-soft">{i.students ? `${i.students} student${i.students === 1 ? "" : "s"}` : "Not used yet"}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => { setEditId(i._id); setEditText(i.value); }} aria-label={`Rename ${i.value}`} title="Rename"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-brand-soft hover:text-brand"><Pencil size={15} aria-hidden="true" /></button>
                    <button onClick={() => remove(i)} aria-label={`Remove ${i.value}`} title={i.students ? "In use: rename instead" : "Remove"}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-bad-soft hover:text-bad"><Trash2 size={15} aria-hidden="true" /></button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function ManageLists() {
  const { data, loading, error, reload } = useApi("/officer/lists");
  if (!data) return loading ? <Spinner /> : <ErrorBox>{error}</ErrorBox>;
  return (
    <>
      <OfficerHeader
        title="Dropdown lists"
        subtitle="Departments, programmes and batches that students choose from. Programmes are listed under their department. Anything you add shows up straight away in student profiles, drive eligibility and the student filters."
      />
      {error && <div className="mb-4"><ErrorBox>{error}</ErrorBox></div>}
      <div className="grid items-start gap-5 md:grid-cols-2">
        {LISTS.map((meta) => <ListCard key={meta.type} meta={meta} data={data[meta.type]} departments={data.department?.items || []} onChanged={reload} />)}
      </div>
      <p className="mt-5 text-xs text-ink-soft">
        Renaming an item also updates every student and drive that uses it. An item that students still use cannot be removed: rename it, or ask those students to change it first. A department can only be removed once its programmes are gone.
      </p>
    </>
  );
}
