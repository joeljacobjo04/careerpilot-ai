import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useApi from "../../hooks/useApi";
import { Empty, ErrorBox, Spinner } from "../../components/ui";
import { OfficerHeader, Panel } from "../../components/officerUi";

const Chart = ({ title, note, data, children, layout = "horizontal", height = 260 }) => (
  <Panel>
    <h2 className="font-bold">{title}</h2>
    {note && <p className="mb-3 text-xs text-ink-soft">{note}</p>}
    {!data?.length ? <Empty>Not enough data yet.</Empty> : (
      <div style={{ height }}>
        <ResponsiveContainer>
          <BarChart data={data} layout={layout} margin={{ left: layout === "vertical" ? 40 : 0 }}>
            <CartesianGrid stroke="#e0ebe4" vertical={layout === "vertical"} horizontal={layout !== "vertical"} />
            {children}
          </BarChart>
        </ResponsiveContainer>
      </div>
    )}
  </Panel>
);

export default function Analytics() {
  const { data, loading, error } = useApi("/officer/analytics");
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;

  return (
    <>
      <OfficerHeader title="Reports & analytics" subtitle="Use these to decide where training time is best spent." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Chart title="Readiness distribution" note="Number of students in each readiness band" data={data.readinessDistribution}>
          <XAxis dataKey="range" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} width={30} tick={{ fontSize: 12 }} /><Tooltip />
          <Bar dataKey="count" name="Students" fill="#15803d" radius={[4, 4, 0, 0]} />
        </Chart>

        <Chart title="Average readiness by department" data={data.departmentReadiness}>
          <XAxis dataKey="department" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} width={30} tick={{ fontSize: 12 }} /><Tooltip />
          <Bar dataKey="avg" name="Avg readiness" fill="#22b45f" radius={[4, 4, 0, 0]} />
        </Chart>

        <Chart title="Most common missing skills" note="Across students' latest skill gap reports" data={data.topMissingSkills} layout="vertical" height={320}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} /><YAxis type="category" dataKey="skill" width={100} tick={{ fontSize: 12 }} /><Tooltip />
          <Bar dataKey="students" name="Students" fill="#d99a1c" radius={[0, 4, 4, 0]} />
        </Chart>

        <Chart title="Drive funnel" note="Registered, shortlisted and selected per drive" data={data.driveFunnel} height={320}>
          <XAxis dataKey="title" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} width={30} tick={{ fontSize: 12 }} /><Tooltip /><Legend />
          <Bar dataKey="registered" name="Registered" fill="#a7dcbd" /><Bar dataKey="shortlisted" name="Shortlisted" fill="#15803d" /><Bar dataKey="selected" name="Selected" fill="#22b45f" />
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
