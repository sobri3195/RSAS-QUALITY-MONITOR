import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Save, Settings2 } from "lucide-react";
import { useStore } from "../app/store";
import { units, assigned } from "../features/indicators/indicatorService";
import { indicatorSchema, type Indicator } from "../types";
import { Heading, Panel, Badge, SearchBox } from "../components/ui";
import {
  recordStatus,
  fmt,
  months,
  percentage,
} from "../features/analytics/analyticsService";
import { TrendChart } from "../components/Charts";
const metadataLabels = {
  numeratorDefinition: "Definisi numerator",
  denominatorDefinition: "Definisi denominator",
  definition: "Definisi operasional",
  inclusion: "Kriteria inklusi",
  exclusion: "Kriteria eksklusi",
  sampleRule: "Ketentuan sampel",
  collectionMethod: "Metode pengumpulan",
  dataSource: "Sumber data",
  instrument: "Instrumen",
  pic: "Penanggung jawab",
  sourceReference: "Referensi sumber",
};
export default function Master() {
  const { state, role, update, notify } = useStore();
  const [search, setSearch] = useState("");
  const [id, setId] = useState("IMP-RS-06");
  const selected = state.indicators.find((i) => i.id === id)!;
  return (
    <>
      <Heading
        eyebrow="TATA KELOLA DATA"
        title="Master Indikator"
        actions={<span className="tag">34 INDIKATOR · SUMBER 2026</span>}
      >
        Target sumber dipertahankan. Pengesahan hanya berlaku untuk laporan baru
        atau laporan yang diedit ulang.
      </Heading>
      {role !== "Admin/Pimpinan" && (
        <div className="alert info">
          Mode baca. Pilih persona Admin/Pimpinan untuk menyunting master dan
          penugasan. Persona lokal bukan autentikasi.
        </div>
      )}
      <div className="master-layout">
        <Panel title="Daftar indikator">
          <div className="padded">
            <SearchBox value={search} onChange={setSearch} />
          </div>
          <div className="master-list">
            {state.indicators
              .filter((i) =>
                `${i.id} ${i.title}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((i) => (
                <button
                  key={i.id}
                  className={i.id === id ? "selected" : ""}
                  onClick={() => setId(i.id)}
                >
                  <span className="code">
                    {i.id}
                    {!i.officialCode ? " · internal" : ""}
                  </span>
                  <strong>{i.title}</strong>
                  <Badge status={recordStatus(undefined, i)} />
                </button>
              ))}
          </div>
        </Panel>
        <MasterEditor
          key={`${selected.id}-${selected.version}`}
          indicator={selected}
        />
      </div>
      <Panel
        title="Penugasan indikator rumah sakit"
        subtitle="Tidak ada penugasan RS otomatis. Pilih unit yang benar-benar melakukan observasi."
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                {state.indicators
                  .filter((i) => i.kind === "rumah_sakit")
                  .map((i) => (
                    <th title={i.title} key={i.id}>
                      {i.id}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <th>{u.name}</th>
                  {state.indicators
                    .filter((i) => i.kind === "rumah_sakit")
                    .map((i) => (
                      <td key={i.id}>
                        <input
                          type="checkbox"
                          aria-label={`Tugaskan ${i.id} ke ${u.name}`}
                          disabled={role !== "Admin/Pimpinan"}
                          checked={assigned(i, u.id, state.assignments)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            if (
                              update(
                                (s) => ({
                                  ...s,
                                  assignments: {
                                    ...s.assignments,
                                    [u.id]: checked
                                      ? [...(s.assignments[u.id] ?? []), i.id]
                                      : (s.assignments[u.id] ?? []).filter(
                                          (x) => x !== i.id,
                                        ),
                                  },
                                }),
                                "Ubah penugasan",
                                i.id,
                                state.assignments[u.id],
                                { unitId: u.id, assigned: checked },
                              )
                            )
                              notify("Penugasan diperbarui.");
                          }}
                        />
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
function MasterEditor({ indicator: i }: { indicator: Indicator }) {
  const { role, update, notify } = useStore();
  const [form, setForm] = useState(i);
  const [target, setTarget] = useState(
    i.effectiveTargetPct === null ? "" : String(i.effectiveTargetPct),
  );
  const [reason, setReason] = useState("");
  const [actor, setActor] = useState("");
  const readonly = role !== "Admin/Pimpinan";
  return (
    <Panel
      title="Profil & pengesahan master"
      subtitle={`${i.id} · versi ${i.version}`}
      actions={<Settings2 size={18} />}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (readonly) return;
          if (!actor.trim() || !reason.trim()) {
            notify("Alasan perubahan dan label pengesah wajib diisi.");
            return;
          }
          const result = indicatorSchema.safeParse({
            ...form,
            effectiveTargetPct: target.trim() === "" ? null : Number(target),
            targetVerification:
              target.trim() === "" ? "perlu_verifikasi" : "disahkan",
            version: i.version + 1,
          });
          if (!result.success) {
            notify("Profil tidak valid. Target harus 0–100.");
            return;
          }
          if (
            result.data.profileStatus === "tersedia" &&
            (!form.numeratorDefinition.trim() ||
              !form.denominatorDefinition.trim())
          ) {
            notify(
              "Profil tersedia harus memiliki definisi numerator dan denominator.",
            );
            return;
          }
          if (
            update(
              (s) => ({
                ...s,
                indicators: s.indicators.map((x) =>
                  x.id === i.id ? result.data : x,
                ),
              }),
              "Perubahan master / pengesahan target",
              i.id,
              { oldValue: i, actorLabel: actor },
              {
                newValue: result.data,
                reason,
                actorLabel: actor,
                effectiveAt: new Date().toISOString(),
                policy:
                  "Berlaku pada laporan baru/yang diedit; snapshot historis dipertahankan",
              },
            )
          )
            notify("Master disimpan. Profil historis tidak diubah.");
        }}
      >
        <fieldset disabled={readonly}>
          <div className="form-content">
            <div className="master-targets">
              <div>
                <span>Target master sumber</span>
                <b>{fmt(i.targetMasterPct, 0)}%</b>
              </div>
              <div>
                <span>Target profil sumber</span>
                <b>
                  {i.targetProfilePct === null
                    ? "Belum tersedia"
                    : `${fmt(i.targetProfilePct, 0)}%`}
                </b>
              </div>
              <div>
                <span>Target efektif</span>
                <b>
                  {i.effectiveTargetPct === null
                    ? "Belum disahkan"
                    : `${fmt(i.effectiveTargetPct, 0)}%`}
                </b>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Target efektif disahkan (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="Kosong = unresolved"
                />
              </label>
              <label>
                Status profil
                <select
                  value={form.profileStatus}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      profileStatus: e.target
                        .value as Indicator["profileStatus"],
                    })
                  }
                >
                  <option value="tersedia">Tersedia</option>
                  <option value="belum_tersedia">Belum tersedia</option>
                </select>
              </label>
            </div>
            {Object.entries(metadataLabels).map(([k, label]) => (
              <label key={k}>
                {label}
                <textarea
                  rows={2}
                  value={form[k as keyof typeof metadataLabels]}
                  placeholder="Belum dikonfigurasi"
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </label>
            ))}
            <div className="form-grid">
              <label>
                Alias sumber (pisahkan koma)
                <input
                  value={form.aliases.join(", ")}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      aliases: e.target.value
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <label>
                Minimal sampel per unit/bulan
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.minSample}
                  onChange={(e) =>
                    setForm({ ...form, minSample: Number(e.target.value) })
                  }
                />
              </label>
              {i.id === "IMP-RS-05" && form.minSample !== 200 && (
                <p className="field-error">
                  Ketentuan sumber: minimal 200 peluang. Perubahan memerlukan
                  alasan kebijakan yang sah.
                </p>
              )}
            </div>
            <p className="helper">
              Formula tetap: numerator / denominator × 100. Kriteria yang belum
              tersedia tidak dibuat otomatis.
            </p>
            <label>
              Alasan & referensi pengesahan (wajib)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <label>
              Label pengesah (wajib)
              <input value={actor} onChange={(e) => setActor(e.target.value)} />
            </label>
          </div>
          <div className="form-footer">
            <button className="button primary">
              <Save size={16} />
              Simpan versi master
            </button>
          </div>
        </fieldset>
      </form>
    </Panel>
  );
}
export function IndicatorDetail() {
  const { id } = useParams();
  const { state } = useStore();
  const i = state.indicators.find((x) => x.id === id);
  const [year, setYear] = useState(2026);
  if (!i)
    return (
      <Heading eyebrow="MASTER" title="Indikator tidak ditemukan">
        <Link to="/master">Kembali ke master</Link>
      </Heading>
    );
  const records = state.records.filter(
    (r) => r.indicatorId === id && r.year === year && r.dataType === "actual",
  );
  return (
    <>
      <Heading
        eyebrow={`${i.id} · ${i.kind === "unit" ? "ID INTERNAL UNIT" : "KODE RESMI RS"}`}
        title={i.title}
      >
        <Link to="/master">Kelola profil</Link> · Target master{" "}
        {i.targetMasterPct}% · target efektif{" "}
        {i.effectiveTargetPct ?? "belum disahkan"}
      </Heading>
      <Panel
        title="Histori 12 bulan"
        actions={
          <input
            aria-label="Tahun histori"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        }
      >
        <TrendChart records={records} indicatorId={i.id} year={year} />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Periode</th>
                <th>Unit</th>
                <th>N / D</th>
                <th>Capaian</th>
                <th>Status</th>
                <th>Versi / asal</th>
                <th>Data sumber</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{months[r.month - 1]}</td>
                  <td>{units.find((u) => u.id === r.unitId)?.name}</td>
                  <td>
                    {r.numerator}/{r.denominator}
                  </td>
                  <td>{fmt(percentage(r.numerator, r.denominator))}%</td>
                  <td>
                    <Badge status={recordStatus(r, i)} />
                  </td>
                  <td>
                    v{r.snapshot.version} · r{r.revision}
                    <small>{r.originDeviceId}</small>
                  </td>
                  <td>
                    {r.sourceNote || "—"}
                    <small>
                      {r.evidenceReference || "Tanpa referensi bukti"}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Profil indikator saat ini">
        <div className="form-content">
          <Badge status={recordStatus(undefined, i)} />
          {Object.entries(metadataLabels).map(([k, label]) => (
            <div className="profile-field" key={k}>
              <span>{label}</span>
              <p>
                {i[k as keyof typeof metadataLabels] || "Belum dikonfigurasi"}
              </p>
            </div>
          ))}
          <p>Alias: {i.aliases.join(", ") || "—"}</p>
        </div>
      </Panel>
      <Panel title="Jejak audit indikator & laporan">
        <div className="audit-list">
          {state.audit
            .filter(
              (a) =>
                a.recordId === id || records.some((r) => r.id === a.recordId),
            )
            .slice()
            .reverse()
            .map((a) => (
              <details key={a.id}>
                <summary>
                  {new Date(a.at).toLocaleString("id-ID")} · {a.action} ·{" "}
                  {a.actorLabel}
                </summary>
                <pre>
                  {JSON.stringify(
                    { before: a.before, after: a.after },
                    null,
                    2,
                  )}
                </pre>
              </details>
            ))}
        </div>
      </Panel>
    </>
  );
}
