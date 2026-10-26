import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import useApi from "../../hooks/useApi";
import { ErrorBox, Spinner } from "../../components/ui";
import { BtnLink, LogoTile, OfficerHeader, Panel, Pill } from "../../components/officerUi";
import { FilterBar, FilterGroup, SearchBox, SelectFilter, makeChips, uniq, useUrlFilters } from "../../components/filters";

const DEFAULTS = { q: "", industry: "", status: "", hq: "", year: "", sort: "name" };
const MORE_KEYS = ["hq", "year"];
const SORTS = [["name", "Name A-Z"], ["newest", "Recently added"], ["drives", "Most open drives"]];

export default function Companies() {
  const { data, loading, error } = useApi("/companies");
  const { values: f, set, reset } = useUrlFilters(DEFAULTS);

  const companies = data || [];
  const options = useMemo(() => ({
    industries: uniq(companies.map((c) => c.industry)),
    hqs: uniq(companies.map((c) => c.headquarters)),
    years: uniq(companies.map((c) => c.createdAt && new Date(c.createdAt).getFullYear())).reverse(),
  }), [companies]);

  const shown = useMemo(() => {
    const text = f.q.trim().toLowerCase();
    const list = companies.filter((c) => {
      if (text && ![c.name, c.industry, c.headquarters, ...(c.roles || [])].some((v) => v?.toLowerCase().includes(text))) return false;
      if (f.industry && c.industry !== f.industry) return false;
      if (f.status === "open" && !c.openDrives) return false;
      if (f.status === "none" && c.openDrives) return false;
      if (f.hq && c.headquarters !== f.hq) return false;
      if (f.year && String(new Date(c.createdAt).getFullYear()) !== f.year) return false;
      return true;
    });
    const by = {
      name: (a, b) => a.name.localeCompare(b.name),
      newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      drives: (a, b) => (b.openDrives || 0) - (a.openDrives || 0) || a.name.localeCompare(b.name),
    }[f.sort] || (() => 0);
    return [...list].sort(by);
  }, [companies, f]);

  const moreCount = MORE_KEYS.filter((k) => f[k] !== DEFAULTS[k]).length;
  const chips = useMemo(() => makeChips(f, DEFAULTS, set, [
    { key: "q", label: "Search" }, { key: "industry", label: "Industry" },
    { key: "status", label: "Drives", format: (v) => (v === "open" ? "Has an open drive" : "No active drive") },
    { key: "hq", label: "Headquarters" }, { key: "year", label: "Added in" },
  ]), [f, set]);

  return (
    <>
      <OfficerHeader title="Companies" subtitle="Manage company information and hiring relationships." />
      {loading ? <Spinner /> : error ? <ErrorBox>{error}</ErrorBox> : (
        <>
          {!companies.length && <p className="mb-5 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">No companies yet. Add your first recruiter below.</p>}

          {companies.length > 0 && (
            <FilterBar
              search={<SearchBox value={f.q} onChange={(v) => set({ q: v })} placeholder="Search company, industry or role" label="Search companies" />}
              moreCount={moreCount} chips={chips} onClear={() => reset()} summary={shown.length === companies.length ? `${companies.length} ${companies.length === 1 ? "company" : "companies"}` : `${shown.length} of ${companies.length} companies`}
              actions={<SelectFilter label="Sort by" value={f.sort} onChange={(v) => set({ sort: v })} options={SORTS} hideAny className="w-full sm:w-48" />}
              more={
                <FilterGroup title="Company details">
                  <SelectFilter label="Headquarters" value={f.hq} onChange={(v) => set({ hq: v })} options={options.hqs} className="w-full" />
                  <SelectFilter label="Added in year" value={f.year} onChange={(v) => set({ year: v })} options={options.years.map(String)} className="w-full" />
                </FilterGroup>
              }
            >
              <SelectFilter label="Industry" value={f.industry} onChange={(v) => set({ industry: v })} options={options.industries} anyLabel="All industries" />
              <SelectFilter label="Drive status" value={f.status} onChange={(v) => set({ status: v })} options={[["open", "Has an open drive"], ["none", "No active drive"]]} anyLabel="Any" className="w-full sm:w-44" />
            </FilterBar>
          )}

          {companies.length > 0 && !shown.length && (
            <div className="py-10 text-center text-sm text-ink-soft">
              <p>No companies match these filters.</p>
              {chips.length > 0 && <button type="button" onClick={() => reset()} className="mt-2 font-bold text-brand hover:underline">Clear all filters</button>}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {shown.map((c) => (
              <Link key={c._id} to={`/officer/companies/${c._id}`} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                <Panel hover className="h-full">
                  <LogoTile company={c} />
                  <p className="mt-3 font-bold">{c.name}</p>
                  <p className="mb-3 text-sm text-ink-soft">{c.industry || "\u00a0"}</p>
                  <Pill tone={c.openDrives ? "ok" : "neutral"}>{c.openDrives ? "Open Drive" : "No Active Drive"}</Pill>
                </Panel>
              </Link>
            ))}
          </div>
          <div className="mt-5">
            <BtnLink to="/officer/companies/add"><Plus size={15} aria-hidden="true" /> Add Company</BtnLink>
          </div>
        </>
      )}
    </>
  );
}
