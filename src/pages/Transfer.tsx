import { useState } from "react";
import { Download, Upload, ArrowLeftRight, DatabaseBackup } from "lucide-react";
import { useStore } from "../app/store";
import { units } from "../features/indicators/indicatorService";
import {
  exportBundle,
  parseBundle,
  previewImport,
  mergeBundles,
  download,
  type Bundle,
} from "../lib/importExportService";
import { Heading, Panel, Empty } from "../components/ui";
export default function Transfer() {
  const { state, role, update, replace, notify } = useStore();
  const [unit, setUnit] = useState("UNIT-01");
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [choices, setChoices] = useState<Record<string, "local" | "import">>(
    {},
  );
  const [error, setError] = useState("");
  const [restore, setRestore] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const preview = previewImport(state, bundles);
  const admin = role === "Admin/Pimpinan";
  const conflict = preview.filter((p) => p.conflict);
  const ready = conflict.every((c) => choices[c.key]);
  function clear() {
    setBundles([]);
    setChoices({});
    setConfirmed(false);
    setRestore(false);
  }
  return (
    <>
      <Heading eyebrow="KONSOLIDASI ANTARUNIT" title="Impor / Ekspor Data">
        Pindahkan data agregat dengan JSON. Semua impor dipreview sebelum
        disimpan.
      </Heading>
      <div className="alert info">
        <ArrowLeftRight size={18} />
        <span>
          Data di browser ini, bukan database bersama. Ekspor rutin dan simpan
          backup di lokasi internal yang sesuai.
        </span>
      </div>
      <div className="two-columns">
        <Panel
          title="Ekspor data unit"
          subtitle="Data aktual saja · seluruh periode unit terpilih"
        >
          <div className="form-content">
            <label>
              Unit ekspor
              <select
                aria-label="Unit ekspor"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                {units.map((u) => (
                  <option value={u.id} key={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="helper">
              Memuat master, laporan, tindak lanjut, jejak audit, dan asal
              perangkat. Data simulasi tidak masuk ekspor unit.
            </p>
            <button
              className="button primary"
              onClick={() =>
                download(
                  `rsas-${unit}-${new Date().toISOString().slice(0, 10)}.json`,
                  JSON.stringify(exportBundle(state, unit), null, 2),
                )
              }
            >
              <Download size={16} />
              Ekspor Data Unit JSON
            </button>
          </div>
        </Panel>
        <Panel
          title="Backup seluruh browser"
          subtitle="Termasuk master kustom, penugasan, simulasi, dan audit"
        >
          <div className="form-content">
            <p>
              Backup lengkap digunakan untuk pemulihan. Pemulihan mengganti
              dataset setelah pratinjau dan konfirmasi.
            </p>
            <button
              className="button"
              onClick={() =>
                download(
                  `rsas-backup-${new Date().toISOString().slice(0, 10)}.json`,
                  JSON.stringify(exportBundle(state), null, 2),
                )
              }
            >
              <DatabaseBackup size={16} />
              Unduh backup lengkap
            </button>
            <p className="helper">Perangkat ini: {state.deviceId}</p>
          </div>
        </Panel>
      </div>
      <Panel
        title="Impor Konsolidasi JSON"
        subtitle="Pilih satu atau beberapa berkas. Tidak ada perubahan sebelum Anda mengonfirmasi."
      >
        <div className="form-content">
          {!admin && (
            <div className="alert warning">
              Pilih persona Admin/Pimpinan untuk konsolidasi atau pemulihan. Ini
              kontrol alur kerja lokal.
            </div>
          )}
          <label className="upload-area">
            <Upload size={27} />
            <strong>Pilih berkas JSON unit / backup</strong>
            <span>
              Versi skema 1 · maksimal 10 MB per berkas · hanya data agregat
            </span>
            <input
              aria-label="Berkas impor JSON"
              type="file"
              accept=".json,application/json"
              multiple
              disabled={!admin}
              onChange={async (e) => {
                const files = [...(e.target.files ?? [])];
                clear();
                setError("");
                try {
                  if (files.length > 30)
                    throw Error("Maksimal 30 berkas sekali impor.");
                  const parsed: Bundle[] = [];
                  for (const file of files) {
                    if (file.size > 10 * 1024 * 1024)
                      throw Error(`${file.name}: berkas melebihi 10 MB.`);
                    parsed.push(parseBundle(await file.text()));
                  }
                  setBundles(parsed);
                } catch (err) {
                  setError(
                    `Impor ditolak: ${err instanceof Error ? err.message : "Format tidak valid."}`,
                  );
                }
              }}
            />
          </label>
          {error && (
            <div className="alert warning" role="alert">
              {error}
            </div>
          )}
        </div>
      </Panel>
      {bundles.length > 0 && (
        <Panel
          title="Pratinjau impor"
          subtitle={`${bundles.length} berkas · ${preview.length} laporan · ${conflict.length} konflik · ${preview.filter((p) => p.duplicate).length} duplikat identik`}
        >
          <div className="form-content">
            <div className="alert info">
              Master dan penugasan dari berkas tidak otomatis menimpa master
              lokal. Snapshot profil setiap laporan tetap dipertahankan. Konflik
              tindak lanjut dengan ID sama mempertahankan versi lokal dan
              dicatat dalam audit.
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Indikator / unit / periode</th>
                    <th>Asal perangkat</th>
                    <th>Versi lokal</th>
                    <th>Versi impor</th>
                    <th>Keputusan konflik</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((item) => (
                    <tr key={item.key}>
                      <td>
                        {item.record.indicatorId}
                        <small>
                          {item.record.unitId} · {item.record.month}/
                          {item.record.year}
                        </small>
                      </td>
                      <td>
                        {item.source}
                        <small>Profil v{item.record.snapshot.version}</small>
                      </td>
                      <td>
                        {item.existing
                          ? `${item.existing.numerator}/${item.existing.denominator} · ${item.existing.status} · r${item.existing.revision}`
                          : "—"}
                        <small>{item.existing?.updatedAt}</small>
                      </td>
                      <td>
                        {item.record.numerator}/{item.record.denominator} ·{" "}
                        {item.record.status} · r{item.record.revision}
                        <small>{item.record.updatedAt}</small>
                      </td>
                      <td>
                        {item.conflict ? (
                          <select
                            aria-label={`Konflik ${item.key}`}
                            value={choices[item.key] ?? ""}
                            onChange={(e) =>
                              setChoices({
                                ...choices,
                                [item.key]: e.target.value as
                                  "local" | "import",
                              })
                            }
                          >
                            <option value="">Pilih keputusan…</option>
                            <option value="local">Simpan lokal</option>
                            <option value="import">Gunakan impor</option>
                          </select>
                        ) : item.duplicate ? (
                          "Duplikat · dilewati"
                        ) : (
                          "Laporan baru"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {bundles.length === 1 && bundles[0].state && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={restore}
                  onChange={(e) => {
                    setRestore(e.target.checked);
                    setConfirmed(false);
                  }}
                />
                Pulihkan backup lengkap (GANTI seluruh dataset, master, dan
                penugasan; perangkat lokal dipertahankan)
              </label>
            )}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              {restore
                ? "Saya telah membackup data lokal dan memahami seluruh dataset akan diganti."
                : "Saya telah meninjau sumber data, konflik, serta pilihan penggabungan."}
            </label>
            <div className="toolbar-actions">
              <button className="button" onClick={clear}>
                Batalkan impor
              </button>
              <button
                className="button primary"
                disabled={!admin || !confirmed || (!restore && !ready)}
                onClick={() => {
                  try {
                    if (restore) {
                      if (
                        !confirm(
                          "Konfirmasi pemulihan: ganti seluruh data lokal dengan backup ini?",
                        )
                      )
                        return;
                      if (replace(bundles[0].state!)) {
                        notify(
                          "Backup dipulihkan. Identitas perangkat lokal dipertahankan.",
                        );
                        clear();
                      }
                    } else {
                      if (
                        update(
                          (s) => mergeBundles(s, bundles, choices, role),
                          "Selesai konsolidasi JSON",
                        )
                      ) {
                        notify(
                          "Konsolidasi selesai. Tabel dan grafik telah diperbarui.",
                        );
                        clear();
                      }
                    }
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
              >
                {restore ? "Pulihkan backup" : "Gabungkan data terpilih"}
              </button>
            </div>
            {error && (
              <div role="alert" className="alert warning">
                {error}
              </div>
            )}
          </div>
        </Panel>
      )}
      {!bundles.length && (
        <Empty title="Belum ada berkas yang dipilih">
          Ekspor JSON dari perangkat unit lalu pilih berkas pada perangkat
          konsolidasi.
        </Empty>
      )}
    </>
  );
}
