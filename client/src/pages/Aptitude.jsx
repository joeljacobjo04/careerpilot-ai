import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { errMsg } from "../api/client";
import useApi from "../hooks/useApi";
import { Badge, Button, Card, ErrorBox, PageHeader, ScoreRing, Spinner } from "../components/ui";
import { useConfirm } from "../components/Feedback";
import { DateRangeFilter, FilterBar, SelectFilter, countText, inDateRange, makeChips, rangeChips, useUrlFilters } from "../components/filters";

const DEFAULTS = { level: "", from: "", to: "", sort: "newest" };
const LEVELS = [["high", "High (70%+)"], ["medium", "Medium (40-69%)"], ["low", "Low (below 40%)"]];
const SORTS = [["newest", "Newest first"], ["oldest", "Oldest first"], ["best", "Highest score"], ["lowest", "Lowest score"]];
const levelOf = (p) => (p >= 70 ? "high" : p >= 40 ? "medium" : "low");

const DURATION = 15 * 60;
const COUNT = 10;
const mmss = (s) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, "0")}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
const LETTERS = ["A", "B", "C", "D"];

export default function Aptitude() {
  const history = useApi("/aptitude/history");
  const { values: f, set, reset } = useUrlFilters(DEFAULTS);
  const [phase, setPhase] = useState("idle"); // idle | running | done
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState({}); // which explanations are expanded

  const submittedRef = useRef(false);
  const questionsRef = useRef([]);
  const answersRef = useRef([]);
  questionsRef.current = questions;
  answersRef.current = answers;

  async function start() {
    setBusy(true); setError("");
    try {
      const { data } = await api.get("/aptitude/questions", { params: { count: COUNT } });
      setQuestions(data.questions);
      setAnswers(Array(data.questions.length).fill(-1));
      setIdx(0); setLeft(DURATION); setResult(null); setOpen({});
      submittedRef.current = false;
      setPhase("running");
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setBusy(true); setError("");
    try {
      const payload = questionsRef.current.map((q, i) => ({ id: q._id, choice: answersRef.current[i] }));
      const { data } = await api.post("/aptitude/submit", { answers: payload });
      setResult(data);
      setPhase("done");
      history.reload();
    } catch (e) {
      submittedRef.current = false;
      setError(errMsg(e));
    } finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const confirm = useConfirm();
  // buttons ask first; the timer running out still submits straight away
  const askSubmit = async () => {
    const left = answersRef.current.filter((a) => a === -1).length;
    const ok = await confirm({
      title: "Submit your test?",
      message: left ? `You have ${left} unanswered question${left === 1 ? "" : "s"}. Unanswered questions score zero, and you can't change your answers after submitting.` : "You can't change your answers after submitting.",
      confirmText: "Submit test",
    });
    if (ok) submit();
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => { if (phase === "running" && left <= 0) submitRef.current(); }, [left, phase]);

  const choose = (i) => setAnswers((a) => a.map((v, n) => (n === idx ? i : v)));

  const attempts = history.data || [];
  const shownAttempts = useMemo(() => {
    const list = attempts.filter((h) => (!f.level || levelOf(h.percent) === f.level) && inDateRange(h.createdAt, f.from, f.to));
    const by = {
      newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      best: (a, b) => b.percent - a.percent,
      lowest: (a, b) => a.percent - b.percent,
    }[f.sort] || (() => 0);
    return [...list].sort(by);
  }, [attempts, f]);
  const chips = useMemo(() => [
    ...makeChips(f, DEFAULTS, set, [{ key: "level", label: "Score", format: (v) => LEVELS.find(([k]) => k === v)?.[1] || v }]),
    ...rangeChips(f, set, DEFAULTS, { label: "Date", minKey: "from", maxKey: "to" }),
  ], [f, set]);

  if (phase === "running") {
    const q = questions[idx];
    const unanswered = answers.filter((a) => a === -1).length;
    return (
      <>
        <PageHeader title="Aptitude test" subtitle={`Question ${idx + 1} of ${questions.length}`}
          action={<Badge tone={left < 60 ? "bad" : "brand"}>Time left {mmss(left)}</Badge>} />
        <Card className="!p-6">
          <Badge tone="neutral">{q.category}</Badge>
          <p className="mb-5 mt-3 text-lg font-semibold leading-snug">{q.question}</p>
          <div role="radiogroup" aria-label="Answer options" className="space-y-2.5">
            {q.options.map((opt, i) => (
              <button key={i} role="radio" aria-checked={answers[idx] === i} onClick={() => choose(i)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-brand ${answers[idx] === i ? "border-brand bg-brand-soft font-semibold" : "border-line bg-white hover:bg-paper"}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${answers[idx] === i ? "bg-brand text-white" : "bg-paper text-ink-soft"}`}>{LETTERS[i]}</span>
                {opt}
              </button>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Previous</Button>
            <div className="flex gap-1" aria-hidden="true">
              {answers.map((a, n) => (
                <button key={n} onClick={() => setIdx(n)} tabIndex={-1}
                  className={`h-2.5 w-2.5 rounded-full ${n === idx ? "bg-brand ring-2 ring-brand/30" : a !== -1 ? "bg-bar" : "bg-line"}`} />
              ))}
            </div>
            {idx < questions.length - 1
              ? <Button onClick={() => setIdx(idx + 1)}>Next</Button>
              : <Button onClick={askSubmit} disabled={busy}>{busy ? "Scoring..." : "Submit test"}</Button>}
          </div>
        </Card>
        <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
          <span>{unanswered === 0 ? "All questions answered." : `${unanswered} unanswered`}</span>
          {idx < questions.length - 1 && <button onClick={askSubmit} disabled={busy} className="font-semibold text-brand">Submit now</button>}
        </div>
        <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>
      </>
    );
  }

  if (phase === "done" && result) {
    return (
      <>
        <PageHeader title="Aptitude result" action={<Button onClick={start} disabled={busy}>Take another test</Button>} />
        <div className="grid gap-5 md:grid-cols-3">
          <Card className="flex flex-col items-center gap-2">
            <ScoreRing value={result.percent} label="score" color="var(--color-bar)" />
            <p className="text-sm text-ink-soft">{result.correct} of {result.total} correct</p>
          </Card>
          <Card className="md:col-span-2">
            <p className="text-sm">Your latest score feeds the <b>Aptitude performance</b> bar on your dashboard. Review the answers below to see where you lost marks.</p>
          </Card>
        </div>
        <ErrorBox>{error}</ErrorBox>
        <h2 className="mb-3 mt-8 font-bold">Review</h2>
        <div className="space-y-3">
          {result.review.map((r, i) => (
            <Card key={r.id} className="!p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="font-semibold">Q{i + 1}. {r.question}</p>
                <Badge tone={r.correct ? "ok" : "bad"}>{r.correct ? "Correct" : r.choice === -1 ? "Skipped" : "Wrong"}</Badge>
              </div>

              <div className="space-y-2">
                {r.options.map((opt, n) => {
                  const isAnswer = n === r.answerIndex;
                  const isWrongPick = n === r.choice && !isAnswer;
                  return (
                    <div key={n}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm ${
                        isAnswer ? "border-ok bg-ok/10 font-semibold text-ok"
                        : isWrongPick ? "border-bad bg-bad/10 text-bad"
                        : "border-line bg-white"}`}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-bold text-ink-soft">{LETTERS[n]}</span>
                      <span className="flex-1">{opt}</span>
                      {isAnswer && <span className="text-xs font-bold">✓ Correct answer</span>}
                      {isWrongPick && <span className="text-xs font-bold">Your answer</span>}
                    </div>
                  );
                })}
              </div>

              {r.choice === -1 && <p className="mt-2 text-sm text-ink-soft">You skipped this question.</p>}

              <button
                onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}
                aria-expanded={!!open[r.id]}
                className="mt-3 text-sm font-semibold text-brand focus-visible:outline-2 focus-visible:outline-brand">
                {open[r.id] ? "Hide explanation" : "Show explanation"}
              </button>
              {open[r.id] && (
                <p className="mt-2 rounded-lg bg-paper p-3 text-sm text-ink-soft">
                  <b className="text-ink">Explanation:</b> {r.explanation || "No explanation available for this question."}
                </p>
              )}
            </Card>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Aptitude test" subtitle="Ten mixed questions on quantitative, logical and verbal reasoning, with a 15 minute timer. Your latest score counts towards your readiness." />
      <Card className="!p-6">
        <ul className="mb-5 list-disc space-y-1 pl-5 text-sm">
          <li>{COUNT} fresh AI-generated questions each time, so you can practise as often as you like.</li>
          <li>You can move back and forth between questions before submitting.</li>
          <li>The test submits itself when the timer ends.</li>
          <li>After submitting, you see the correct answers, and you can open an explanation for any question.</li>
        </ul>
        <ErrorBox>{error}</ErrorBox>
        <Button onClick={start} disabled={busy} className="mt-3">{busy ? "Generating questions..." : "Start test"}</Button>
      </Card>

      <h2 className="mb-3 mt-8 font-bold">Your attempts</h2>
      {attempts.length > 1 && (
        <FilterBar
          chips={chips} onClear={() => reset()} summary={countText(shownAttempts.length, attempts.length, "attempt")}
          actions={<SelectFilter label="Sort by" value={f.sort} onChange={(v) => set({ sort: v })} options={SORTS} hideAny className="w-full sm:w-44" />}
        >
          <SelectFilter label="Score" value={f.level} onChange={(v) => set({ level: v })} options={LEVELS} anyLabel="Any score" className="w-full sm:w-44" />
          <DateRangeFilter label="Taken between" from={f.from} to={f.to} onFrom={(v) => set({ from: v })} onTo={(v) => set({ to: v })} className="w-full sm:w-80" />
        </FilterBar>
      )}
      {history.loading ? <Spinner /> : !attempts.length ? <p className="text-sm text-ink-soft">No attempts yet.</p> : !shownAttempts.length ? (
        <p className="text-sm text-ink-soft">No attempts match these filters. {chips.length > 0 && <button type="button" onClick={() => reset()} className="font-bold text-brand hover:underline">Clear all filters</button>}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shownAttempts.map((h) => (
            <Card key={h._id} className="flex items-center justify-between !p-4">
              <div><p className="font-semibold">{h.correct} of {h.total} correct</p><p className="text-xs text-ink-soft">{new Date(h.createdAt).toLocaleString()}</p></div>
              <Badge tone={h.percent >= 70 ? "ok" : "warn"}>{h.percent}%</Badge>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}