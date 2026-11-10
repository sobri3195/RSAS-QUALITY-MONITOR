import { Printer, Download } from "lucide-react";
import { useStore } from "../app/store";
import { useFilters, matches } from "../app/filters";
import { reportRows } from "../features/reports/reportService";
import {
  finalEligible,
  fmt,
  recordStatus,
  labels,
} from "../features/analytics/analyticsService";
import { unitName } from "../features/indicators/indicatorService";
import { Heading, Panel, Empty } from "../components/ui";
import { ComparisonChart, TrendChart } from "../components/Charts";
import { download, csvCell } from "../lib/importExportService";
export default function Reports() {
  const { state } = useStore();
  const { filters: f } = useFilters();
  const records = state.records.filter(
    (r) =>
      matches(r, { ...f, dataType: "actual" }) &&
      (f.status === "all" || recordStatus(r, r.snapshot) === f.status),
  );
  const final = records.filter(finalEligible);
  const rows = reportRows(final);
  const excluded = records.filter((r) => !finalEligible(r));
  const plans = state.plans.filter((p) =>
    records.some((r) => r.id === p.recordId),
  );
  const period =
    f.period === "all"
      ? `Tahunan ${f.year}`
      : f.period.startsWith("q")
        ? `Triwulan ${f.period[1]} ${f.year}`
        : `Bulanan ${f.period}/${f.year}`;
  function csv() {
    const data = [
      [
        "Kode",
        "Indikator",
        "Numerator kumulatif",
        "Denominator kumulatif",
        "Capaian (%)",
        "Target (%)",
        "Gap (pp)",
        "Interpretasi",
      ],
      ...rows.map((r) => [
        r.id,
        r.title,
        r.numerator,
        r.denominator,
        fmt(r.value),
        fmt(r.target),
        fmt(r.gap),
        r.interpretation,
      ]),
    ];
    download(
      "rsas-laporan-final.csv",
      "\uFEFF" + data.map((row) => row.map(csvCell).join(";")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <>
      <Heading
        eyebrow="DOKUMEN PIMPINAN"
        title="Laporan Mutu Pelayanan"
        actions={
          <>
            <button className="button" onClick={csv}>
              <Download size={16} />
              CSV laporan final
            </button>
            <button className="button primary" onClick={() => window.print()}>
              <Printer size={16} />
              Cetak / Simpan PDF
            </button>
          </>
        }
      >
        Pilih bulanan, triwulanan, atau tahunan melalui filter periode. Angka
        dihitung dari laporan aktual terverifikasi.
      </Heading>
      <article className="report">
        <div className="report-letterhead">
          <span className="report-monogram">RSAS</span>
          <div>
            <h2>RSAU PROF. DR. ABDULRACHMAN SALEH</h2>
            <p>Sistem Monitoring, Evaluasi, dan Analisis Indikator Mutu</p>
            <strong>LAPORAN {period.toUpperCase()}</strong>
            <p>
              {f.unit === "all" ? "Seluruh unit" : unitName(f.unit)} · Dicetak{" "}
              {new Date().toLocaleString("id-ID", { timeZone: "Asia/Bangkok" })}{" "}
              WIB
            </p>
          </div>
        </div>
        <div className="report-method">
          <h3>Metode & ruang lingkup</h3>
          <p>
            Agregasi per indikator: 100 × Σ numerator / Σ denominator dari
            sumber berdefinisi dan bermetode sama. Tidak merata-ratakan
            persentase bulanan atau menggabungkan indikator berbeda. Denominator
            telah memenuhi kriteria setelah eksklusi. Target mengikuti versi
            profil tiap laporan.
          </p>
          <p>
            {final.length} laporan aktual layak analisis · {excluded.length}{" "}
            laporan di luar perhitungan final · {rows.length} indikator dengan
            sumber final. Verifikasi lokal merupakan catatan pada perangkat,
            bukan autentikasi aman.
          </p>
        </div>
        <h3>Ringkasan capaian per indikator</h3>
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Indikator</th>
                  <th>Σ N / Σ D</th>
                  <th>Capaian</th>
                  <th>Target</th>
                  <th>Gap</th>
                  <th>Interpretasi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.id}
                      <small>{r.title}</small>
                    </td>
                    <td>
                      {r.value === null
                        ? "—"
                        : `${r.numerator}/${r.denominator}`}
                    </td>
                    <td>
                      {fmt(r.value)}
                      {r.value !== null ? "%" : ""}
                    </td>
                    <td>
                      {fmt(r.target)}
                      {r.target !== null ? "%" : ""}
                    </td>
                    <td>{fmt(r.gap)} pp</td>
                    <td>{r.interpretation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
        <ComparisonChart records={final} />
        {rows.slice(0, 1).map((r) => (
          <div key={r.id}>
            <h3>Tren {r.id}</h3>
            <TrendChart
              records={state.records.filter(
                (r) =>
                  r.dataType === "actual" &&
                  (f.unit === "all" || r.unitId === f.unit),
              )}
              indicatorId={r.id}
              year={f.year}
            />
          </div>
        ))}
        <h3>Indikator belum memenuhi target</h3>
        <p>
          {rows
            .filter((r) => r.gap !== null && r.gap < 0)
            .map((r) => `${r.id} (${fmt(r.gap)} pp)`)
            .join("; ") ||
            "Belum ada indikator yang dapat dikategorikan belum memenuhi target pada data final tersedia."}
        </p>
        <h3>Data belum masuk perhitungan final & catatan kualitas</h3>
        <p>
          Target belum disahkan, profil belum lengkap, N/A, sampel belum
          memadai, potensi tumpang tindih, dan laporan belum terverifikasi
          dikecualikan. Sumber lintas unit tanpa konfirmasi kesetaraan tidak
          digabungkan.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Indikator / periode</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Catatan kualitas</th>
              </tr>
            </thead>
            <tbody>
              {excluded.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.indicatorId} · {r.month}/{r.year}
                  </td>
                  <td>{unitName(r.unitId)}</td>
                  <td>{labels[recordStatus(r, r.snapshot)]}</td>
                  <td>
                    {r.overlapRisk ? "Potensi tumpang tindih. " : ""}
                    {r.noEligibleReason ||
                      r.reviewNote ||
                      "Belum memenuhi syarat data final."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Rencana tindak lanjut</h3>
        {plans.length ? (
          plans.map((p) => (
            <p key={p.id}>
              <b>{p.problem}</b> — {p.action}; PIC {p.owner}; tenggat{" "}
              {p.dueDate}; {p.status}; evaluasi {p.evaluation || "belum diisi"}.
            </p>
          ))
        ) : (
          <p>Belum ada rencana tindak lanjut pada periode ini.</p>
        )}
        <h3>Provenance & definisi pengukuran</h3>
        {final.map((r) => (
          <details key={r.id} className="report-provenance">
            <summary>
              {r.indicatorId} · {unitName(r.unitId)} · {r.month}/{r.year} ·{" "}
              {r.numerator}/{r.denominator}
            </summary>
            <p>
              Profil v{r.snapshot.version} · revisi {r.revision} · perangkat
              asal {r.originDeviceId} · peninjau lokal {r.reviewer || "—"} ·
              diperbarui {r.updatedAt}
            </p>
            <p>
              Numerator: {r.snapshot.numeratorDefinition} Denominator:{" "}
              {r.snapshot.denominatorDefinition}
            </p>
            <p>
              Eksklusi: {r.snapshot.exclusion || "Belum dikonfigurasi"} ·
              Metode: {r.sampleMethod} · Referensi: {r.evidenceReference || "—"}
            </p>
            <p>
              Sumber: {r.snapshot.sourceReference} · {r.sourceNote}
            </p>
          </details>
        ))}
        <div className="report-disclaimer">
          Data di browser ini, bukan database bersama. Laporan hanya mencakup
          data aktual tersimpan dan hasil konsolidasi yang telah ditinjau. Data
          simulasi tidak disertakan. Coverage tidak membuktikan seluruh data
          rumah sakit telah masuk.
        </div>
      </article>
      <Panel title="Catatan penggunaan laporan">
        <p className="padded">
          Simpan sebagai PDF melalui dialog cetak browser. Grafik, tabel, dan
          CSV laporan final memakai sumber perhitungan yang sama. Cetak dengan
          orientasi lanskap jika tabel terlalu lebar.
        </p>
      </Panel>
    </>
  );
}
