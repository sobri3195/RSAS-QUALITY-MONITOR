import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useStore } from "../app/store";
import {
  useFilters,
  matches,
  indicatorMatches,
  periodMonths,
} from "../app/filters";
import {
  assigned,
  units,
  unitName,
} from "../features/indicators/indicatorService";
import {
  fmt,
  percentage,
  gap,
  recordStatus,
} from "../features/analytics/analyticsService";
import { SearchBox, Badge, ExportButtons } from "./ui";
import { download, recordsCSV } from "../lib/importExportService";
export default function MonitoringTable({ kind }: { kind?: string }) {
  const { state } = useStore();
  const { filters: f } = useFilters();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<"code" | "status" | "period">("code");
  const records = state.records.filter(
    (r) => matches(r, f) && (!kind || r.snapshot.kind === kind),
  );
  const indicators = state.indicators.filter(
    (i) => indicatorMatches(i, f) && (!kind || i.kind === kind),
  );
  const rows = indicators
    .flatMap((i) => {
      const existing = records
        .filter((r) => r.indicatorId === i.id)
        .map((r) => ({ i, r, unitId: r.unitId, month: r.month }));
      const expectedUnits = units.filter(
        (u) =>
          (f.unit === "all" || u.id === f.unit) &&
          assigned(i, u.id, state.assignments),
      );
      const missing = expectedUnits.flatMap((u) =>
        periodMonths(f.period)
          .filter(
            (m) => !existing.some((e) => e.unitId === u.id && e.month === m),
          )
          .map((month) => ({ i, r: undefined, unitId: u.id, month })),
      );
      return existing.length || missing.length
        ? [...existing, ...missing]
        : [{ i, r: undefined, unitId: i.unitId ?? "", month: 0 }];
    })
    .filter(
      ({ i, r }) =>
        `${i.id} ${i.title}`.toLowerCase().includes(search.toLowerCase()) &&
        (f.status === "all" || recordStatus(r, i) === f.status),
    )
    .sort((a, b) =>
      sort === "period"
        ? a.month - b.month
        : sort === "status"
          ? recordStatus(a.r, a.i).localeCompare(recordStatus(b.r, b.i))
          : a.i.id.localeCompare(b.i.id),
    );
  const maxPage = Math.max(0, Math.ceil(rows.length / 10) - 1);
  const current = Math.min(page, maxPage);
  return (
    <>
      <div className="table-toolbar no-print">
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(0);
          }}
        />
        <div className="toolbar-actions">
          <label className="sort-control">
            <ArrowUpDown size={15} />
            <select
              aria-label="Urutkan tabel"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
            >
              <option value="code">Urutkan kode</option>
              <option value="status">Urutkan status</option>
              <option value="period">Urutkan periode</option>
            </select>
          </label>
          <ExportButtons
            onCSV={() =>
              download(
                "rsas-monitoring.csv",
                recordsCSV(rows.flatMap((x) => (x.r ? [x.r] : []))),
                "text/csv;charset=utf-8",
              )
            }
          />
        </div>
      </div>
      <div className="table-scroll">
        <table className="monitoring">
          <thead>
            <tr>
              <th>No.</th>
              <th>Indikator mutu</th>
              <th>Periode / unit</th>
              <th>Jenis</th>
              <th>Numerator</th>
              <th>Denominator</th>
              <th>Capaian</th>
              <th>Target</th>
              <th>Gap</th>
              <th>Status target</th>
              <th>Verifikasi</th>
              <th>PIC / diperbarui</th>
              <th className="no-print">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .slice(current * 10, current * 10 + 10)
              .map(({ i, r, unitId, month }, index) => {
                const profile = r?.snapshot ?? i;
                const value = r ? percentage(r.numerator, r.denominator) : null;
                return (
                  <tr key={`${i.id}:${unitId}:${month}`}>
                    <td className="muted">{current * 10 + index + 1}</td>
                    <td className="indicator-cell">
                      <Link to={`/indicator/${i.id}`}>
                        <span className="code">
                          {i.officialCode ?? `${i.id} · ID internal`}
                        </span>
                        <strong>{i.title}</strong>
                      </Link>
                      {r?.dataType === "simulation" && (
                        <span className="badge warning">SIMULASI</span>
                      )}
                    </td>
                    <td>
                      {month
                        ? `${String(month).padStart(2, "0")}/${f.year}`
                        : f.year}
                      <small>
                        {unitId ? unitName(unitId) : "Belum ditugaskan"}
                      </small>
                    </td>
                    <td>{i.kind === "unit" ? "Unit" : "Rumah sakit"}</td>
                    <td>{r?.numerator ?? "—"}</td>
                    <td>{r?.denominator ?? "—"}</td>
                    <td className="numeric">
                      {value === null ? "—" : `${fmt(value)}%`}
                    </td>
                    <td>
                      {profile.effectiveTargetPct === null
                        ? "Belum disahkan"
                        : `${fmt(profile.effectiveTargetPct, 0)}%`}
                    </td>
                    <td>{fmt(gap(value, profile.effectiveTargetPct))} pp</td>
                    <td>
                      <Badge status={recordStatus(r, i)} />
                    </td>
                    <td>
                      {r
                        ? {
                            draft: "Draft",
                            submitted: "Diajukan",
                            returned: "Perlu revisi",
                            verified: "Terverifikasi lokal",
                          }[r.status]
                        : "—"}
                    </td>
                    <td>
                      {r?.enteredBy || profile.pic || "—"}
                      <small>
                        {r
                          ? new Date(r.updatedAt).toLocaleDateString("id-ID")
                          : "—"}
                      </small>
                    </td>
                    <td className="no-print">
                      <Link
                        className="text-link"
                        to={
                          r
                            ? `/input?record=${r.id}`
                            : `/input?indicator=${i.id}${unitId ? "&unit=" + unitId : ""}`
                        }
                      >
                        {r ? "Lihat / edit" : "Isi data"} →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            {!rows.length && (
              <tr>
                <td colSpan={13}>Tidak ada indikator yang sesuai filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination no-print">
        <span>
          {rows.length} baris · halaman {current + 1} dari {maxPage + 1}
        </span>
        <div>
          <button
            aria-label="Halaman sebelumnya"
            disabled={!current}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            aria-label="Halaman berikutnya"
            disabled={current >= maxPage}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
