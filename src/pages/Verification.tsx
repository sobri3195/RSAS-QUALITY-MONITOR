import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, RotateCcw } from "lucide-react";
import { useStore } from "../app/store";
import { useFilters, matches } from "../app/filters";
import { reviewRecord } from "../features/entries/recordService";
import { unitName } from "../features/indicators/indicatorService";
import {
  fmt,
  percentage,
  recordStatus,
} from "../features/analytics/analyticsService";
import { Heading, Panel, Badge, Empty } from "../components/ui";
export default function Verification() {
  const { state, role, update, notify } = useStore();
  const { filters } = useFilters();
  const [selected, setSelected] = useState("");
  const [note, setNote] = useState("");
  const [actor, setActor] = useState("");
  const [policy, setPolicy] = useState("");
  const records = state.records.filter(
    (r) =>
      matches(r, filters) &&
      (filters.status === "all" ||
        recordStatus(r, r.snapshot) === filters.status),
  );
  const submitted = records.filter((r) => r.status === "submitted");
  const active = submitted.find((r) => r.id === selected) ?? submitted[0];
  function review(status: "verified" | "returned") {
    if (!active) return;
    try {
      const r = reviewRecord(active, status, note, actor, role, policy);
      if (
        update(
          (s) => ({
            ...s,
            records: s.records.map((x) => (x.id === r.id ? r : x)),
          }),
          status === "verified"
            ? "Verifikasi lokal"
            : "Kembalikan untuk perbaikan",
          r.id,
          active,
          r,
        )
      ) {
        notify(
          status === "verified"
            ? "Verifikasi lokal disimpan. Status target mengikuti kelayakan master dan sampel."
            : "Laporan dikembalikan untuk revisi.",
        );
        setNote("");
        setPolicy("");
      }
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <>
      <Heading eyebrow="PENJAMINAN MUTU" title="Verifikasi Komite Mutu">
        Tinjau kelengkapan, sumber, dan konsistensi data sebelum verifikasi
        lokal.
      </Heading>
      <div className="alert info">
        Verifikasi lokal adalah catatan alur kerja dalam browser, bukan tanda
        tangan atau persetujuan digital yang aman.
      </div>
      <div className="two-columns">
        <Panel title={`Antrean diajukan · ${submitted.length}`}>
          {!submitted.length ? (
            <Empty title="Tidak ada laporan dalam antrean" />
          ) : (
            <div className="review-list">
              {submitted.map((r) => (
                <button
                  key={r.id}
                  className={r.id === active?.id ? "selected" : ""}
                  onClick={() => {
                    setSelected(r.id);
                    setNote("");
                    setPolicy("");
                  }}
                >
                  <span className="code">
                    {r.indicatorId} · {unitName(r.unitId)}
                  </span>
                  <strong>{r.snapshot.title}</strong>
                  <small>
                    {r.month}/{r.year} · {r.numerator}/{r.denominator} ·{" "}
                    {fmt(percentage(r.numerator, r.denominator))}%
                  </small>
                </button>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Tinjauan laporan">
          {active ? (
            <div className="form-content">
              <h3>{active.snapshot.title}</h3>
              <p>
                Unit {unitName(active.unitId)} · {active.month}/{active.year} ·{" "}
                {active.numerator}/{active.denominator}
              </p>
              <p>
                Target versi v{active.snapshot.version}:{" "}
                {active.snapshot.effectiveTargetPct ?? "belum disahkan"} ·
                Metode: {active.sampleMethod || "belum diisi"}
              </p>
              <p>
                Sumber: {active.sourceNote || "Belum dikonfigurasi"} · Bukti:{" "}
                {active.evidenceReference || "Belum dicantumkan"}
              </p>
              <small>
                Asal perangkat {active.originDeviceId} · revisi{" "}
                {active.revision}
              </small>
              {active.overlapRisk && (
                <div className="alert warning">
                  Sumber berpotensi tumpang tindih. Tidak dimasukkan ke agregat
                  final.
                </div>
              )}
              {active.denominator < active.snapshot.minSample &&
                active.denominator > 0 && (
                  <div className="alert warning">
                    Sampel belum memenuhi ketentuan. Tanpa kebijakan tindak
                    lanjut tertulis, hasil tidak menjadi capaian final.
                  </div>
                )}
              <label>
                Label peninjau
                <input
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                />
              </label>
              <label>
                Temuan & catatan verifikasi (wajib)
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <label>
                Kebijakan tindak lanjut sampel (jika diperlukan)
                <textarea
                  value={policy}
                  onChange={(e) => setPolicy(e.target.value)}
                  placeholder="Dasar kebijakan Komite Mutu dan tindak lanjut, bukan alasan klinis buatan"
                />
              </label>
              <div className="toolbar-actions">
                <button className="button" onClick={() => review("returned")}>
                  <RotateCcw size={16} />
                  Perlu perbaikan
                </button>
                <button
                  className="button primary"
                  onClick={() => review("verified")}
                >
                  <Check size={16} />
                  Verifikasi lokal
                </button>
              </div>
              <Link className="text-link" to={`/input?record=${active.id}`}>
                Lihat / edit data sumber →
              </Link>
            </div>
          ) : (
            <Empty title="Pilih laporan diajukan" />
          )}
        </Panel>
      </div>
      <Panel title="Status seluruh laporan">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Indikator / unit</th>
                <th>Periode</th>
                <th>Status</th>
                <th>Peninjau lokal</th>
                <th>Catatan</th>
                <th>Asal</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.indicatorId}
                    <small>{unitName(r.unitId)}</small>
                  </td>
                  <td>
                    {r.month}/{r.year}
                  </td>
                  <td>
                    <Badge status={recordStatus(r, r.snapshot)} />
                  </td>
                  <td>{r.reviewer || "—"}</td>
                  <td>{r.reviewNote || "—"}</td>
                  <td>
                    {r.originDeviceId.slice(0, 8)} · r{r.revision}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
