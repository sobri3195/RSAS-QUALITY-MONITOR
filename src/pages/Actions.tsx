import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Save } from "lucide-react";
import { useStore } from "../app/store";
import { useFilters, matches } from "../app/filters";
import { alerts } from "../features/analytics/analyticsService";
import { planSchema, type ActionPlan } from "../types";
import { Heading, Panel, Empty } from "../components/ui";
import { unitName } from "../features/indicators/indicatorService";
export default function Actions() {
  const { state, update, notify } = useStore();
  const { filters } = useFilters();
  const [editing, setEditing] = useState<ActionPlan | null>(null);
  const records = state.records.filter((r) => matches(r, filters));
  const notices = alerts(state.records, state.settings.dropThreshold).filter(
    (n) => records.some((r) => r.id === n.record.id),
  );
  const plans = state.plans.filter((p) =>
    records.some((r) => r.id === p.recordId),
  );
  function start() {
    if (!records.length) {
      notify("Masukkan laporan sebelum membuat tindak lanjut.");
      return;
    }
    setEditing({
      id: crypto.randomUUID(),
      recordId: records[0].id,
      problem: "",
      rootCause: "",
      action: "",
      owner: "",
      dueDate: new Date().toISOString().slice(0, 10),
      status: "OPEN",
      evaluation: "",
    });
  }
  return (
    <>
      <Heading
        eyebrow="PERBAIKAN BERKELANJUTAN"
        title="Rencana Tindak Lanjut"
        actions={
          <button className="button primary" onClick={start}>
            <Plus size={16} />
            Buat tindak lanjut
          </button>
        }
      >
        Analisis penyebab diisi oleh tim unit. Notifikasi otomatis hanya
        mendeskripsikan data.
      </Heading>
      <Panel
        title="Prioritas & notifikasi berbasis aturan"
        subtitle={`Ambang penurunan bulanan: ${state.settings.dropThreshold} pp`}
      >
        {notices.length ? (
          <div className="notice-list">
            {notices.map((n, i) => (
              <div key={i}>
                <span className="badge warning">PERHATIAN</span>
                <div>
                  <Link to={`/input?record=${n.record.id}`}>
                    {n.record.indicatorId} · {unitName(n.record.unitId)} ·{" "}
                    {n.record.month}/{n.record.year}
                  </Link>
                  <p>{n.message}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="Belum ada peringatan berbasis data">
            Tidak ada peringatan yang dapat ditarik dari laporan pada filter
            ini. Data kosong tidak berarti mutu telah tercapai.
          </Empty>
        )}
      </Panel>
      {editing && (
        <Panel title="Analisis RCA & siklus PDCA/PDSA">
          <form
            className="form-content"
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = planSchema.safeParse(editing);
              if (!parsed.success) {
                notify("Isi masalah, tindakan, PIC, dan tenggat yang valid.");
                return;
              }
              if (editing.status === "CLOSED" && !editing.evaluation.trim()) {
                notify("Evaluasi wajib diisi sebelum penutupan.");
                return;
              }
              if (
                update(
                  (s) => ({
                    ...s,
                    plans: [
                      ...s.plans.filter((p) => p.id !== editing.id),
                      parsed.data,
                    ],
                  }),
                  "Simpan tindak lanjut",
                  editing.recordId,
                  state.plans.find((p) => p.id === editing.id),
                  parsed.data,
                )
              ) {
                notify("Rencana tindak lanjut disimpan.");
                setEditing(null);
              }
            }}
          >
            <label>
              Laporan sumber
              <select
                value={editing.recordId}
                onChange={(e) =>
                  setEditing({ ...editing, recordId: e.target.value })
                }
              >
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.indicatorId} · {unitName(r.unitId)} · {r.month}/{r.year}
                  </option>
                ))}
              </select>
            </label>
            {(["problem", "rootCause", "action", "evaluation"] as const).map(
              (key, i) => (
                <label key={key}>
                  {
                    [
                      "Masalah / temuan (Plan)",
                      "Analisis akar penyebab · 5 Why / Fishbone",
                      "Tindakan perbaikan (Do)",
                      "Evaluasi (Study/Check), standardisasi (Act), referensi bukti",
                    ][i]
                  }
                  <textarea
                    value={editing[key]}
                    onChange={(e) =>
                      setEditing({ ...editing, [key]: e.target.value })
                    }
                  />
                </label>
              ),
            )}
            <div className="form-grid">
              <label>
                PIC / penanggung jawab
                <input
                  value={editing.owner}
                  onChange={(e) =>
                    setEditing({ ...editing, owner: e.target.value })
                  }
                />
              </label>
              <label>
                Tenggat
                <input
                  type="date"
                  value={editing.dueDate}
                  onChange={(e) =>
                    setEditing({ ...editing, dueDate: e.target.value })
                  }
                />
              </label>
              <label>
                Status
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      status: e.target.value as ActionPlan["status"],
                    })
                  }
                >
                  <option value="OPEN">OPEN · Terbuka</option>
                  <option value="IN PROGRESS">IN PROGRESS · Dikerjakan</option>
                  <option value="CLOSED">CLOSED · Ditutup</option>
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
              <button className="button primary">
                <Save size={16} />
                Simpan tindak lanjut
              </button>
            </div>
          </form>
        </Panel>
      )}
      <Panel title={`Daftar tindak lanjut · ${plans.length}`}>
        {!plans.length ? (
          <Empty title="Belum ada rencana tindak lanjut" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Masalah</th>
                  <th>Tindakan</th>
                  <th>PIC</th>
                  <th>Tenggat</th>
                  <th>Status</th>
                  <th>Evaluasi</th>
                  <th>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.problem}
                      <small>
                        {p.rootCause || "Akar penyebab belum diisi"}
                      </small>
                    </td>
                    <td>{p.action}</td>
                    <td>{p.owner}</td>
                    <td>{p.dueDate}</td>
                    <td>
                      <span
                        className={`badge ${p.status === "CLOSED" ? "terverifikasi_tercapai" : "warning"}`}
                      >
                        {p.status === "OPEN"
                          ? "Terbuka"
                          : p.status === "CLOSED"
                            ? "Ditutup"
                            : "Dikerjakan"}
                      </span>
                    </td>
                    <td>{p.evaluation || "—"}</td>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => setEditing(p)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-link danger-text"
                        onClick={() => {
                          if (confirm("Hapus rencana tindak lanjut ini?"))
                            update(
                              (s) => ({
                                ...s,
                                plans: s.plans.filter((x) => x.id !== p.id),
                              }),
                              "Hapus tindak lanjut",
                              p.recordId,
                              p,
                              undefined,
                            );
                        }}
                      >
                        Hapus
                      </button>
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
