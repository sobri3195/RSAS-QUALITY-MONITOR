import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  ArrowRight,
  ShieldCheck,
  CircleAlert,
  Download,
  Activity,
} from "lucide-react";
import { useStore } from "../app/store";
import {
  useFilters,
  matches,
  indicatorMatches,
  periodMonths,
} from "../app/filters";
import { Heading, Panel, Stat } from "../components/ui";
import {
  TrendChart,
  ComparisonChart,
  ReportingChart,
  ParetoChart,
} from "../components/Charts";
import MonitoringTable from "../components/MonitoringTable";
import { units, assigned } from "../features/indicators/indicatorService";
import {
  aggregate,
  finalEligible,
  fmt,
  recordStatus,
  labels,
  months,
} from "../features/analytics/analyticsService";
import { download, recordsCSV } from "../lib/importExportService";
export default function Dashboard({
  analytics = false,
}: {
  analytics?: boolean;
}) {
  const { state } = useStore();
  const { filters: f } = useFilters();
  const [selected, setSelected] = useState("RSAS-U-01");
  const records = state.records.filter(
    (r) =>
      matches(r, f) &&
      (f.status === "all" || recordStatus(r, r.snapshot) === f.status),
  );
  const indicators = state.indicators.filter((i) => indicatorMatches(i, f));
  const currentIndicator =
    indicators.find((i) => i.id === selected)?.id ?? indicators[0]?.id ?? "";
  const final = records.filter(finalEligible);
  const scored = indicators
    .map((i) => aggregate(final.filter((r) => r.indicatorId === i.id)))
    .filter((a) => a.value !== null);
  const achieved = scored.filter((a) => a.value! >= a.target!).length;
  const expected =
    indicators.reduce(
      (sum, i) =>
        sum +
        units.filter(
          (u) =>
            (f.unit === "all" || u.id === f.unit) &&
            assigned(i, u.id, state.assignments),
        ).length *
          periodMonths(f.period).length,
      0,
    ) +
    records.filter((r) => !assigned(r.snapshot, r.unitId, state.assignments))
      .length;
  const verified = records.filter((r) => r.status === "verified").length;
  const unresolved = state.indicators.filter(
    (i) => i.effectiveTargetPct === null,
  ).length;
  const completed = state.plans.filter((p) => p.status === "CLOSED").length;
  return (
    <>
      <Heading
        eyebrow="PUSAT KENDALI MUTU"
        title={analytics ? "Analitik & Grafik" : "Dashboard Eksekutif"}
        actions={
          <>
            <button
              className="button"
              onClick={() =>
                download(
                  "rsas-laporan.csv",
                  recordsCSV(records),
                  "text/csv;charset=utf-8",
                )
              }
            >
              <Download size={16} />
              Ekspor data
            </button>
            <Link to="/input" className="button primary">
              <Plus size={17} />
              Input data unit
            </Link>
          </>
        }
      >
        Gambaran mutu pelayanan, berdasarkan data yang dapat
        dipertanggungjawabkan.
      </Heading>
      <div className="hero-note">
        <span className="hero-icon">
          <ShieldCheck size={22} />
        </span>
        <div>
          <strong>Mutu terukur. Perbaikan berkelanjutan.</strong>
          <p>
            Ringkasan final hanya menggunakan data aktual terverifikasi yang
            layak analisis.
          </p>
        </div>
        <span className="live-chip">
          <span /> Penyimpanan lokal
        </span>
      </div>
      <div className="stats-grid">
        <Stat
          label="Indikator dalam master"
          value="34"
          note="10 prioritas RS · 24 prioritas unit"
          icon={<Activity size={19} />}
        />
        <Stat
          label="Laporan terverifikasi"
          value={
            <>
              {verified}
              <em> / {records.length}</em>
            </>
          }
          note={`${records.length} laporan masuk · ${expected} slot diharapkan`}
        />
        <Stat
          label="Indikator mencapai target"
          value={scored.length ? `${achieved} / ${scored.length}` : "—"}
          note={
            scored.length
              ? `${fmt((achieved / scored.length) * 100)}% dari indikator yang dapat dinilai`
              : "Belum ada data final yang dapat dinilai"
          }
        />
        <Stat
          label="Perlu perhatian master"
          value={unresolved}
          note={`${state.indicators.filter((i) => i.effectiveTargetPct === null && i.profileStatus === "tersedia").length} target belum disahkan · ${state.indicators.filter((i) => i.profileStatus !== "tersedia").length} profil belum lengkap`}
          icon={<CircleAlert size={19} />}
        />
      </div>
      <div className="mini-summary">
        <span>
          <b>24</b> unit pelayanan
        </span>
        <span>
          <b>{Math.max(0, expected - records.length)}</b> slot belum dilaporkan
        </span>
        <span>
          <b>{scored.length - achieved}</b> indikator belum mencapai target
        </span>
        <span>
          <b>
            {completed}/{state.plans.length}
          </b>{" "}
          tindak lanjut selesai
        </span>
        <span>
          <b>
            {expected ? fmt((records.length / expected) * 100) : "—"}
            {expected ? "%" : ""}
          </b>{" "}
          coverage pelaporan
        </span>
      </div>
      <div className="two-columns">
        <Panel
          title="Tren capaian bulanan"
          subtitle={`Januari–Desember ${f.year} · ${f.unit === "all" ? "agregasi unit sebanding" : "unit terpilih"}`}
          actions={
            <select
              aria-label="Indikator grafik tren"
              className="chart-select"
              value={currentIndicator}
              onChange={(e) => setSelected(e.target.value)}
            >
              {indicators.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.id} · {i.title}
                </option>
              ))}
            </select>
          }
        >
          <TrendChart
            records={state.records.filter(
              (r) =>
                matches(r, { ...f, period: "all" }) &&
                (f.status === "all" ||
                  recordStatus(r, r.snapshot) === f.status),
            )}
            indicatorId={currentIndicator}
            year={f.year}
          />
          <div className="panel-foot">
            <span className="legend-dot" />
            Capaian final · kosong berarti belum dapat dinilai, bukan 0%.
          </div>
        </Panel>
        <Panel
          title="Capaian terhadap target"
          subtitle="Per indikator · tanpa menggabungkan rumus berbeda"
          actions={<span className="tag">TERVERIFIKASI</span>}
        >
          <ComparisonChart records={final} />
          <div className="panel-foot">
            Target mengikuti versi profil pada saat laporan disimpan.
          </div>
        </Panel>
      </div>
      <Panel
        title="Monitoring indikator mutu"
        subtitle="Tinjau pelaporan, capaian, dan kualitas data setiap unit."
        actions={
          <Link className="text-link" to="/units">
            Semua indikator <ArrowRight size={14} />
          </Link>
        }
      >
        <MonitoringTable />
      </Panel>
      {analytics && (
        <div className="two-columns">
          <Panel
            title="Prioritas perbaikan"
            subtitle="Urutan gap terhadap target dalam poin persentase"
          >
            <ComparisonChart records={final} gaps />
          </Panel>
          <Panel title="Status pelaporan per unit">
            <ReportingChart records={records} />
          </Panel>
          <Panel title="Status pelaporan per bulan">
            <ReportingChart records={records} byPeriod />
          </Panel>
          <Panel
            title="Pareto kategori kejadian"
            subtitle="Kategori aktual, diurutkan berdasarkan frekuensi"
          >
            <ParetoChart records={final} />
          </Panel>
        </div>
      )}
      <Panel
        title="Peta pelaporan unit"
        subtitle="Unit × bulan · arahkan kursor atau fokuskan sel untuk rincian"
      >
        <div className="heatmap table-scroll">
          <table>
            <thead>
              <tr>
                <th>Unit pelayanan</th>
                {months.map((m) => (
                  <th key={m}>{m.slice(0, 3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units
                .filter((u) => f.unit === "all" || u.id === f.unit)
                .map((u) => (
                  <tr key={u.id}>
                    <th>{u.name}</th>
                    {months.map((m, index) => {
                      const rs = state.records.filter(
                        (r) =>
                          r.unitId === u.id &&
                          r.year === f.year &&
                          r.month === index + 1 &&
                          r.dataType === f.dataType &&
                          (f.kind === "all" || r.snapshot.kind === f.kind),
                      );
                      const statuses = rs.map((r) =>
                        recordStatus(r, r.snapshot),
                      );
                      const tone = !rs.length
                        ? "empty-cell"
                        : statuses.includes("terverifikasi_belum_tercapai")
                          ? "bad"
                          : statuses.every(
                                (s) => s === "terverifikasi_tercapai",
                              )
                            ? "good"
                            : "pending";
                      const title =
                        rs
                          .map(
                            (r) =>
                              `${r.indicatorId}: ${r.numerator}/${r.denominator} · ${labels[recordStatus(r, r.snapshot)]}`,
                          )
                          .join("\n") || "Belum dilaporkan";
                      return (
                        <td key={m}>
                          <button
                            title={title}
                            aria-label={`${u.name} ${m}: ${title}`}
                            className={`heat-cell ${tone}`}
                            onClick={() =>
                              setSelected(rs[0]?.indicatorId ?? "RSAS-U-01")
                            }
                          >
                            {rs.length || "·"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="heatmap-legend">
          <span>
            <i className="good" />
            Tercapai
          </span>
          <span>
            <i className="bad" />
            Belum tercapai
          </span>
          <span>
            <i className="pending" />
            Perlu tinjauan
          </span>
          <span>
            <i className="empty-cell" />
            Belum dilaporkan
          </span>
        </div>
      </Panel>
    </>
  );
}
