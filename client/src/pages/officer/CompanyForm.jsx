import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { errMsg } from "../../api/client";
import useApi from "../../hooks/useApi";
import { ErrorBox, Field, Input, Spinner, Textarea } from "../../components/ui";
import { Btn, LogoTile, OfficerHeader, Panel } from "../../components/officerUi";

/** Shrink the chosen image to at most 256px so it stays small enough to store with the company. */
function shrinkImage(file, max = 256) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error("Logo must be a PNG, JPG or WebP image"));
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(src);
      resolve(canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error("Could not read that image")); };
    img.src = src;
  });
}

function Form({ company }) {
  const nav = useNavigate();
  const editing = !!company;
  const [form, setForm] = useState({
    name: company?.name || "", industry: company?.industry || "", website: company?.website || "",
    headquarters: company?.headquarters || "", description: company?.description || "", logo: company?.logo || "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const back = editing ? `/officer/companies/${company._id}` : "/officer/companies";

  async function pickLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setForm({ ...form, logo: await shrinkImage(file) }); setErr(""); } catch (x) { setErr(x.message); }
  }

  async function save(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = editing ? await api.put(`/companies/${company._id}`, form) : await api.post("/companies", form);
      nav(`/officer/companies/${res.data._id}`);
    } catch (x) { setErr(errMsg(x)); setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <OfficerHeader center title={editing ? "Edit Company" : "Add Company"} subtitle={editing ? "Update this company's details." : "Register a new company for placement drives."} />
      <Panel className="!p-7 shadow-[0_18px_40px_-24px_rgba(16,40,28,.35)]">
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Company Name"><Input required placeholder="e.g. Google" value={form.name} onChange={set("name")} /></Field>
          <Field label="Industry"><Input placeholder="e.g. Information Technology" value={form.industry} onChange={set("industry")} /></Field>
          <Field label="Website"><Input placeholder="https://www.example.com" value={form.website} onChange={set("website")} /></Field>
          <Field label="Headquarters"><Input placeholder="e.g. Bengaluru, India" value={form.headquarters} onChange={set("headquarters")} /></Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea rows={4} placeholder="Brief description about the company..." value={form.description} onChange={set("description")} />
          </Field>

          {editing ? (
            <div className="grid gap-4 rounded-xl bg-brand-soft/50 p-4 sm:col-span-2 sm:grid-cols-[auto_1fr]">
              <div>
                <p className="mb-1 text-sm font-semibold">Current Logo</p>
                {form.logo
                  ? <LogoTile company={{ logo: form.logo }} size={80} />
                  : <span className="flex h-20 w-20 items-center justify-center rounded-lg border border-line bg-white text-xs text-ink-soft">No Logo</span>}
              </div>
              <div>
                <p className="mb-1 text-sm font-semibold">Upload New Logo</p>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickLogo} className="text-sm" aria-label="Upload new logo" />
                {form.logo && <button type="button" onClick={() => setForm({ ...form, logo: "" })} className="mt-2 block text-xs font-semibold text-bad">Remove logo</button>}
              </div>
            </div>
          ) : (
            <div className="sm:col-span-2">
              <p className="mb-1 text-sm font-semibold">Company Logo</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickLogo} className="text-sm" aria-label="Company logo" />
                {form.logo ? <LogoTile company={{ logo: form.logo }} size={48} /> : <span className="text-xs text-ink-soft">Upload a logo (PNG, JPG, JPEG)</span>}
              </div>
            </div>
          )}

          <div className="sm:col-span-2"><ErrorBox>{err}</ErrorBox></div>
          <div className="flex justify-center gap-3 border-t border-line pt-5 sm:col-span-2">
            <Btn type="submit" variant={editing ? "bright" : "dark"} disabled={busy}>{busy ? "Saving..." : editing ? "Update Company" : "Add Company"}</Btn>
            <Btn type="button" variant="outline" onClick={() => nav(back)}>Cancel</Btn>
          </div>
        </form>
      </Panel>
    </div>
  );
}

export default function CompanyForm() {
  const { id } = useParams();
  const { data, loading, error } = useApi(`/companies/${id}`, { skip: !id });
  if (!id) return <Form />;
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  return <Form company={data} />;
}
