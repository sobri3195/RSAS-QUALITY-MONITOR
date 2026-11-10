import { useState, useEffect, useEffectEvent } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Save, Send, Trash2, Calculator, Info } from "lucide-react";
import { useStore } from "../app/store";
import { useFilters } from "../app/filters";
import {
  units,
  assigned,
  profileComplete,
} from "../features/indicators/indicatorService";
import {
  months,
  percentage,
  fmt,
  recordStatus,
} from "../features/analytics/analyticsService";
import { recordSchema, type MonthlyRecord, type Indicator } from "../types";
import { saveRecord } from "../features/entries/recordService";
import { Badge, Heading, Panel } from "../components/ui";
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
export default function Input() {
  const { state } = useStore();
  const { filters, setFilters } = useFilters();
  const [params] = useSearchParams();
  const requested = state.records.find((r) => r.id === params.get("record"));
  useEffect(() => {
    if (requested && requested.dataType !== filters.dataType)
      setFilters({ ...filters, dataType: requested.dataType });
  }, [requested, filters, setFilters]);
  const [unit, setUnit] = useState(
    requested?.unitId ??
      params.get("unit") ??
      (filters.unit === "all" ? "UNIT-01" : filters.unit),
  );
  const [indicator, setIndicator] = useState(
    requested?.indicatorId ?? params.get("indicator") ?? "",
  );
  const [year, setYear] = useState(requested?.year ?? filters.year);
  const [month, setMonth] = useState(
    requested?.month ?? (Number(filters.period) || new Date().getMonth() + 1),
  );
  const available = state.indicators.filter(
    (i) =>
      assigned(i, unit, state.assignments) ||
      state.records.some((r) => r.unitId === unit && r.indicatorId === i.id),
  );
  const selected = available.find((i) => i.id === indicator) ?? available[0];
  const existing = state.records.find(
    (r) =>
      r.indicatorId === selected?.id &&
      r.unitId === unit &&
      r.year === year &&
      r.month === month &&
      r.dataType === filters.dataType,
  );
  return (
    <>
      <Heading eyebrow="PELAPORAN BULANAN" title="Input Data Unit">
        Masukkan angka agregat sesuai definisi resmi. Denominator sudah bersih
        dari eksklusi.
      </Heading>
      <div className="alert info">
        <Info size={18} />
        <span>
          Data tersimpan di browser ini. Jangan masukkan nama pasien, NIK, nomor
          rekam medis, atau bukti berisi identitas.
        </span>
      </div>
      <Panel
        title="Pilih unit & periode"
        subtitle="Satu laporan utama untuk setiap indikator, unit, dan bulan."
      >
        <div className="form-grid selection-grid">
          <label>
            Unit pelapor
            <select
              aria-label="Unit pelapor"
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value);
                setIndicator("");
              }}
            >
              {units.map((u) => (
                <option value={u.id} key={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Indikator
            <select
              aria-label="Indikator input"
              value={selected?.id ?? ""}
              onChange={(e) => setIndicator(e.target.value)}
            >
              {available.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.id} · {i.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tahun pengukuran
            <input
              type="number"
              min="2020"
              max="2100"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <label>
            Bulan pengukuran
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {months.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="helper">
          Indikator RS hanya muncul setelah ditugaskan admin melalui{" "}
          <Link to="/master">Master Indikator</Link>.
        </p>
      </Panel>
      {selected ? (
        <Editor
          key={`${unit}|${selected.id}|${year}|${month}|${filters.dataType}`}
          indicator={selected}
          unitId={unit}
          year={year}
          month={month}
          existing={existing}
        />
      ) : (
        <div className="alert warning">
          Tidak ada indikator untuk pilihan ini.
        </div>
      )}
    </>
  );
}
function Editor({
  indicator,
  unitId,
  year,
  month,
  existing,
}: {
  indicator: Indicator;
  unitId: string;
  year: number;
  month: number;
  existing?: MonthlyRecord;
}) {
  const { state, update, notify } = useStore();
  const { filters } = useFilters();
  const [form, setForm] = useState({
    numerator: existing ? String(existing.numerator) : "",
    denominator: existing ? String(existing.denominator) : "",
    excludedCount: String(existing?.excludedCount ?? 0),
    populationSize:
      existing?.populationSize === null || !existing
        ? ""
        : String(existing.populationSize),
    sampleMethod: existing?.sampleMethod ?? "",
    noEligibleReason: existing?.noEligibleReason ?? "",
    sourceNote: existing?.sourceNote ?? "",
    evidenceReference: existing?.evidenceReference ?? "",
    enteredBy: existing?.enteredBy ?? "",
    measuredAt: existing?.measuredAt ?? today(),
    overlapRisk: existing?.overlapRisk ?? false,
    comparabilityNote: existing?.comparabilityNote ?? "",
    categoryText:
      existing?.categories
        .map((c) => `${c.name} | ${c.frequency}`)
        .join("\n") ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState("");
  function change(key: keyof typeof form, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }
  function save(status: "draft" | "submitted", explicit = true) {
    const now = new Date().toISOString();
    const numeric = (v: string) => (v.trim() === "" ? NaN : Number(v));
    const categories = form.categoryText.trim()
      ? form.categoryText
          .split("\n")
          .filter((l) => l.trim())
          .map((line) => {
            const [name, frequency] = line.split("|");
            return { name: name?.trim(), frequency: numeric(frequency ?? "") };
          })
      : [];
    const parsed = recordSchema.safeParse({
      id: existing?.id ?? crypto.randomUUID(),
      indicatorId: indicator.id,
      unitId,
      year,
      month,
      numerator: numeric(form.numerator),
      denominator: numeric(form.denominator),
      excludedCount: numeric(form.excludedCount),
      populationSize:
        form.populationSize === "" ? null : numeric(form.populationSize),
      sampleMethod: form.sampleMethod,
      noEligibleReason: form.noEligibleReason,
      sourceNote: form.sourceNote,
      evidenceReference: form.evidenceReference,
      enteredBy: form.enteredBy,
      measuredAt: form.measuredAt,
      status,
      reviewNote: existing?.reviewNote ?? "",
      reviewer: "",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      revision: (existing?.revision ?? 0) + 1,
      originDeviceId: existing?.originDeviceId ?? state.deviceId,
      dataType: filters.dataType,
      snapshot: dirty || !existing ? indicator : existing.snapshot,
      overlapRisk: form.overlapRisk,
      comparabilityNote: form.comparabilityNote,
      samplePolicyNote: "",
      categories,
    });
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        e[String(issue.path[0])] =
          issue.code === "custom"
            ? issue.message
            : "Isian tidak valid. Gunakan bilangan bulat nonnegatif untuk angka dan tanggal yang valid.";
      setErrors(e);
      if (explicit) notify("Periksa kembali isian yang ditandai.");
      return;
    }
    if (
      status === "submitted" &&
      (!form.enteredBy.trim() || !form.sampleMethod.trim())
    ) {
      setErrors({
        enteredBy: !form.enteredBy.trim() ? "Label petugas wajib diisi." : "",
        sampleMethod: !form.sampleMethod.trim()
          ? "Metode sampling wajib diisi."
          : "",
      });
      return;
    }
    if (
      update(
        (s) => saveRecord(s, parsed.data),
        status === "draft" ? "Simpan draft" : "Ajukan laporan",
        parsed.data.id,
        existing,
        parsed.data,
      )
    ) {
      setDirty(false);
      setErrors({});
      setSaved(new Date().toLocaleTimeString("id-ID"));
      if (explicit)
        notify(
          status === "draft"
            ? "Draft tersimpan di browser ini."
            : "Laporan diajukan untuk verifikasi lokal.",
        );
    }
  }
  const autosave = useEffectEvent(() => {
    if (!existing || existing.status === "draft") save("draft", false);
  });
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => autosave(), 1400);
    return () => clearTimeout(timer);
  }, [form, dirty]);
  const value =
    form.numerator !== "" && form.denominator !== ""
      ? percentage(Number(form.numerator), Number(form.denominator))
      : null;
  const profile = existing && !dirty ? existing.snapshot : indicator;
  const field = (
    key: Exclude<keyof typeof form, "overlapRisk">,
    label: string,
    type = "text",
    hint?: string,
  ) => (
    <label>
      {label}
      <input
        type={type}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? 1 : undefined}
        value={form[key]}
        onChange={(e) => change(key, e.target.value)}
        aria-invalid={!!errors[key]}
        aria-label={label}
      />
      {hint && <small>{hint}</small>}
      {errors[key] && <span className="field-error">{errors[key]}</span>}
    </label>
  );
  return (
    <div className="input-layout">
      <div>
        <Panel
          title="Data pengukuran"
          subtitle={`${months[month - 1]} ${year} · ${indicator.id}`}
          actions={
            existing && <Badge status={recordStatus(existing, indicator)} />
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save("submitted");
            }}
            noValidate
          >
            <div className="form-content">
              <div className="form-grid">
                {field(
                  "numerator",
                  "Numerator (pembilang)",
                  "number",
                  profile.numeratorDefinition || "Belum dikonfigurasi",
                )}
                {field(
                  "denominator",
                  "Denominator (penyebut)",
                  "number",
                  profile.denominatorDefinition || "Belum dikonfigurasi",
                )}
                {field(
                  "excludedCount",
                  "Jumlah eksklusi (informasi)",
                  "number",
                  "Tidak dikurangkan lagi dari denominator.",
                )}
                {field(
                  "populationSize",
                  "Ukuran populasi (opsional)",
                  "number",
                )}
                {field(
                  "sampleMethod",
                  "Metode / jenis sampel",
                  "text",
                  "Isi metode yang benar-benar digunakan.",
                )}
                {field("measuredAt", "Tanggal pengukuran", "date")}
                {field("enteredBy", "Label / pseudonim petugas internal")}
                {field(
                  "evidenceReference",
                  "Referensi bukti non-sensitif",
                  "text",
                  "Nama dokumen / nomor berita acara, tanpa unggahan.",
                )}
              </div>
              {Number(form.denominator) === 0 &&
                form.denominator !== "" &&
                field(
                  "noEligibleReason",
                  "Alasan tidak ada objek ukur (wajib)",
                )}
              <label>
                Catatan sumber data
                <textarea
                  value={form.sourceNote}
                  onChange={(e) => change("sourceNote", e.target.value)}
                  placeholder="Ringkasan agregat, tanpa identitas pasien"
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.overlapRisk}
                  onChange={(e) => change("overlapRisk", e.target.checked)}
                />
                Sumber berpotensi tumpang tindih — perlu audit
              </label>
              {field(
                "comparabilityNote",
                "Konfirmasi kesetaraan sumber antarunit",
                "text",
                "Untuk agregasi RS: jelaskan kesamaan metode, objek, satuan, eksklusi, serta pencegahan hitung ganda.",
              )}
              <details>
                <summary>Kategori kejadian untuk Pareto (opsional)</summary>
                <label>
                  Kategori | frekuensi nyata (satu per baris)
                  <textarea
                    value={form.categoryText}
                    onChange={(e) => change("categoryText", e.target.value)}
                    placeholder="Isi hanya kategori kejadian yang benar-benar diukur"
                  />
                  {errors.categories && (
                    <span className="field-error">
                      Kategori wajib memiliki nama dan frekuensi bilangan bulat
                      nonnegatif. Gunakan pemisah |.
                    </span>
                  )}
                </label>
              </details>
              {existing?.reviewNote && (
                <div className="alert info">
                  Catatan tinjauan terakhir: {existing.reviewNote}
                </div>
              )}
              {existing?.status === "verified" && (
                <div className="alert warning">
                  Menyimpan perubahan akan membuat revisi draft baru dan
                  memerlukan verifikasi ulang.
                </div>
              )}
            </div>
            <div className="form-footer">
              <span className="helper" aria-live="polite">
                {saved
                  ? `Tersimpan ${saved}`
                  : dirty
                    ? "Perubahan belum disimpan"
                    : "Autosave draft aktif untuk isian valid"}
              </span>
              <button
                type="button"
                className="button"
                onClick={() => save("draft")}
              >
                <Save size={16} />
                Simpan draft
              </button>
              <button type="submit" className="button primary">
                <Send size={16} />
                Ajukan laporan
              </button>
            </div>
          </form>
        </Panel>
        {existing && (
          <button
            className="button danger"
            onClick={() => {
              if (
                confirm(
                  "Hapus laporan dan tindak lanjut terkait? Riwayat audit tetap tersimpan.",
                )
              ) {
                if (
                  update(
                    (s) => ({
                      ...s,
                      records: s.records.filter((r) => r.id !== existing.id),
                      plans: s.plans.filter((p) => p.recordId !== existing.id),
                    }),
                    "Hapus laporan",
                    existing.id,
                    existing,
                    undefined,
                  )
                )
                  notify("Laporan dihapus.");
              }
            }}
          >
            <Trash2 size={16} />
            Hapus laporan ini
          </button>
        )}
      </div>
      <div className="profile-sidebar">
        <Panel
          title="Profil pengukuran"
          actions={<span className="tag">v{profile.version}</span>}
        >
          <div className="profile-content">
            <span className="code">{profile.id}</span>
            <h3>{profile.title}</h3>
            <div className="target-box">
              <span>Target efektif</span>
              <strong>
                {profile.effectiveTargetPct === null
                  ? "Belum disahkan"
                  : `${fmt(profile.effectiveTargetPct, 0)}%`}
              </strong>
            </div>
            {!profileComplete(profile) && (
              <div className="alert warning">
                Profil belum lengkap. Tidak dapat dinilai sebagai capaian final.
              </div>
            )}
            {profile.effectiveTargetPct === null && (
              <div className="alert warning">
                Master {profile.targetMasterPct}% · profil{" "}
                {profile.targetProfilePct ?? "belum tersedia"}%. Menunggu
                pengesahan admin.
              </div>
            )}
            {(
              [
                "definition",
                "inclusion",
                "exclusion",
                "sampleRule",
                "collectionMethod",
                "dataSource",
                "instrument",
                "pic",
                "sourceReference",
              ] as const
            ).map((k, index) => (
              <div className="profile-field" key={k}>
                <span>
                  {
                    [
                      "Definisi operasional",
                      "Inklusi",
                      "Eksklusi",
                      "Ketentuan sampel",
                      "Metode pengumpulan",
                      "Sumber data",
                      "Instrumen",
                      "Penanggung jawab",
                      "Referensi sumber",
                    ][index]
                  }
                </span>
                <p>{profile[k] || "Belum dikonfigurasi"}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <div className="calculator">
            <Calculator size={22} />
            <span>Kalkulator capaian</span>
            <strong>{value === null ? "N/A" : `${fmt(value)}%`}</strong>
            <small>numerator ÷ denominator × 100</small>
            {Number(form.denominator) > 0 &&
              Number(form.denominator) < profile.minSample && (
                <p className="field-error">
                  Sampel belum memenuhi ketentuan minimal {profile.minSample}{" "}
                  peluang.
                </p>
              )}
            <p>
              Hasil hitung belum berarti target tercapai sebelum verifikasi.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
