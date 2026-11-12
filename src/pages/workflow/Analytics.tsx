import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  BarChart,
  Bar,
  ReferenceLine,
  Cell,
} from "recharts";
import { toPng } from "html-to-image";
import { Heading, Panel, Stat, Empty } from "../../components/ui";
import { useWorkflow } from "../../features/workflow/WorkflowProvider";
import {
  aggregate,
  csvReport,
  failureStreak,
  meetsTarget,
  monthlySeries,
  overdueSlots,
  pChart,
} from "../../features/workflow/rules";
import type { Submission } from "../../features/workflow/types";
import { downloadText } from "../../features/workflow/download";
export default function Analytics({ report = false }: { report?: boolean }) {
  const { data, demo, profile, repo, run, busy } = useWorkflow();
  const graph = useRef<HTMLDivElement>(null);
  const [drilldown, setDrilldown] = useState("");
  const [unit, setUnit] = useState("");
  const [indicator, setIndicator] = useState(
    data!.indicators.find((i) => i.active)?.id ?? "",
  );
  const [category, setCategory] = useState("");
  const [outcome, setOutcome] = useState("");
  const [end, setEnd] = useState(`${new Date().getFullYear()}-12`);
  const [range, setRange] = useState("12");
  const [start, setStart] = useState(`${new Date().getFullYear()}-01`);
  const [assumptions, setAssumptions] = useState(false);
  const [narrative, setNarrative] = useState(false);
  const months =
    range === "custom"
      ? Math.max(
          1,
          Math.min(
            120,
            (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 +
              Number(end.slice(5)) -
              Number(start.slice(5)) +
              1,
          ),
        )
      : Number(range);
  const endDate = new Date(`${end}-01T00:00:00Z`);
  const from = new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() - months + 1, 1),
  )
    .toISOString()
    .slice(0, 10);
  const all = data!.official.filter(
    (s) =>
      (!unit || s.unit_id === unit) &&
      (!category ||
        data!.indicators.find((i) => i.id === s.indicator_id)?.category ===
          category),
  );
  const rows = all.filter(
    (s) =>
      (!indicator || s.indicator_id === indicator) &&
      s.period >= from &&
      s.period <= `${end}-01` &&
      (!outcome ||
        (outcome === "met"
          ? meetsTarget(s) === true
          : outcome === "failed"
            ? meetsTarget(s) === false
            : s.result === null)),
  );
  const series = monthlySeries(rows, indicator, `${end}-01`, months);
  const comparison = data!.units
    .filter((u) => !unit || u.id === unit)
    .map((u) => {
      const items = rows.filter((s) => s.unit_id === u.id);
      let value: number | null = null;
      let compatible = true;
      try {
        value = aggregate(items);
      } catch {
        compatible = false;
      }
      return {
        name: u.name,
        value,
        target: compatible ? (items[0]?.snapshot.target ?? null) : null,
        compatible,
      };
    });
  const failed = rows.filter((s) => meetsTarget(s) === false);
  const overdue = overdueSlots(data!, `${end}-01`).filter(
    (s) =>
      (!unit || s.unit_id === unit) &&
      (!indicator || s.indicator_id === indicator),
  );
  const metrics = data!.metrics.filter(
    (s) =>
      (!unit || s.unit_id === unit) &&
      (!indicator || s.indicator_id === indicator) &&
      s.period >= from &&
      s.period <= `${end}-01`,
  );
  const durationCount = metrics.reduce((n, s) => n + s.validation_count, 0);
  const meanValidation = durationCount
    ? metrics.reduce((n, s) => n + Number(s.validation_hours), 0) /
      durationCount
    : null;
  const baseline = pChart(rows, assumptions);
  const measured = series
    .map((s) => s.value)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const median = measured.length
    ? measured.length % 2
      ? measured[Math.floor(measured.length / 2)]
      : (measured[measured.length / 2 - 1] + measured[measured.length / 2]) / 2
    : null;
  const actualRows = data!.official.filter((s) =>
    rows.some((row) => row.id === s.id),
  );
  const planIds = new Set(actualRows.map((s) => s.id));
  const actions = data!.actions.filter((a) => planIds.has(a.submission_id));
  const label = (value: number | null | undefined) =>
    value === null || value === undefined
      ? "N/A"
      : value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
  const change =
    series.length > 1 &&
    series.at(-1)?.value !== null &&
    series.at(-2)?.value !== null
      ? series.at(-1)!.value! - series.at(-2)!.value!
      : null;
  const gap = (s: Submission) =>
    s.result === null
      ? null
      : s.snapshot.definition.direction === "range"
        ? s.result < s.snapshot.target
          ? s.result - s.snapshot.target
          : s.result > (s.snapshot.target_upper ?? Infinity)
            ? s.result - s.snapshot.target_upper!
            : 0
        : s.result - s.snapshot.target;
  return (
    <>
      <Heading
        eyebrow={report ? "LAPORAN TERBIT" : "ANALISIS DATA TERBIT"}
        title={report ? "Laporan Resmi" : "Dashboard Mutu & Tren"}
        actions={
          <>
            <button
              className="button"
              onClick={() =>
                downloadText(
                  csvReport(rows),
                  demo ? "DEMO-laporan.csv" : "RSAS-laporan.csv",
                  "text/csv;charset=utf-8",
                )
              }
            >
              Ekspor CSV resmi
            </button>
            <button className="button" onClick={() => window.print()}>
              Cetak / PDF
            </button>
            <button
              className="button"
              onClick={() =>
                void run(async () => {
                  if (graph.current) {
                    const url = await toPng(graph.current, {
                      backgroundColor: "#fff",
                      cacheBust: false,
                    });
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = demo ? "DEMO-grafik.png" : "RSAS-grafik.png";
                    a.click();
                  }
                }, "Grafik PNG diekspor.")
              }
            >
              Ekspor grafik PNG
            </button>
          </>
        }
      >
        Hanya revisi DITERBITKAN oleh Tim Mutu. Data kosong tampil sebagai gap,
        bukan 0. {demo && "Seluruh angka di bawah ini sintetis."}
      </Heading>
      <div className="global-filters no-print workflow-filters">
        <label>
          Unit analisis
          <select
            aria-label="Unit analisis"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="">Semua unit berhak akses</option>
            {data!.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Indikator analisis
          <select
            aria-label="Indikator analisis"
            value={indicator}
            onChange={(e) => setIndicator(e.target.value)}
          >
            {data!.indicators.map((i) => (
              <option key={i.id} value={i.id}>
                {i.code} · {i.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kategori
          <select
            aria-label="Kategori"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Semua kategori</option>
            {["INM", "IMP-RS", "IMP-Unit"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Status capaian
          <select
            aria-label="Status capaian"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          >
            <option value="">Semua hasil terbit</option>
            <option value="met">Tercapai</option>
            <option value="failed">Belum tercapai</option>
            <option value="na">N/A</option>
          </select>
        </label>
        <label>
          Rentang analisis
          <select
            aria-label="Rentang analisis"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            {[3, 6, 12, 24].map((n) => (
              <option key={n} value={n}>
                {n} bulan
              </option>
            ))}
            <option value="custom">Tahun / rentang kustom</option>
          </select>
        </label>
        {range === "custom" && (
          <label>
            Mulai bulan
            <input
              aria-label="Mulai bulan"
              type="month"
              min="2020-01"
              max={end}
              value={start}
              onChange={(e) => e.target.value && setStart(e.target.value)}
            />
          </label>
        )}
        <label>
          Akhir bulan
          <input
            aria-label="Akhir bulan"
            type="month"
            min={range === "custom" ? start : "2020-01"}
            max="2100-12"
            value={end}
            onChange={(e) => e.target.value && setEnd(e.target.value)}
          />
        </label>
      </div>
      <div className="stats-grid">
        <Stat
          label="Slot indikator tercapai"
          value={rows.filter((s) => meetsTarget(s) === true).length}
          note="Hanya data terbit pada filter"
        />
        <Stat
          label="Slot belum tercapai"
          value={failed.length}
          note="Arah target mengikuti snapshot"
        />
        <Stat
          label="Belum melapor / terlambat"
          value={overdue.length}
          note={`Slot periode ${end}; tenggat bulan berikutnya`}
        />
        <Stat
          label="Menunggu validasi"
          value={metrics.reduce((n, s) => n + s.pending_validation, 0)}
          note={`Rata-rata waktu validasi ${label(meanValidation)} jam`}
        />
        <Stat
          label="Progres tindak lanjut"
          value={`${actions.filter((a) => a.status === "CLOSED").length}/${actions.length}`}
          note="Tindak lanjut selesai / total"
        />
      </div>
      {profile!.role === "leader" && (
        <p className="helper">
          KPI antrean adalah hitungan agregat; angka pengukuran dan revisi belum
          final tidak dapat dibaca Pimpinan.
        </p>
      )}
      <div ref={graph} className="workflow-export report">
        <div className="report-letterhead">
          <img src="/logo-rsau.jpeg" width="48" alt="Logo RSAU" />
          <div>
            <h2>RSAU PROF. DR. ABDULRACHMAN SALEH</h2>
            <p>
              {demo ? "DEMO — SINTETIS — " : ""}Laporan data terbit ·{" "}
              {from.slice(0, 7)} – {end}
            </p>
          </div>
        </div>
        {!rows.length && (
          <Empty title="Belum ada data diterbitkan pada filter ini">
            Data draft/validasi tidak masuk grafik atau ekspor resmi.
          </Empty>
        )}
        <Panel
          title="Tren bulanan & run chart"
          subtitle={`Perubahan bulan terakhir: ${label(change)} ${rows[0]?.snapshot.definition.measurement === "proportion" ? "pp" : (rows[0]?.snapshot.definition.unit_label ?? "")}. Median hanya ringkasan deskriptif.`}
        >
          <div className="workflow-chart">
            <ResponsiveContainer width="100%" height={310}>
              <LineChart
                data={series}
                onClick={(state) => {
                  if (state?.activeLabel)
                    setDrilldown(String(state.activeLabel));
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const point = payload[0].payload as (typeof series)[number];
                    return (
                      <div className="workflow-tooltip">
                        <b>{point.month}</b>
                        <p>
                          Aktual {label(point.value)} · Target{" "}
                          {label(point.target)}
                        </p>
                        <p>
                          Numerator {point.numerator ?? "—"} / denominator{" "}
                          {point.denominator ?? "—"}
                        </p>
                        <p>
                          {point.intervention || "Tanpa anotasi intervensi"}
                        </p>
                        {!point.comparable && (
                          <p>Definisi/target berbeda, tidak digabungkan.</p>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend />
                <Line
                  isAnimationActive={false}
                  type="linear"
                  dataKey="value"
                  name="Aktual terbit"
                  stroke="#0d9488"
                  strokeWidth={3}
                  dot={(props) => {
                    const p = props as {
                      cx?: number;
                      cy?: number;
                      payload?: (typeof series)[number];
                    };
                    return (
                      <circle
                        key={p.payload?.month}
                        cx={p.cx}
                        cy={p.cy}
                        r={p.payload?.value === null ? 0 : 4}
                        fill={
                          p.payload?.met === true
                            ? "#0d9488"
                            : p.payload?.met === false
                              ? "#d97736"
                              : "#8495a7"
                        }
                      />
                    );
                  }}
                  connectNulls={false}
                />
                <Line
                  isAnimationActive={false}
                  dataKey="target"
                  name="Target snapshot"
                  stroke="#d18a18"
                  strokeDasharray="6 4"
                  connectNulls={false}
                />
                <Line
                  isAnimationActive={false}
                  dataKey="upper"
                  name="Batas atas target"
                  stroke="#c27f19"
                  connectNulls={false}
                />
                {median !== null && (
                  <ReferenceLine
                    y={median}
                    stroke="#8495a7"
                    strokeDasharray="2 4"
                    label="Median"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {drilldown && (
            <div className="form-content">
              <b>Detail {drilldown}</b>
              {rows
                .filter((s) => s.period.slice(0, 7) === drilldown)
                .map((s) => (
                  <Link
                    key={s.id}
                    className="text-link"
                    to={`/workflow/submissions/${s.id}`}
                  >
                    {s.unit_id} · Lihat Riwayat Validasi
                  </Link>
                ))}
            </div>
          )}
          <p className="form-content">
            Klik titik grafik atau baris detail untuk meninjau catatan
            validator. Perbedaan versi/target tidak digabungkan; nilai kosong
            tetap gap. Tren sederhana tidak membuktikan signifikansi atau
            kausalitas.
          </p>
        </Panel>
        <Panel title="Realisasi vs target antarunit (indikator sama)">
          <div className="workflow-chart">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={comparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  isAnimationActive={false}
                  dataKey="value"
                  name="Realisasi terbit"
                  fill="#0d9488"
                >
                  {comparison.map((item) => {
                    const source = rows.find(
                      (s) =>
                        data!.units.find((u) => u.id === s.unit_id)?.name ===
                        item.name,
                    );
                    const met =
                      source && item.value !== null
                        ? meetsTarget({ ...source, result: item.value })
                        : null;
                    return (
                      <Cell
                        key={item.name}
                        fill={
                          met === false
                            ? "#d97736"
                            : met === true
                              ? "#0d9488"
                              : "#8495a7"
                        }
                      />
                    );
                  })}
                </Bar>
                <Bar
                  isAnimationActive={false}
                  dataKey="target"
                  name="Target"
                  fill="#e7b14c"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="form-content">
            Rasio menggunakan Σ numerator / Σ denominator. Versi/target berbeda
            dan indikator tanpa izin agregasi tidak dirata-ratakan.
          </p>
        </Panel>
        <Panel title="Heatmap unit × bulan">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Unit</th>
                  {series.map((p) => (
                    <th key={p.month}>{p.month}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data!.units
                  .filter((u) => !unit || u.id === unit)
                  .map((u) => (
                    <tr key={u.id}>
                      <th>{u.name}</th>
                      {series.map((p) => {
                        const s = rows.find(
                          (s) =>
                            s.unit_id === u.id &&
                            s.period.slice(0, 7) === p.month,
                        );
                        const pendingRecord = data!.metrics.find(
                          (s) =>
                            s.unit_id === u.id &&
                            s.indicator_id === indicator &&
                            s.period.slice(0, 7) === p.month,
                        );
                        const filteredOut = all.some(
                          (item) =>
                            item.unit_id === u.id &&
                            item.indicator_id === indicator &&
                            item.period.slice(0, 7) === p.month,
                        );
                        return (
                          <td
                            key={p.month}
                            className={
                              s
                                ? meetsTarget(s) === true
                                  ? "heat-met"
                                  : meetsTarget(s) === false
                                    ? "heat-failed"
                                    : "heat-na"
                                : ""
                            }
                          >
                            {s ? (
                              <Link to={`/workflow/submissions/${s.id}`}>
                                {label(s.result)}
                              </Link>
                            ) : (
                              <span>
                                {filteredOut
                                  ? "Di luar filter"
                                  : pendingRecord
                                    ? "Belum terbit"
                                    : "Belum dilaporkan"}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Data sumber, gap & riwayat">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Indikator / unit</th>
                  <th>Periode</th>
                  <th>N / D</th>
                  <th>Aktual</th>
                  <th>Target / gap</th>
                  <th>Status</th>
                  <th>Revisi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link
                        className="text-link"
                        to={`/workflow/submissions/${s.id}`}
                      >
                        {s.snapshot.code} · {s.unit_id}
                      </Link>
                    </td>
                    <td>{s.period.slice(0, 7)}</td>
                    <td>
                      {s.data.numerator ?? "—"} / {s.data.denominator ?? "—"}
                    </td>
                    <td>
                      {label(s.result)} {s.snapshot.definition.unit_label}
                    </td>
                    <td>
                      {s.snapshot.target}
                      {s.snapshot.target_upper !== null
                        ? ` – ${s.snapshot.target_upper}`
                        : ""}{" "}
                      / {label(gap(s))}
                      {s.snapshot.definition.measurement === "proportion"
                        ? " pp"
                        : ""}
                    </td>
                    <td>
                      <span
                        className={`badge ${meetsTarget(s) === true ? "terverifikasi_tercapai" : meetsTarget(s) === false ? "warning" : ""}`}
                      >
                        {meetsTarget(s) === null
                          ? "N/A"
                          : meetsTarget(s)
                            ? "Tercapai"
                            : "Belum tercapai"}
                      </span>
                      {failureStreak(
                        data!.official,
                        s.indicator_id,
                        s.unit_id,
                      ) >= 3 && (
                        <small>3+ periode berturut-turut belum tercapai</small>
                      )}
                    </td>
                    <td>
                      v{s.snapshot.version} / r{s.revision_no}
                      <small>{s.published_at}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Control chart p (opsional)">
          <div className="form-content">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={assumptions}
                onChange={(e) => setAssumptions(e.target.checked)}
              />
              Analis mengonfirmasi peluang biner independen, baseline proses
              stabil, dan definisi/metode sebanding.
            </label>
            <p>
              Memerlukan satu unit, satu indikator proporsi, ≥20 bulan berurutan
              tanpa gap, versi definisi sama. Batas kendali 3σ berdasarkan
              denominator masing-masing; bukan garis target dan bukan bukti
              kausalitas.
            </p>
            {baseline ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={baseline}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    isAnimationActive={false}
                    dataKey="value"
                    stroke="#0d9488"
                  />
                  <Line
                    isAnimationActive={false}
                    dataKey="center"
                    stroke="#64748b"
                  />
                  <Line
                    isAnimationActive={false}
                    dataKey="upper"
                    stroke="#d18a18"
                  />
                  <Line
                    isAnimationActive={false}
                    dataKey="lower"
                    stroke="#d18a18"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p>
                Prasyarat metode atau data belum terpenuhi; control chart tidak
                dihitung.
              </p>
            )}
          </div>
        </Panel>
      </div>
      <Panel title="Ringkasan & keterlambatan">
        <div className="form-content">
          <button className="button" onClick={() => setNarrative(true)}>
            Buat draft narasi dari data terbit
          </button>
          {narrative && (
            <p>
              {demo ? "DEMO. " : ""}DRAFT — {rows.length} slot diterbitkan pada
              filter ini; {failed.length} di bawah/di luar target,{" "}
              {rows.filter((s) => s.result === null).length} N/A. Interpretasi
              klinis dan rekomendasi memerlukan review manusia.
            </p>
          )}
          {overdue.map((s) => (
            <p key={`${s.unit_id}:${s.indicator_id}`}>
              {s.unit_id} · {s.indicator_id} · Belum ada pengajuan layak sebelum
              tenggat.
            </p>
          ))}
          {["mutu", "admin"].includes(profile!.role) && (
            <button
              disabled={busy}
              className="button"
              onClick={() =>
                void run(
                  () => repo!.remind(),
                  "Pengingat periode sebelumnya dibuat; retry tidak menggandakan notifikasi.",
                )
              }
            >
              Kirim pengingat in-app periode terlambat
            </button>
          )}
        </div>
      </Panel>
    </>
  );
}
