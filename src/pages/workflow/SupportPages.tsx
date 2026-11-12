import { useState } from "react";
import { Link } from "react-router-dom";
import { Heading, Panel, Empty } from "../../components/ui";
import { useWorkflow } from "../../features/workflow/WorkflowProvider";
import { DEMO_KEY } from "../../features/workflow/demoRepository";
import { downloadText } from "../../features/workflow/download";
import {
  migrateLegacyDraft,
  readLegacy,
} from "../../features/workflow/legacyMigration";
import { STORAGE_KEY } from "../../lib/storageService";
import type { MonthlyRecord } from "../../types";
import type { CorrectiveAction } from "../../features/workflow/types";
export function WorkflowActions() {
  const { data, profile, repo, run, busy } = useWorkflow();
  const [editing, setEditing] = useState<CorrectiveAction | null>(null);
  const canEdit = ["unit", "mutu"].includes(profile!.role);
  const start = () =>
    setEditing({
      id: crypto.randomUUID(),
      submission_id: data!.submissions[0]?.id ?? "",
      root_cause: "",
      recommendation: "",
      action: "",
      owner: "",
      due_date: new Date().toISOString().slice(0, 10),
      evidence: "",
      evaluation: "",
      status: "OPEN",
      lock_version: 0,
    });
  return (
    <>
      <Heading
        eyebrow="PERBAIKAN BERKELANJUTAN"
        title="Rencana Tindak Lanjut"
        actions={
          canEdit && (
            <button
              className="button primary"
              disabled={!data!.submissions.length}
              onClick={start}
            >
              Buat tindak lanjut mutu
            </button>
          )
        }
      >
        RCA · rekomendasi · pelaksanaan · evaluasi efektivitas. Penutupan
        membutuhkan catatan evaluasi.
      </Heading>
      {editing && (
        <Panel title="Analisis akar masalah & PDCA/PDSA">
          <form
            className="form-content"
            onSubmit={async (e) => {
              e.preventDefault();
              await run(async () => {
                await repo!.saveAction(editing);
                setEditing(null);
              }, "Tindak lanjut disimpan.");
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Pengajuan sumber
                <select
                  aria-label="Pengajuan sumber"
                  value={editing.submission_id}
                  required
                  onChange={(e) =>
                    setEditing({ ...editing, submission_id: e.target.value })
                  }
                >
                  {data!.submissions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.snapshot.code} · {s.unit_id} · {s.period.slice(0, 7)}
                    </option>
                  ))}
                </select>
              </label>
              {(
                [
                  "root_cause",
                  "recommendation",
                  "action",
                  "owner",
                  "evidence",
                  "evaluation",
                ] as const
              ).map((key, i) => (
                <label key={key}>
                  {
                    [
                      "Analisis akar masalah (5 Why/Fishbone)",
                      "Rekomendasi",
                      "Rencana tindakan",
                      "PIC tindakan",
                      "Referensi bukti pelaksanaan non-sensitif",
                      "Evaluasi efektivitas",
                    ][i]
                  }
                  <textarea
                    value={editing[key]}
                    required={
                      key === "action" ||
                      key === "owner" ||
                      (key === "evaluation" && editing.status === "CLOSED")
                    }
                    maxLength={
                      key === "owner" ? 200 : key === "evidence" ? 2000 : 4000
                    }
                    onChange={(e) =>
                      setEditing({ ...editing, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <div className="form-grid">
                <label>
                  Tenggat tindakan
                  <input
                    aria-label="Tenggat tindakan"
                    type="date"
                    required
                    value={editing.due_date}
                    onChange={(e) =>
                      setEditing({ ...editing, due_date: e.target.value })
                    }
                  />
                </label>
                <label>
                  Status tindakan
                  <select
                    aria-label="Status tindakan"
                    value={editing.status}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        status: e.target.value as CorrectiveAction["status"],
                      })
                    }
                  >
                    {["OPEN", "IN_PROGRESS", "CLOSED"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="toolbar-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => setEditing(null)}
                >
                  Batal
                </button>
                <button className="button primary">Simpan rencana mutu</button>
              </div>
            </fieldset>
          </form>
        </Panel>
      )}
      <Panel title={`${data!.actions.length} tindak lanjut`}>
        {!data!.actions.length ? (
          <Empty title="Belum ada tindak lanjut" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Masalah & rekomendasi</th>
                  <th>Tindakan / bukti</th>
                  <th>PIC / tenggat</th>
                  <th>Status</th>
                  <th>Evaluasi</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data!.actions.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.root_cause}
                      <small>{a.recommendation}</small>
                    </td>
                    <td>
                      {a.action}
                      <small>{a.evidence}</small>
                    </td>
                    <td>
                      {a.owner}
                      <small>{a.due_date}</small>
                    </td>
                    <td>{a.status}</td>
                    <td>{a.evaluation || "Belum dievaluasi"}</td>
                    <td>
                      {canEdit && (
                        <button
                          className="text-link"
                          onClick={() => setEditing(a)}
                        >
                          Edit rencana
                        </button>
                      )}
                      <Link to={`/workflow/submissions/${a.submission_id}`}>
                        Lihat sumber
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
export function WorkflowAudit() {
  const { data } = useWorkflow();
  return (
    <>
      <Heading eyebrow="JEJAK PERUBAHAN" title="Audit Trail">
        Catatan server bersifat append-only bagi akun aplikasi. Snapshot angka
        disimpan pada revisi pengajuan.
      </Heading>
      <Panel title="Riwayat sesuai hak akses">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aktor</th>
                <th>Aksi / versi</th>
                <th>Alasan</th>
                <th>Entitas</th>
              </tr>
            </thead>
            <tbody>
              {[...data!.audit]
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.created_at).toLocaleString("id-ID")}</td>
                    <td>
                      {data!.profiles.find((p) => p.id === a.actor_id)
                        ?.display_name ?? a.actor_id}
                    </td>
                    <td>
                      {a.action}
                      <small>
                        {a.before_state?.lock_version ?? "—"} →{" "}
                        {a.after_state?.lock_version ?? "—"}
                      </small>
                    </td>
                    <td>{a.reason}</td>
                    <td>
                      {a.submission_id ? (
                        <Link to={`/workflow/submissions/${a.submission_id}`}>
                          Lihat Riwayat Validasi
                        </Link>
                      ) : (
                        "Konfigurasi"
                      )}
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
export function WorkflowSettings() {
  const { data, profile, demo, repo, run, busy, refresh } = useWorkflow();
  const [legacy, setLegacy] = useState<MonthlyRecord[]>([]);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  function preview(raw: string) {
    try {
      setLegacy(readLegacy(raw));
      setError("");
      setConfirmed(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Heading eyebrow="OPERASIONAL" title="Pengaturan & Migrasi">
        {demo
          ? "DEMO sintetis di browser ini. Produksi memerlukan konfigurasi Supabase."
          : "Data resmi berasal dari Supabase, bukan localStorage."}
      </Heading>
      <Panel title="Konfigurasi & sesi">
        <div className="form-content">
          <p>
            Produksi: isi VITE_DATA_MODE=production, VITE_SUPABASE_URL dan
            VITE_SUPABASE_ANON_KEY (publishable/anon). Jalankan migration SQL di
            proyek Supabase dan aktifkan akun/penugasan melalui Admin.
          </p>
          <p>
            Sesi Auth berada di sessionStorage per tab; draft offline
            non-sensitif dipisahkan dari data resmi. Keluar menutup sesi. Tidak
            ada service role key dalam frontend.
          </p>
          <p>
            Untuk deployment, backup, pengembalian versi dan pengujian
            perangkat: lihat README serta docs/MULTIUSER.md di repositori.
          </p>
          <p>
            Arsip v1 tetap utuh.{" "}
            <Link className="text-link" to="/transfer">
              Buka backup/restore arsip lama
            </Link>
          </p>
        </div>
      </Panel>
      <Panel title="Backup dan migrasi arsip lokal">
        <div className="form-content">
          <div className="toolbar-actions">
            <button
              className="button"
              onClick={() =>
                downloadText(
                  localStorage.getItem(STORAGE_KEY) ?? "{}",
                  "RSAS-arsip-v1-salinan.json",
                  "application/json",
                )
              }
            >
              Unduh salinan mentah arsip v1
            </button>
            <button
              className="button"
              onClick={() => preview(localStorage.getItem(STORAGE_KEY) ?? "{}")}
            >
              Pratinjau arsip browser ini
            </button>
            <button
              className="button"
              onClick={() =>
                downloadText(
                  JSON.stringify(
                    {
                      format: "rsas-workflow-export-v1",
                      exported_at: new Date().toISOString(),
                      demo,
                      scope:
                        "Data terlihat oleh akun; bukan backup server penuh",
                      data,
                    },
                    null,
                    2,
                  ),
                  demo ? "DEMO-workflow.json" : "RSAS-ekspor-sesuai-akses.json",
                  "application/json",
                )
              }
            >
              Ekspor data sesuai akses
            </button>
          </div>
          <label>
            Berkas backup / ekspor v1
            <input
              aria-label="Berkas backup / ekspor v1"
              type="file"
              accept="application/json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 10 * 1024 * 1024) {
                    setError("Berkas maksimal 10 MB.");
                    return;
                  }
                  preview(await f.text());
                }
              }}
            />
          </label>
          <p>
            Migrasi menambahkan DRAFT, tidak pernah menyalin verifikasi lokal
            sebagai publikasi resmi. Master proporsi harus setara dan target
            periode disahkan. Sumber/backup lama tidak ditimpa; konflik ditolak.
            Tindak lanjut dan audit historis tetap tersimpan dalam arsip v1.
          </p>
          {error && (
            <p role="alert" className="alert warning">
              {error}
            </p>
          )}
          {!!legacy.length && (
            <>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Saya sudah mengunduh backup dan meninjau bahwa data agregat
                tidak sensitif.
              </label>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Indikator / unit</th>
                      <th>Periode</th>
                      <th>Jenis / status lama</th>
                      <th>Hasil pratinjau</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legacy.map((r) => {
                      let issue = "Siap sebagai draft";
                      try {
                        migrateLegacyDraft(r, data!);
                      } catch (e) {
                        issue = (e as Error).message;
                      }
                      return (
                        <tr key={r.id}>
                          <td>
                            {r.indicatorId} · {r.unitId}
                          </td>
                          <td>
                            {r.month}/{r.year}
                          </td>
                          <td>
                            {r.dataType} · {r.status}
                          </td>
                          <td>
                            {issue}
                            {profile!.role === "unit" &&
                              issue === "Siap sebagai draft" && (
                                <button
                                  className="button"
                                  disabled={!confirmed || busy || demo}
                                  onClick={() =>
                                    void run(
                                      () =>
                                        repo!.saveDraft(
                                          migrateLegacyDraft(r, data!),
                                        ),
                                      "Arsip disalin sebagai draft; ajukan melalui alur resmi.",
                                    )
                                  }
                                >
                                  Salin sebagai draft
                                </button>
                              )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Panel>
      {demo && (
        <Panel title="Data latihan">
          <div className="form-content">
            <button
              className="button"
              onClick={() =>
                downloadText(
                  localStorage.getItem(DEMO_KEY) ?? "{}",
                  "DEMO-salinan.json",
                  "application/json",
                )
              }
            >
              Unduh salinan DEMO
            </button>
            <button
              className="button"
              onClick={() => {
                if (
                  prompt(
                    "Ketik DEMO untuk reset data sintetis. Arsip lama tidak diubah.",
                  ) !== "DEMO"
                )
                  return;
                localStorage.removeItem(DEMO_KEY);
                void refresh();
              }}
            >
              Reset data DEMO
            </button>
          </div>
        </Panel>
      )}
    </>
  );
}
