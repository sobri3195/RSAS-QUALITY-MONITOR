import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Heading, Panel, Empty } from "../../components/ui";
import { useWorkflow } from "../../features/workflow/WorkflowProvider";
import { assignedTo, calculate } from "../../features/workflow/rules";
import {
  emptyMeasurement,
  statuses,
  statusNames,
  type Measurement,
  type Submission,
  type Transition,
} from "../../features/workflow/types";
export function SubmissionInput() {
  const { data } = useWorkflow();
  const [params] = useSearchParams();
  const record = data?.submissions.find((s) => s.id === params.get("id"));
  if (params.get("id") && !record)
    return <Empty title="Pengajuan tidak ditemukan atau tidak dapat diakses" />;
  return <InputForm key={record?.id ?? "new"} record={record} />;
}
function InputForm({ record }: { record?: Submission }) {
  const { data, profile, repo, run, busy, demo } = useWorkflow();
  const [, setParams] = useSearchParams();
  const [unit, setUnit] = useState(
    record?.unit_id ??
      data!.assignments.find((a) => a.user_id === profile!.id)?.unit_id ??
      "",
  );
  const [indicator, setIndicator] = useState(
    record?.indicator_id ??
      data!.indicators.find(
        (i) =>
          i.active && assignedTo(data!.assignments, profile!.id, unit, i.id),
      )?.id ??
      "",
  );
  const [period, setPeriod] = useState(
    record?.period.slice(0, 7) ?? new Date().toISOString().slice(0, 7),
  );
  const [values, setValues] = useState<Measurement>(
    record?.data ?? { ...emptyMeasurement },
  );
  const [expected, setExpected] = useState(record?.lock_version ?? 0);
  const [id] = useState(record?.id ?? crypto.randomUUID());
  const [confirmation, setConfirmation] = useState(false);
  const version = data!.versions
    .filter(
      (v) =>
        v.indicator_id === indicator &&
        data!.targets.some(
          (t) =>
            t.version_id === v.id &&
            t.period === `${period}-01` &&
            t.target !== null,
        ),
    )
    .sort((a, b) => b.version - a.version)[0];
  const definition = record?.snapshot.definition ?? version?.config;
  const target =
    record?.snapshot.target ??
    data!.targets.find(
      (t) => t.version_id === version?.id && t.period === `${period}-01`,
    )?.target;
  const locked =
    record &&
    !(
      ["DRAFT", "NEEDS_REVISION", "NEEDS_CLARIFICATION"].includes(
        record.status,
      ) && record.created_by === profile!.id
    );
  const cacheKey = `rsas-offline-draft:${profile!.id}:${unit}:${indicator}:${period}`;
  let calculated: number | null = null;
  let validation = "";
  if (definition)
    try {
      calculated = calculate(definition, values);
    } catch (e) {
      validation = (e as Error).message;
    }
  async function save(submit = false) {
    const saved = await run(
      async () => {
        if (!definition)
          throw Error("Definisi/target periode belum disahkan Admin.");
        calculate(definition, values, submit);
        const draft = await repo!.saveDraft({
          id,
          unit_id: unit,
          indicator_id: indicator,
          period: `${period}-01`,
          data: values,
          expected_version: expected,
        });
        setExpected(draft.lock_version);
        if (submit) return repo!.transition(draft, "submit", "");
        return draft;
      },
      submit ? "Pengajuan dikirim ke Validator." : "Draft disimpan.",
    );
    if (saved) {
      localStorage.removeItem(cacheKey);
      setParams({ id: saved.id });
    }
  }
  return (
    <>
      <Heading eyebrow="PELAPORAN UNIT" title="Input Data Unit">
        Draft → Validator → Tim Mutu → Diterbitkan. Jangan masukkan identitas
        pasien.
      </Heading>
      {record && (
        <div className="alert info">
          {statusNames[record.status]} · Revisi {record.revision_no} · Versi
          data {record.lock_version} ·{" "}
          <Link to={`/workflow/submissions/${record.id}`}>
            Lihat Riwayat Validasi
          </Link>
        </div>
      )}
      <Panel title="Pengukuran periode">
        <form
          className="form-content"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={busy || Boolean(locked)}>
            <div className="form-grid">
              <label>
                Unit pelapor
                <select
                  aria-label="Unit pelapor"
                  value={unit}
                  disabled={Boolean(record)}
                  onChange={(e) => {
                    setUnit(e.target.value);
                    setIndicator("");
                  }}
                >
                  {data!.units
                    .filter(
                      (u) =>
                        u.active &&
                        data!.assignments.some(
                          (a) =>
                            a.user_id === profile!.id && a.unit_id === u.id,
                        ),
                    )
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Indikator pengajuan
                <select
                  aria-label="Indikator pengajuan"
                  required
                  value={indicator}
                  disabled={Boolean(record)}
                  onChange={(e) => {
                    setIndicator(e.target.value);
                    setValues({ ...emptyMeasurement });
                  }}
                >
                  <option value="">Pilih indikator</option>
                  {data!.indicators
                    .filter(
                      (i) =>
                        i.active &&
                        assignedTo(
                          data!.assignments,
                          profile!.id,
                          unit,
                          i.id,
                        ) &&
                        data!.indicator_units.some(
                          (a) => a.indicator_id === i.id && a.unit_id === unit,
                        ),
                    )
                    .map((i) => (
                      <option value={i.id} key={i.id}>
                        {i.code} · {i.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Periode pengajuan
                <input
                  aria-label="Periode pengajuan"
                  type="month"
                  min="2020-01"
                  max="2100-12"
                  required
                  disabled={Boolean(record)}
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                />
              </label>
            </div>
            {definition ? (
              <>
                <div className="alert info">
                  {definition.definition}
                  <br />
                  Versi definisi {record?.snapshot.version ??
                    version?.version}{" "}
                  · Target {target ?? "belum disahkan"} {definition.unit_label}{" "}
                  · {definition.direction} · {definition.source}
                  <br />
                  Inklusi: {definition.inclusion || "—"} · Eksklusi:{" "}
                  {definition.exclusion || "—"}
                </div>
                <label>
                  Jenis pelaporan
                  <select
                    aria-label="Jenis pelaporan"
                    value={values.kind}
                    onChange={(e) => {
                      const kind = e.target.value as Measurement["kind"];
                      setValues({
                        ...values,
                        kind,
                        numerator: null,
                        denominator: null,
                        value: null,
                        reason_code:
                          kind === "no_cases"
                            ? "NO_ELIGIBLE_CASES"
                            : kind === "not_applicable"
                              ? "NOT_APPLICABLE"
                              : kind === "missing"
                                ? "AWAITING_DATA"
                                : "",
                      });
                    }}
                  >
                    <option value="measured">
                      Ada pengukuran (termasuk nilai 0)
                    </option>
                    <option value="no_cases">Tidak ada kasus eligible</option>
                    <option value="not_applicable">Tidak berlaku (N/A)</option>
                    <option value="missing">Belum ada data (draft saja)</option>
                  </select>
                </label>
                {values.kind === "measured" ? (
                  <div className="form-grid">
                    {(definition.measurement === "proportion" ||
                    definition.measurement === "rate"
                      ? (["numerator", "denominator"] as const)
                      : (["value"] as const)
                    ).map((key) => (
                      <label key={key}>
                        {key === "numerator"
                          ? "Numerator pengajuan"
                          : key === "denominator"
                            ? "Denominator pengajuan"
                            : `Nilai (${definition.unit_label})`}
                        <input
                          aria-label={
                            key === "numerator"
                              ? "Numerator pengajuan"
                              : key === "denominator"
                                ? "Denominator pengajuan"
                                : `Nilai (${definition.unit_label})`
                          }
                          type="number"
                          min="0"
                          max="1000000000000"
                          step={definition.measurement === "time" ? "any" : "1"}
                          value={values[key] ?? ""}
                          onChange={(e) =>
                            setValues({
                              ...values,
                              [key]:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                        />
                        <small>
                          {key === "numerator"
                            ? definition.numerator_label
                            : key === "denominator"
                              ? definition.denominator_label
                              : "Nilai sesuai definisi indikator."}
                        </small>
                      </label>
                    ))}
                  </div>
                ) : (
                  <label>
                    Alasan terstruktur ({values.reason_code})
                    <textarea
                      required
                      value={values.reason}
                      maxLength={2000}
                      onChange={(e) =>
                        setValues({ ...values, reason: e.target.value })
                      }
                    />
                  </label>
                )}
                <div className="calculator">
                  <span>Hasil kalkulasi otomatis</span>
                  <strong>
                    {calculated === null
                      ? "N/A"
                      : `${calculated.toLocaleString("id-ID", { maximumFractionDigits: 3 })} ${definition.unit_label}`}
                  </strong>
                  {validation && <p role="alert">{validation}</p>}
                </div>
                <label>
                  Catatan agregat (tanpa identitas pasien)
                  <textarea
                    aria-label="Catatan agregat (tanpa identitas pasien)"
                    value={values.notes}
                    maxLength={4000}
                    onChange={(e) =>
                      setValues({ ...values, notes: e.target.value })
                    }
                  />
                </label>
                <label>
                  Anotasi intervensi pada grafik
                  <input
                    aria-label="Anotasi intervensi pada grafik"
                    value={values.intervention}
                    maxLength={1000}
                    onChange={(e) =>
                      setValues({ ...values, intervention: e.target.value })
                    }
                  />
                </label>
                <div className="toolbar-actions">
                  <button className="button" type="submit">
                    Simpan draft pengajuan
                  </button>
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => void save(true)}
                  >
                    Ajukan ke Validator
                  </button>
                </div>
                <div className="toolbar-actions">
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      localStorage.setItem(cacheKey, JSON.stringify(values));
                      alert(
                        "Cadangan draft non-sensitif tersimpan di browser ini; belum masuk data resmi.",
                      );
                    }}
                  >
                    Simpan draft offline non-sensitif
                  </button>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      try {
                        const raw = localStorage.getItem(cacheKey);
                        if (!raw) throw Error("Tidak ada cadangan draft.");
                        const parsed = JSON.parse(raw) as Measurement;
                        calculate(definition, parsed);
                        setValues(parsed);
                      } catch (e) {
                        alert((e as Error).message);
                      }
                    }}
                  >
                    Pulihkan draft offline
                  </button>
                </div>
              </>
            ) : (
              <div className="alert warning">
                Belum ada definisi dan target sah untuk periode ini. Minta Admin
                mengonfigurasi master.
              </div>
            )}
          </fieldset>
        </form>
      </Panel>
      {record && (
        <Panel title="Bukti pengukuran privat">
          <div className="form-content">
            <p>
              PDF/PNG/JPEG, maksimal 5 MB. Berkas tidak boleh memuat identitas
              pasien atau informasi sensitif.
            </p>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={confirmation}
                onChange={(e) => setConfirmation(e.target.checked)}
              />
              Saya memastikan bukti hanya berisi data agregat non-sensitif.
            </label>
            <label>
              Upload bukti aman
              <input
                aria-label="Upload bukti aman"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                disabled={!confirmation || busy || Boolean(locked)}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void run(
                      () => repo!.upload(record, file),
                      demo
                        ? "Bukti DEMO disimpan di browser ini."
                        : "Bukti privat diunggah.",
                    );
                  e.target.value = "";
                }}
              />
            </label>
            <Link to={`/workflow/submissions/${record.id}`}>
              Lihat bukti dan riwayat
            </Link>
          </div>
        </Panel>
      )}
    </>
  );
}
export function SubmissionList({
  kind = "mine",
}: {
  kind?: "mine" | "validator" | "mutu";
}) {
  const { data, profile } = useWorkflow();
  const [unit, setUnit] = useState("");
  const [indicator, setIndicator] = useState("");
  const [status, setStatus] = useState("");
  const [sender, setSender] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const queue =
    kind === "validator"
      ? ["SUBMITTED", "RESUBMITTED", "UNDER_VALIDATION"]
      : kind === "mutu"
        ? ["PENDING_MUTU"]
        : null;
  const records = data!.submissions.filter(
    (s) =>
      (kind !== "mine" || s.created_by === profile!.id) &&
      (!queue || queue.includes(s.status)) &&
      (!unit || s.unit_id === unit) &&
      (!indicator || s.indicator_id === indicator) &&
      (!status || s.status === status) &&
      (!sender || s.created_by === sender) &&
      (!from || s.period >= `${from}-01`) &&
      (!to || s.period <= `${to}-01`),
  );
  return (
    <>
      <Heading
        eyebrow="ALUR PERSETUJUAN"
        title={
          kind === "validator"
            ? "Inbox Validator"
            : kind === "mutu"
              ? "Inbox Tim Mutu"
              : "Pengajuan Saya"
        }
      >
        Setiap keputusan menyimpan aktor, waktu, alasan, dan versi data.{" "}
        {kind === "mutu" &&
          "Hanya publikasi Tim Mutu yang masuk laporan resmi."}
      </Heading>
      <div className="global-filters no-print workflow-filters">
        <label>
          Filter unit
          <select
            aria-label="Filter unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="">Semua unit</option>
            {data!.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Filter indikator
          <select
            aria-label="Filter indikator"
            value={indicator}
            onChange={(e) => setIndicator(e.target.value)}
          >
            <option value="">Semua indikator</option>
            {data!.indicators.map((i) => (
              <option key={i.id} value={i.id}>
                {i.code}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status pengajuan
          <select
            aria-label="Status pengajuan"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Semua status</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusNames[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pengirim
          <select
            aria-label="Pengirim"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
          >
            <option value="">Semua pengirim</option>
            {data!.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dari bulan
          <input
            aria-label="Dari bulan"
            type="month"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Sampai bulan
          <input
            aria-label="Sampai bulan"
            type="month"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <Panel title={`${records.length} pengajuan`}>
        {!records.length ? (
          <Empty title="Tidak ada pengajuan pada filter ini" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Indikator / unit</th>
                  <th>Periode</th>
                  <th>Nilai</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {records.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.snapshot.code}
                      <small>
                        {data!.units.find((u) => u.id === s.unit_id)?.name}
                      </small>
                    </td>
                    <td>{s.period.slice(0, 7)}</td>
                    <td>
                      {s.result?.toLocaleString("id-ID") ?? "N/A"}{" "}
                      {s.snapshot.definition.unit_label}
                    </td>
                    <td>
                      <span className="badge info">
                        {statusNames[s.status]}
                      </span>
                    </td>
                    <td>
                      <progress
                        max={4}
                        value={
                          s.status === "PUBLISHED"
                            ? 4
                            : s.status === "PENDING_MUTU"
                              ? 3
                              : s.status === "UNDER_VALIDATION"
                                ? 2
                                : s.status === "SUBMITTED" ||
                                    s.status === "RESUBMITTED"
                                  ? 1
                                  : 0
                        }
                      />{" "}
                      r{s.revision_no}
                    </td>
                    <td>
                      <Link
                        className="text-link"
                        to={`/workflow/submissions/${s.id}`}
                      >
                        Lihat Riwayat Validasi
                      </Link>
                      {s.created_by === profile!.id && (
                        <Link
                          className="text-link"
                          to={`/unit/input?id=${s.id}`}
                        >
                          Buka pengajuan
                        </Link>
                      )}
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
export function SubmissionDetail() {
  const { id } = useParams();
  const { data, profile, repo, run, busy } = useWorkflow();
  const [note, setNote] = useState("");
  const s =
    data!.submissions.find((s) => s.id === id) ??
    data!.official.find((s) => s.id === id);
  if (!s) return <Empty title="Pengajuan tidak ditemukan atau akses ditolak" />;
  const events = data!.audit
    .filter((a) => a.submission_id === s.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const decisions: [Transition, string][] = [];
  if (
    profile!.role === "validator" &&
    assignedTo(data!.assignments, profile!.id, s.unit_id, s.indicator_id) &&
    s.created_by !== profile!.id
  ) {
    if (["SUBMITTED", "RESUBMITTED"].includes(s.status))
      decisions.push(["start_validation", "Mulai validasi"]);
    if (s.status === "UNDER_VALIDATION")
      decisions.push(
        ["reject", "Kembalikan untuk revisi"],
        ["approve", "Setujui → Tim Mutu"],
      );
  }
  if (profile!.role === "mutu" && s.status === "PENDING_MUTU")
    decisions.push(
      ["clarify", "Minta klarifikasi"],
      ["publish", "Terbitkan data resmi"],
    );
  if (
    profile!.role === "unit" &&
    s.created_by === profile!.id &&
    s.status === "PUBLISHED"
  )
    decisions.push(["amend", "Buat amendemen"]);
  return (
    <>
      <Heading eyebrow="DETAIL PENGAJUAN" title={s.snapshot.code}>
        {s.snapshot.name} · {s.period.slice(0, 7)} · {s.unit_id}
      </Heading>
      <Panel title={statusNames[s.status]}>
        <div className="form-content">
          <div className="form-grid">
            <div>
              <b>Hasil</b>
              <p>
                {s.result ?? "N/A"} {s.snapshot.definition.unit_label}
              </p>
              <p>
                Numerator {s.data.numerator ?? "—"} / denominator{" "}
                {s.data.denominator ?? "—"}
              </p>
            </div>
            <div>
              <b>Target tersimpan</b>
              <p>
                {s.snapshot.target}
                {s.snapshot.target_upper !== null
                  ? ` – ${s.snapshot.target_upper}`
                  : ""}{" "}
                {s.snapshot.definition.unit_label}
              </p>
              <p>{s.snapshot.definition.direction}</p>
            </div>
            <div>
              <b>Versi</b>
              <p>
                Definisi v{s.snapshot.version} · Revisi {s.revision_no} · Data{" "}
                {s.lock_version}
              </p>
              <p>Diubah {new Date(s.updated_at).toLocaleString("id-ID")}</p>
            </div>
          </div>
          <p>{s.snapshot.definition.definition}</p>
          <p>{s.data.notes || "Tanpa catatan tambahan"}</p>
          {s.data.kind !== "measured" && (
            <p>
              {s.data.kind} · {s.data.reason_code} · {s.data.reason}
            </p>
          )}
          <div>
            <b>Bukti privat</b>
            {data!.evidence
              .filter((e) => e.submission_id === s.id)
              .map((e) => (
                <button
                  key={e.id}
                  className="text-link"
                  onClick={() =>
                    void run(async () => {
                      const url = await repo!.evidenceUrl(e);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "bukti-agregat";
                      a.rel = "noopener";
                      a.click();
                      if (url.startsWith("blob:"))
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }, "Tautan unduhan bukti berlaku 60 detik pada Supabase.")
                  }
                >
                  Unduh {e.mime_type} ({Math.ceil(e.size_bytes / 1024)} KB)
                </button>
              ))}
            {!data!.evidence.some((e) => e.submission_id === s.id) && (
              <p>Tidak ada berkas bukti.</p>
            )}
          </div>
          {!!decisions.length && (
            <>
              <label>
                Catatan keputusan / alasan
                <textarea
                  aria-label="Catatan keputusan / alasan"
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <div className="toolbar-actions">
                {decisions.map(([action, label]) => (
                  <button
                    key={action}
                    className={`button ${action === "publish" || action === "approve" ? "primary" : ""}`}
                    disabled={busy || !note.trim()}
                    onClick={() =>
                      void run(
                        () => repo!.transition(s, action, note),
                        "Keputusan disimpan.",
                      )
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          {profile!.role === "unit" &&
            s.created_by === profile!.id &&
            s.status !== "PUBLISHED" && (
              <Link className="button" to={`/unit/input?id=${s.id}`}>
                Edit draft / revisi
              </Link>
            )}
        </div>
      </Panel>
      <Panel title="Riwayat Validasi">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aktor</th>
                <th>Transisi</th>
                <th>Versi</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.created_at).toLocaleString("id-ID")}</td>
                  <td>
                    {data!.profiles.find((p) => p.id === e.actor_id)
                      ?.display_name ?? e.actor_id}
                  </td>
                  <td>
                    {e.before_state?.status ?? "Baru"} → {e.action}
                  </td>
                  <td>{e.after_state?.lock_version ?? "—"}</td>
                  <td>{e.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Snapshot revisi (tidak ditimpa)">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Versi data</th>
                <th>Status</th>
                <th>Nilai</th>
                <th>Definisi / target</th>
              </tr>
            </thead>
            <tbody>
              {data!.revisions
                .filter((r) => r.submission_id === s.id)
                .sort((a, b) => b.payload.lock_version - a.payload.lock_version)
                .map((r) => (
                  <tr key={r.id}>
                    <td>{r.payload.lock_version}</td>
                    <td>{r.payload.status}</td>
                    <td>{r.payload.result ?? "N/A"}</td>
                    <td>
                      v{r.payload.snapshot.version} /{" "}
                      {r.payload.snapshot.target}
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
