import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Printer } from "lucide-react";
import api, { errMsg } from "../../api/client";
import useApi from "../../hooks/useApi";
import { Empty, ErrorBox, Spinner } from "../../components/ui";
import { useToast } from "../../components/Feedback";
import { Btn, Meter, OfficerHeader, Panel, readinessColor } from "../../components/officerUi";

const STATUS_COLORS = { registered: "#a7dcbd", shortlisted: "#e9a62a", selected: "#15803d", rejected: "#e0483f" };
const STATUS_LABEL = { registered: "Applied", shortlisted: "Shortlisted", selected: "Selected", rejected: "Rejected" };
const TIP = { contentStyle: { borderRadius: 12, border: "1px solid #e0ebe4", boxShadow: "0 8px 24px -8px rgba(16,40,28,.25)", fontSize: 12 } };

const Kpi = ({ label, value, note, tone = "" }) => (
  <Panel className="!p-4">
    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">{label}</p>
    <p className={`mt-1 text-3xl font-bold tracking-tight ${tone}`}>{value}</p>
    {note && <p className="mt-0.5 text-xs text-ink-soft">{note}</p>}
  </Panel>
);

const Chart = ({ title, note, data, children, layout = "horizontal", height = 260, className = "" }) => (
  <Panel className={className}>
    <h2 className="font-bold">{title}</h2>
    {note && <p className="mb-3 text-xs text-ink-soft">{note}</p>}
    {!data?.length ? <Empty>Not enough data yet.</Empty> : (
      <div style={{ height }} className="mt-2">
        <ResponsiveContainer>
          <BarChart data={data} layout={layout} margin={{ left: layout === "vertical" ? 8 : -12, right: 8, top: 4 }}>
            <CartesianGrid stroke="#e8f0eb" strokeDasharray="3 3" vertical={layout === "vertical"} horizontal={layout !== "vertical"} />
            {children}
          </BarChart>
        </ResponsiveContainer>
      </div>
    )}
  </Panel>
);

/** Plain-English takeaways, so the numbers lead to something to do */
function insights(d) {
  const k = d.kpis, out = [];
  const dist = d.readinessDistribution || [];
  const low = (dist.find((x) => x.range === "0-19")?.count || 0) + (dist.find((x) => x.range === "20-39")?.count || 0);
  if (k.students) out.push({ tone: low / k.students > 0.3 ? "bad" : "ok", text: `${low} of ${k.students} students (${Math.round((low / k.students) * 100)}%) score below 40 on readiness${low ? " and need support." : "."}` });
  const best = d.departmentReadiness?.[0], worst = d.departmentReadiness?.[d.departmentReadiness.length - 1];
  if (best && worst && best.department !== worst.department) out.push({ tone: "ok", text: `${best.department} leads on readiness (${best.avg}). ${worst.department} is lowest (${worst.avg}), so it may need extra training.` });
  if (d.topMissingSkills?.[0]) out.push({ tone: "warn", text: `${d.topMissingSkills[0].skill} is the most common missing skill (${d.topMissingSkills[0].students} students). A workshop on it would help the most people.` });
  if (k.applications) out.push({ tone: "ok", text: `${k.applications} applications so far: ${k.shortlisted} shortlisted and ${k.selected} selected. ${k.placedStudents} student${k.placedStudents === 1 ? " is" : "s are"} placed (${k.placementRate}% of all students).` });
  return out;
}

