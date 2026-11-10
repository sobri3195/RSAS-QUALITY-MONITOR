import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
import type { MonthlyRecord } from "../types";
import {
  trend,
  aggregate,
  fmt,
  paretoData,
} from "../features/analytics/analyticsService";
import { units } from "../features/indicators/indicatorService";
import { Empty } from "./ui";
export function TrendChart({
  records,
  indicatorId,
  year,
}: {
  records: MonthlyRecord[];
  indicatorId: string;
  year: number;
}) {
  const data = trend(records, indicatorId, year);
  if (!data.some((d) => d.value !== null))
    return (
      <Empty>
        Belum ada capaian aktual terverifikasi untuk indikator ini. Target
        konflik, profil belum lengkap, N/A, dan sumber belum layak agregasi
        tidak menjadi capaian final.
      </Empty>
    );
  return (
    <div
      className="chart"
      role="img"
      aria-label="Tren capaian bulanan dan target"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 15, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 5"
            vertical={false}
            stroke="#e8edf1"
          />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <YAxis
            domain={[0, 100]}
            unit="%"
            axisLine={false}
            tickLine={false}
            fontSize={11}
          />
          <Tooltip formatter={(v) => `${fmt(Number(v))}%`} />
          <Legend iconType="circle" />
          <Line
            name="Capaian terverifikasi"
            dataKey="value"
            stroke="#169b87"
            strokeWidth={3}
            dot={{ r: 4 }}
            connectNulls={false}
          />
          <Line
            name="Target versi pengukuran"
            dataKey="target"
            stroke="#a1aec0"
            strokeDasharray="5 5"
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ComparisonChart({
  records,
  gaps = false,
}: {
  records: MonthlyRecord[];
  gaps?: boolean;
}) {
  const ids = [...new Set(records.map((r) => r.indicatorId))];
  const data = ids
    .map((id) => {
      const a = aggregate(records.filter((r) => r.indicatorId === id));
      return {
        name: id,
        capaian: a.value,
        target: a.target,
        gap: a.value !== null && a.target !== null ? a.value - a.target : null,
      };
    })
    .filter((d) => d.capaian !== null)
    .sort((a, b) =>
      gaps ? (a.gap ?? 0) - (b.gap ?? 0) : a.name.localeCompare(b.name),
    );
  if (!data.length) return <Empty />;
  return (
    <div
      className="chart"
      role="img"
      aria-label={
        gaps
          ? "Prioritas gap terhadap target"
          : "Perbandingan capaian dan target"
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={gaps ? "vertical" : "horizontal"}
          margin={{ left: gaps ? 45 : 0, right: 20, bottom: 20 }}
        >
          <CartesianGrid
            strokeDasharray="3 5"
            horizontal={!gaps}
            vertical={gaps}
          />
          {gaps ? (
            <>
              <XAxis type="number" unit=" pp" fontSize={11} />
              <YAxis type="category" dataKey="name" width={90} fontSize={11} />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                angle={-35}
                textAnchor="end"
                fontSize={10}
                height={50}
              />
              <YAxis unit="%" domain={[0, 100]} fontSize={11} />
            </>
          )}
          <Tooltip
            formatter={(v) => `${fmt(Number(v))} ${gaps ? "pp" : "%"}`}
          />
          <Legend />
          <ReferenceLine x={gaps ? 0 : undefined} stroke="#a1aec0" />
          {gaps ? (
            <Bar
              dataKey="gap"
              name="Gap terhadap target (pp)"
              fill="#d49a44"
              radius={[0, 3, 3, 0]}
            />
          ) : (
            <>
              <Bar
                dataKey="capaian"
                name="Capaian"
                fill="#169b87"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="target"
                name="Target"
                fill="#cbd5e1"
                radius={[3, 3, 0, 0]}
              />
            </>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ReportingChart({
  records,
  byPeriod = false,
}: {
  records: MonthlyRecord[];
  byPeriod?: boolean;
}) {
  if (!records.length) return <Empty />;
  const entries = byPeriod
    ? Array.from({ length: 12 }, (_, i) => ({
        id: String(i + 1),
        name: String(i + 1),
      }))
    : units;
  const data = entries.map((u) => {
    const rs = records.filter((r) =>
      byPeriod ? r.month === Number(u.id) : r.unitId === u.id,
    );
    return {
      name: u.name,
      Draft: rs.filter((r) => r.status === "draft").length,
      Diajukan: rs.filter((r) => r.status === "submitted").length,
      Revisi: rs.filter((r) => r.status === "returned").length,
      Terverifikasi: rs.filter((r) => r.status === "verified").length,
    };
  });
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid vertical={false} strokeDasharray="3 5" />
          <XAxis
            dataKey="name"
            fontSize={10}
            angle={-35}
            textAnchor="end"
            height={60}
          />
          <YAxis allowDecimals={false} fontSize={11} />
          <Tooltip />
          <Legend />
          {["Draft", "Diajukan", "Revisi", "Terverifikasi"].map((s, i) => (
            <Bar
              key={s}
              dataKey={s}
              stackId="status"
              fill={["#cbd5e1", "#6b9cca", "#d49a44", "#169b87"][i]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ParetoChart({ records }: { records: MonthlyRecord[] }) {
  const data = paretoData(records);
  if (!data.some((d) => d.frequency > 0))
    return (
      <Empty title="Belum ada kategori kejadian">
        Pareto hanya memakai kategori dan frekuensi nyata yang diinput unit.
      </Empty>
    );
  return (
    <>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="name" fontSize={11} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="frequency" name="Frekuensi aktual" fill="#169b87" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Kategori</th>
              <th>Frekuensi</th>
              <th>Kumulatif</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.name}>
                <td>{d.name}</td>
                <td>{d.frequency}</td>
                <td>{fmt(d.cumulative)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
