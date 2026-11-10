import type { Indicator, MonthlyRecord, Status } from "../../types";
import { profileComplete } from "../indicators/indicatorService";
export const percentage = (n: number, d: number) =>
  d > 0 ? (n / d) * 100 : null;
export const gap = (value: number | null, target: number | null) =>
  value === null || target === null ? null : value - target;
export const fmt = (n: number | null, digits = 1) =>
  n === null
    ? "—"
    : new Intl.NumberFormat("id-ID", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(n);
export const months = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
export const labels: Record<Status, string> = {
  belum_dilaporkan: "Belum dilaporkan",
  draft: "Draft",
  diajukan: "Diajukan",
  perlu_revisi: "Perlu revisi",
  terverifikasi_tercapai: "Tercapai",
  terverifikasi_belum_tercapai: "Belum tercapai",
  n_a: "Tidak ada objek ukur / N/A",
  target_belum_disahkan: "Target belum disahkan",
  profil_belum_lengkap: "Profil belum lengkap",
  sampel_tidak_memadai: "Sampel tidak memadai",
};
export function recordStatus(
  r: MonthlyRecord | undefined,
  i: Indicator,
): Status {
  if (!r)
    return !profileComplete(i)
      ? "profil_belum_lengkap"
      : i.effectiveTargetPct === null
        ? "target_belum_disahkan"
        : "belum_dilaporkan";
  if (r.status === "draft") return "draft";
  if (r.status === "submitted") return "diajukan";
  if (r.status === "returned") return "perlu_revisi";
  const s = r.snapshot;
  if (!profileComplete(s)) return "profil_belum_lengkap";
  if (s.effectiveTargetPct === null) return "target_belum_disahkan";
  if (!r.denominator) return "n_a";
  if (r.denominator < s.minSample && !r.samplePolicyNote.trim())
    return "sampel_tidak_memadai";
  return (r.numerator / r.denominator) * 100 >= s.effectiveTargetPct
    ? "terverifikasi_tercapai"
    : "terverifikasi_belum_tercapai";
}
export function finalEligible(r: MonthlyRecord) {
  return (
    r.dataType === "actual" &&
    ["terverifikasi_tercapai", "terverifikasi_belum_tercapai"].includes(
      recordStatus(r, r.snapshot),
    ) &&
    !r.overlapRisk
  );
}
export function aggregate(records: MonthlyRecord[]) {
  const valid = records.filter(finalEligible);
  const first = valid[0];
  if (!first)
    return {
      numerator: 0,
      denominator: 0,
      value: null,
      target: null,
      reason: "Belum ada data aktual terverifikasi yang memenuhi syarat.",
    };
  const same = valid.every(
    (r) =>
      r.indicatorId === first.indicatorId &&
      r.snapshot.version === first.snapshot.version &&
      r.snapshot.numeratorDefinition === first.snapshot.numeratorDefinition &&
      r.snapshot.denominatorDefinition ===
        first.snapshot.denominatorDefinition &&
      r.snapshot.exclusion === first.snapshot.exclusion &&
      r.snapshot.inclusion === first.snapshot.inclusion &&
      r.snapshot.definition === first.snapshot.definition &&
      r.snapshot.collectionMethod === first.snapshot.collectionMethod &&
      r.snapshot.sampleRule === first.snapshot.sampleRule &&
      r.snapshot.minSample === first.snapshot.minSample &&
      r.sampleMethod === first.sampleMethod &&
      r.snapshot.effectiveTargetPct === first.snapshot.effectiveTargetPct,
  );
  const crossUnit = new Set(valid.map((r) => r.unitId)).size > 1;
  if (!same || (crossUnit && valid.some((r) => !r.comparabilityNote.trim())))
    return {
      numerator: 0,
      denominator: 0,
      value: null,
      target: null,
      reason:
        "Definisi/metode/versi tidak konsisten atau kesetaraan sumber antarunit belum dikonfirmasi. Perlu audit.",
    };
  const numerator = valid.reduce((s, r) => s + r.numerator, 0),
    denominator = valid.reduce((s, r) => s + r.denominator, 0);
  return {
    numerator,
    denominator,
    value: percentage(numerator, denominator),
    target: first.snapshot.effectiveTargetPct,
    reason: "",
  };
}
export function trend(
  records: MonthlyRecord[],
  indicatorId: string,
  year: number,
) {
  return months.map((name, index) => {
    const a = aggregate(
      records.filter(
        (r) =>
          r.indicatorId === indicatorId &&
          r.year === year &&
          r.month === index + 1,
      ),
    );
    return { name: name.slice(0, 3), ...a };
  });
}
export function alerts(records: MonthlyRecord[], threshold: number) {
  const result: { record: MonthlyRecord; message: string }[] = [];
  for (const r of records.filter((r) => r.dataType === "actual")) {
    const prev = records.find(
      (p) =>
        p.indicatorId === r.indicatorId &&
        p.unitId === r.unitId &&
        p.year === (r.month === 1 ? r.year - 1 : r.year) &&
        p.month === (r.month === 1 ? 12 : r.month - 1) &&
        p.dataType === "actual",
    );
    if (r.denominator > 0 && r.denominator < r.snapshot.minSample)
      result.push({
        record: r,
        message: "Sampel belum memenuhi ketentuan minimal 200 peluang.",
      });
    if (r.snapshot.effectiveTargetPct === null)
      result.push({
        record: r,
        message: "Target belum disahkan; capaian final belum dapat dinilai.",
      });
    if (
      prev &&
      finalEligible(prev) &&
      finalEligible(r) &&
      prev.snapshot.version === r.snapshot.version
    ) {
      const diff =
        percentage(r.numerator, r.denominator)! -
        percentage(prev.numerator, prev.denominator)!;
      if (diff < -threshold)
        result.push({
          record: r,
          message: `Turun ${fmt(-diff)} pp dari bulan sebelumnya (ambang ${threshold} pp).`,
        });
      if (
        recordStatus(prev, prev.snapshot) === "terverifikasi_belum_tercapai" &&
        recordStatus(r, r.snapshot) === "terverifikasi_belum_tercapai"
      )
        result.push({
          record: r,
          message: "Dua periode berturut-turut belum mencapai target.",
        });
    }
  }
  return result;
}
export function interpretation(records: MonthlyRecord[]) {
  const a = aggregate(records);
  return a.value === null
    ? a.reason
    : `Capaian ${fmt(a.value)}%, target ${fmt(a.target)}%, gap ${fmt(gap(a.value, a.target))} pp. Agregasi tertimbang ${a.numerator}/${a.denominator}; tidak menyimpulkan penyebab klinis.`;
}
export function paretoData(records: MonthlyRecord[]) {
  const frequencies = new Map<string, number>();
  for (const r of records)
    for (const c of r.categories)
      frequencies.set(c.name, (frequencies.get(c.name) ?? 0) + c.frequency);
  const total = [...frequencies.values()].reduce((a, b) => a + b, 0);
  let cumulative = 0;
  return [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, frequency]) => ({
      name,
      frequency,
      cumulative: total ? ((cumulative += frequency) / total) * 100 : 0,
    }));
}