export default function Analytics() {
  const { data, loading, error } = useApi("/officer/analytics");
  const toast = useToast();
  const [busy, setBusy] = useState("");

  async function download(path, file, key) {
    setBusy(key);
    try {
      const res = await api.get(path, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      Object.assign(document.createElement("a"), { href: url, download: file }).click();
      URL.revokeObjectURL(url);
      toast("Report downloaded");
    } catch (e) { toast(errMsg(e), "error"); } finally { setBusy(""); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  const k = data.kpis;
  const apps = data.applicationStatus.filter((a) => a.count > 0).map((a) => ({ ...a, name: STATUS_LABEL[a.status] }));
  const notes = insights(data);

  return (
    <>
      <OfficerHeader
        title="Reports & analytics" subtitle="Use these to decide where training time is best spent."
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Btn variant="outline" onClick={() => download("/officer/export/students.csv", "students.csv", "students")} disabled={!!busy}><Download size={14} aria-hidden="true" /> {busy === "students" ? "Preparing..." : "Students CSV"}</Btn>
            <Btn variant="outline" onClick={() => download("/officer/export/drives.csv", "drives-report.csv", "drives")} disabled={!!busy}><Download size={14} aria-hidden="true" /> {busy === "drives" ? "Preparing..." : "Drives CSV"}</Btn>
            <Btn variant="outline" onClick={() => window.print()}><Printer size={14} aria-hidden="true" /> Print</Btn>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <Kpi label="Students" value={k.students} />
        <Kpi label="Avg readiness" value={k.avgReadiness} note="out of 100" tone={k.avgReadiness >= 75 ? "text-ok" : k.avgReadiness >= 45 ? "text-warn" : "text-bad"} />
        <Kpi label="Avg CGPA" value={k.avgCgpa ?? "-"} />
        <Kpi label="Drives" value={k.totalDrives} note={`${k.openDrives} open`} />
        <Kpi label="Applications" value={k.applications} note={`${k.shortlisted} shortlisted`} />
        <Kpi label="Placement rate" value={`${k.placementRate}%`} note={`${k.placedStudents} placed`} tone="text-ok" />
      </div>

      {notes.length > 0 && (
        <Panel className="mt-5 !bg-brand-soft/40">
          <h2 className="mb-3 font-bold">Key takeaways</h2>
          <ul className="space-y-2 text-sm">
            {notes.map((n, i) => (
              <li key={i} className="flex gap-2.5"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.tone === "bad" ? "bg-bad" : n.tone === "warn" ? "bg-[#d99a1c]" : "bg-ok"}`} aria-hidden="true" />{n.text}</li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Chart title="Readiness distribution" note="Number of students in each readiness band" data={data.readinessDistribution}>
          <XAxis dataKey="range" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} width={36} tick={{ fontSize: 12 }} /><Tooltip {...TIP} />
          <Bar dataKey="count" name="Students" radius={[6, 6, 0, 0]}>
            {data.readinessDistribution.map((b, i) => <Cell key={i} fill={["#e0483f", "#e0483f", "#e9a62a", "#22b45f", "#15803d"][i] || "#15803d"} />)}
          </Bar>
        </Chart>

        <Panel>
          <h2 className="font-bold">Application outcomes</h2>
          <p className="mb-2 text-xs text-ink-soft">Where every application currently stands</p>
          {!apps.length ? <Empty>No applications yet.</Empty> : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-52 w-52 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={apps} dataKey="count" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2} stroke="none">
                      {apps.map((a) => <Cell key={a.status} fill={STATUS_COLORS[a.status]} />)}
                    </Pie>
                    <Tooltip {...TIP} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-2.5 text-sm">
                {apps.map((a) => (
                  <li key={a.status} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: STATUS_COLORS[a.status] }} aria-hidden="true" />{a.name}</span>
                    <span className="font-bold">{a.count} <span className="font-normal text-ink-soft">({Math.round((a.count / k.applications) * 100)}%)</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel className="lg:col-span-2">
          <h2 className="font-bold">Department overview</h2>
          <p className="mb-3 text-xs text-ink-soft">Readiness, CGPA and placements for each department</p>
          {!data.departmentReadiness.length ? <Empty>Departments appear once students fill in their profile.</Empty> : (
            <div className="overflow-x-auto">
              <table className="cp-table w-full min-w-[560px] text-left text-sm">
                <thead><tr className="border-b border-line text-[11px] font-bold uppercase tracking-wider text-ink-soft"><th className="pb-2">Department</th><th className="pb-2">Students</th><th className="pb-2">Avg CGPA</th><th className="w-1/3 pb-2">Avg readiness</th><th className="pb-2 text-right">Placed</th></tr></thead>
                <tbody>
                  {data.departmentReadiness.map((r) => (
                    <tr key={r.department} className="border-b border-line last:border-0">
                      <td className="py-3 pr-3 font-semibold">{r.department}</td>
                      <td className="py-3 pr-3">{r.students}</td>
                      <td className="py-3 pr-3">{r.avgCgpa ?? "-"}</td>
                      <td className="py-3 pr-4"><div className="flex items-center gap-3"><Meter value={r.avg} color={readinessColor(r.avg)} /><span className="w-8 text-right font-bold">{r.avg}</span></div></td>
                      <td className="py-3 text-right font-bold">{r.placed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Chart title="Most common missing skills" note="Across students' latest skill gap reports" data={data.topMissingSkills} layout="vertical" height={320}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} /><YAxis type="category" dataKey="skill" width={110} tick={{ fontSize: 12 }} /><Tooltip {...TIP} />
          <Bar dataKey="students" name="Students" fill="#d99a1c" radius={[0, 6, 6, 0]} />
        </Chart>

        <Chart title="Drive funnel" note="Applied, shortlisted and selected for each drive" data={data.driveFunnel} layout="vertical" height={320}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} /><YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} /><Tooltip {...TIP} /><Legend />
          <Bar dataKey="registered" name="Applied" fill="#a7dcbd" radius={[0, 4, 4, 0]} /><Bar dataKey="shortlisted" name="Shortlisted" fill="#e9a62a" radius={[0, 4, 4, 0]} /><Bar dataKey="selected" name="Selected" fill="#15803d" radius={[0, 4, 4, 0]} />
        </Chart>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold">Mock interviews</h2>
      {!data.interviews.length ? <Empty>No interviews taken yet.</Empty> : (
        <div className="grid gap-4 sm:grid-cols-3">
          {data.interviews.map((i) => (
            <Panel key={i.status}>
              <p className="text-sm font-semibold capitalize text-ink-soft">{i.status.replace("_", " ")}</p>
              <p className="text-3xl font-bold">{i.count}</p>
              {i.avgScore != null && <p className="text-xs text-ink-soft">Average score {i.avgScore} / 10</p>}
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
