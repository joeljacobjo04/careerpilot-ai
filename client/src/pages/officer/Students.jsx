import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import api, { errMsg } from "../../api/client";
import { ErrorBox, Input, Select, Spinner } from "../../components/ui";
import { Btn, Meter, OfficerHeader, Panel, Pill, readinessColor, readinessLabel, readinessTone } from "../../components/officerUi";

export default function Students() {
  const [filters, setFilters] = useState({ search: "", dept: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true); setError("");
      try { setData((await api.get("/officer/students", { params: { ...filters, page, limit: 20 } })).data); }
      catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
    }, 250); // debounce typing in the search box
    return () => clearTimeout(t);
  }, [filters, page]);

  const change = (k) => (e) => { setPage(1); setFilters({ ...filters, [k]: e.target.value }); };

  async function exportCsv() {
    const res = await api.get("/officer/export/students.csv", { params: filters, responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    Object.assign(document.createElement("a"), { href: url, download: "students.csv" }).click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <OfficerHeader
        title="Student records" subtitle="Monitor readiness and progress across your institution."
        action={<Btn variant="outline" onClick={exportCsv}>Export CSV</Btn>}
      />
      <Panel>
        <div className="mb-5 flex flex-wrap gap-3">
          <div className="relative min-w-60 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
            <Input style={{ paddingLeft: 36 }} placeholder="Search students by name or department..." value={filters.search} onChange={change("search")} aria-label="Search students" />
          </div>
          <div className="w-full sm:w-56">
            <Select value={filters.dept} onChange={change("dept")} aria-label="Department">
              <option value="">All departments</option>
              {(data?.departments || []).map((d) => <option key={d}>{d}</option>)}
            </Select>
          </div>
        </div>

        <ErrorBox>{error}</ErrorBox>
        {loading && !data ? <Spinner /> : !data?.items.length ? (
          <p className="py-10 text-center text-sm text-ink-soft">No students match these filters.</p>
        ) : (
          <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                  <th className="pb-2">Name</th><th className="pb-2">Department</th><th className="pb-2">Readiness score</th><th className="pb-2">Status</th><th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => {
                  const score = p.readiness?.score || 0;
                  return (
                    <tr key={p._id} className="border-b border-line transition last:border-0 hover:bg-mint">
                      <td className="py-3 pr-3 font-semibold">{p.user?.name}</td>
                      <td className="py-3 pr-3 text-ink-soft">{p.department || "-"}</td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="w-32"><Meter value={score} color={readinessColor(score)} /></div>
                          <span className="font-bold">{score.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3"><Pill tone={readinessTone(score)}>{readinessLabel(score)}</Pill></td>
                      <td className="py-3 text-right">
                        <Link to={`/officer/students/${p._id}`} className="inline-block rounded-md border border-line bg-white px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand-soft">
                          View profile
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* phone: one card per student */}
          <ul className="space-y-3 md:hidden">
            {data.items.map((p) => {
              const score = p.readiness?.score || 0;
              return (
                <li key={p._id}>
                  <Link to={`/officer/students/${p._id}`} className="block rounded-xl border border-line p-4 transition active:bg-mint">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><p className="truncate font-bold">{p.user?.name}</p><p className="truncate text-xs text-ink-soft">{p.department || "No department"}</p></div>
                      <Pill tone={readinessTone(score)}>{readinessLabel(score)}</Pill>
                    </div>
                    <div className="mt-3 flex items-center gap-3"><Meter value={score} color={readinessColor(score)} /><span className="text-sm font-bold">{score.toFixed(1)}%</span></div>
                  </Link>
                </li>
              );
            })}
          </ul>
          </>
        )}

        {data?.pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
            <span>{data.total} students</span>
            <div className="flex items-center gap-2">
              <Btn variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Btn>
              <span>Page {data.page} of {data.pages}</span>
              <Btn variant="outline" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</Btn>
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}
