import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { errMsg } from "../api/client";
import useApi from "../hooks/useApi";
import { preloadModel } from "../hooks/useObjectDetection";
import { Badge, Button, Card, ErrorBox, Field, Input, PageHeader, Select } from "../components/ui";
import { DateRangeFilter, FilterBar, FilterGroup, SearchBox, SelectFilter, countText, inDateRange, makeChips, rangeChips, uniq, useUrlFilters } from "../components/filters";

const DEFAULTS = { q: "", difficulty: "", status: "", score: "", from: "", to: "", sort: "newest" };
const SCORES = [["high", "7 and above"], ["medium", "5 to 6.9"], ["low", "Below 5"]];
const SORTS = [["newest", "Newest first"], ["oldest", "Oldest first"], ["best", "Highest score"], ["lowest", "Lowest score"]];
const scoreBand = (n) => (n >= 7 ? "high" : n >= 5 ? "medium" : "low");

const RULES = [
  "The interview runs in full-screen. Leaving full-screen ends it.",
  "Switching tabs or apps ends it.",
  "Your camera must stay on. A phone, a book, or a second person in view ends it.",
  "Copy, paste, right-click and developer tools are blocked. Three attempts end it.",
  "Questions are read aloud. Answer by voice (Chrome or Edge) or type your answer.",
];

export default function InterviewSetup() {
  const nav = useNavigate();
  const history = useApi("/interview/history");
  const { values: f, set, reset } = useUrlFilters(DEFAULTS);
  const [form, setForm] = useState({ role: "", difficulty: "medium", count: 5 });
  const [camOk, setCamOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const speechOk = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => { preloadModel().catch(() => {}); }, []); // warm the detection model while the student reads the rules

  const past = useMemo(() => (history.data || []).filter((h) => h.status !== "in_progress"), [history.data]);
  const roleOptions = useMemo(() => uniq(past.map((h) => h.role)), [past]);
  const shown = useMemo(() => {
    const text = f.q.trim().toLowerCase();
    const list = past.filter((h) => {
      if (text && !h.role.toLowerCase().includes(text)) return false;
      if (f.difficulty && h.difficulty !== f.difficulty) return false;
      if (f.status && h.status !== f.status) return false;
      if (f.score && !(h.status === "completed" && scoreBand(h.overallScore ?? 0) === f.score)) return false;
      return inDateRange(h.startedAt, f.from, f.to);
    });
    const t = (h) => new Date(h.startedAt).getTime();
    const by = {
      newest: (a, b) => t(b) - t(a), oldest: (a, b) => t(a) - t(b),
      best: (a, b) => (b.overallScore ?? -1) - (a.overallScore ?? -1), lowest: (a, b) => (a.overallScore ?? 99) - (b.overallScore ?? 99),
    }[f.sort] || (() => 0);
    return [...list].sort(by);
  }, [past, f]);
  const chips = useMemo(() => [
    ...makeChips(f, DEFAULTS, set, [
      { key: "q", label: "Role" }, { key: "difficulty", label: "Difficulty", format: (v) => v[0].toUpperCase() + v.slice(1) },
      { key: "status", label: "Result", format: (v) => (v === "completed" ? "Completed" : "Cancelled") },
      { key: "score", label: "Score", format: (v) => SCORES.find(([k]) => k === v)?.[1] || v },
    ]),
    ...rangeChips(f, set, DEFAULTS, { label: "Date", minKey: "from", maxKey: "to" }),
  ], [f, set]);

  async function checkCamera() {
    setError("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
      setCamOk(true);
    } catch { setError("Camera permission was blocked. Allow camera access in your browser and try again."); }
  }

  async function start(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const { data } = await api.post("/interview/start", { ...form, count: Number(form.count) });
      nav(`/interview/room/${data.id}`);
    } catch (err) { setError(errMsg(err)); setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Proctored mock interview" subtitle="A voice-based interview scored on clarity, correctness, completeness and communication." />
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <form onSubmit={start} className="space-y-4">
            <Field label="Role you are interviewing for"><Input required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Full Stack Developer" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Difficulty">
                <Select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                  <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                </Select>
              </Field>
              <Field label="Questions">
                <Select value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })}>{[3, 5, 7, 10].map((n) => <option key={n}>{n}</option>)}</Select>
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="ghost" onClick={checkCamera}>{camOk ? "Camera works" : "Test camera"}</Button>
              {camOk && <Badge tone="ok">Ready</Badge>}
              {!speechOk && <Badge tone="warn">Voice input needs Chrome or Edge. You can type instead.</Badge>}
            </div>
            <ErrorBox>{error}</ErrorBox>
            <Button disabled={busy || !camOk} className="w-full">{busy ? "Preparing your questions..." : "Start interview"}</Button>
            {!camOk && <p className="text-xs text-ink-soft">Test your camera to unlock the start button.</p>}
          </form>
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">Rules</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm">{RULES.map((r) => <li key={r}>{r}</li>)}</ul>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-bold">Past interviews</h2>
      {past.length > 1 && (
        <FilterBar
          search={<SearchBox value={f.q} onChange={(v) => set({ q: v })} placeholder="Search a role" label="Search past interviews" className="min-w-52 flex-1" />}
          chips={chips} onClear={() => reset()} summary={countText(shown.length, past.length, "interview")}
          actions={<SelectFilter label="Sort by" value={f.sort} onChange={(v) => set({ sort: v })} options={SORTS} hideAny className="w-full sm:w-44" />}
          moreCount={["from", "to"].filter((k) => f[k]).length}
          more={<FilterGroup title="When"><DateRangeFilter label="Held between" from={f.from} to={f.to} onFrom={(v) => set({ from: v })} onTo={(v) => set({ to: v })} /></FilterGroup>}
        >
          <SelectFilter label="Difficulty" value={f.difficulty} onChange={(v) => set({ difficulty: v })} options={[["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]]} anyLabel="Any" className="w-full sm:w-36" />
          <SelectFilter label="Result" value={f.status} onChange={(v) => set({ status: v })} options={[["completed", "Completed"], ["cancelled", "Cancelled"]]} anyLabel="Any" className="w-full sm:w-36" />
          <SelectFilter label="Score (out of 10)" value={f.score} onChange={(v) => set({ score: v })} options={SCORES} anyLabel="Any score" className="w-full sm:w-40" />
          {roleOptions.length > 1 && <SelectFilter label="Role" value={roleOptions.includes(f.q) ? f.q : ""} onChange={(v) => set({ q: v })} options={roleOptions} anyLabel="All roles" />}
        </FilterBar>
      )}
      <div className="space-y-2">
        {past.length === 0 && <p className="text-sm text-ink-soft">No interviews yet.</p>}
        {past.length > 0 && !shown.length && <p className="text-sm text-ink-soft">No interviews match these filters. {chips.length > 0 && <button type="button" onClick={() => reset()} className="font-bold text-brand hover:underline">Clear all filters</button>}</p>}
        {shown.map((h) => (
          <Link key={h._id} to={`/interview/result/${h._id}`} className="flex items-center justify-between rounded-lg border border-line bg-white p-4 hover:border-brand">
            <div><p className="font-semibold">{h.role}</p><p className="text-xs text-ink-soft">{new Date(h.startedAt).toLocaleString()} &middot; {h.difficulty}</p></div>
            {h.status === "completed" ? <Badge tone="ok">{h.overallScore} / 10</Badge> : <Badge tone="bad">Cancelled</Badge>}
          </Link>
        ))}
      </div>
    </>
  );
}
