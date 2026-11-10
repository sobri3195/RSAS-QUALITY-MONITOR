import { z } from "zod";
import {
  stateSchema,
  indicatorSchema,
  recordSchema,
  planSchema,
  auditSchema,
  type AppState,
  type MonthlyRecord,
} from "../types";
import {
  seedIndicators,
  units,
  unitName,
  validateIndicatorIdentity,
} from "../features/indicators/indicatorService";
import { recordKey } from "../features/entries/recordService";
import { auditEvent, validateState } from "./storageService";
import {
  fmt,
  percentage,
  gap,
  recordStatus,
  labels,
} from "../features/analytics/analyticsService";
export const bundleSchema = z.object({
  schemaVersion: z.literal(1),
  hospital: z.literal("RSAU Prof. dr. Abdulrachman Saleh"),
  exportType: z.enum(["unit", "backup"]),
  exportedAt: z.iso.datetime(),
  originDeviceId: z.uuid(),
  unitId: z.string().nullable(),
  unitName: z.string(),
  period: z.string(),
  indicators: z.array(indicatorSchema),
  records: z.array(recordSchema),
  plans: z.array(planSchema),
  audit: z.array(auditSchema),
  state: stateSchema.optional(),
});
export type Bundle = z.infer<typeof bundleSchema>;
export function exportBundle(state: AppState, unitId?: string): Bundle {
  const records = state.records.filter(
    (r) => !unitId || (r.unitId === unitId && r.dataType === "actual"),
  );
  const ids = new Set(records.map((r) => r.id));
  return {
    schemaVersion: 1,
    hospital: "RSAU Prof. dr. Abdulrachman Saleh",
    exportType: unitId ? "unit" : "backup",
    exportedAt: new Date().toISOString(),
    originDeviceId: state.deviceId,
    unitId: unitId ?? null,
    unitName: unitId ? unitName(unitId) : "Seluruh unit",
    period: "Semua periode tersimpan",
    indicators: state.indicators,
    records,
    plans: state.plans.filter((p) => ids.has(p.recordId)),
    audit: state.audit.filter((a) => ids.has(a.recordId) || !unitId),
    ...(!unitId ? { state } : {}),
  };
}
export function parseBundle(raw: string): Bundle {
  const b = bundleSchema.parse(JSON.parse(raw));
  const ids = new Set(seedIndicators.map((i) => i.id));
  if (
    b.indicators.some((i) => !ids.has(i.id)) ||
    new Set(b.indicators.map((i) => i.id)).size !== b.indicators.length
  )
    throw Error("Master impor tidak dikenal atau duplikat.");
  b.indicators.forEach(validateIndicatorIdentity);
  for (const r of b.records) {
    validateIndicatorIdentity(r.snapshot);
    if (!ids.has(r.indicatorId) || !units.some((u) => u.id === r.unitId))
      throw Error("indicatorId/unitId tidak dikenal.");
    if (
      b.exportType === "unit" &&
      (r.unitId !== b.unitId || r.dataType !== "actual")
    )
      throw Error("Isi tidak cocok dengan ekspor data aktual unit.");
  }
  if (b.unitId && !units.some((u) => u.id === b.unitId))
    throw Error("Unit tidak dikenal.");
  if (b.plans.some((p) => !b.records.some((r) => r.id === p.recordId)))
    throw Error("Tindak lanjut tidak memiliki laporan sumber.");
  if (b.state) validateState(b.state);
  return b;
}
export type ImportItem = {
  key: string;
  record: MonthlyRecord;
  existing?: MonthlyRecord;
  source: string;
  conflict: boolean;
  duplicate: boolean;
};
export function previewImport(
  state: AppState,
  bundles: Bundle[],
): ImportItem[] {
  const staged = [...state.records];
  return bundles.flatMap((b, bi) =>
    b.records.map((record, ri) => {
      const matches = staged.filter(
        (r) => r.id === record.id || recordKey(r) === recordKey(record),
      );
      const existing = matches[0];
      const duplicate =
        matches.length === 1 &&
        JSON.stringify(existing) === JSON.stringify(record);
      const conflict = matches.length > 0 && !duplicate;
      const key = `${bi}:${ri}`;
      if (!existing) staged.push(record);
      else if (conflict) {
        for (const x of matches) staged.splice(staged.indexOf(x), 1);
        staged.push(record);
      }
      return {
        key,
        record,
        existing,
        source: `${b.unitName} · ${b.originDeviceId.slice(0, 8)}`,
        conflict,
        duplicate,
      };
    }),
  );
}
export function mergeBundles(
  state: AppState,
  bundles: Bundle[],
  choices: Record<string, "local" | "import">,
  actor: string,
) {
  const next = structuredClone(state);
  const items = previewImport(state, bundles);
  const remap = new Map<string, string>();
  for (const item of items) {
    const matches = next.records.filter(
      (r) => r.id === item.record.id || recordKey(r) === recordKey(item.record),
    );
    const different =
      matches.length > 0 &&
      !(
        matches.length === 1 &&
        JSON.stringify(matches[0]) === JSON.stringify(item.record)
      );
    if (different && !choices[item.key])
      throw Error("Selesaikan seluruh konflik terlebih dahulu.");
    if (different && choices[item.key] === "local") {
      remap.set(item.record.id, matches[0].id);
      next.audit.push(
        auditEvent(
          matches[0].id,
          "Impor: simpan lokal",
          item.record,
          matches[0],
          actor,
        ),
      );
      continue;
    }
    if (
      different &&
      matches.some(
        (m) =>
          m.id === item.record.id && recordKey(m) !== recordKey(item.record),
      )
    )
      throw Error(
        "ID sama menunjuk indikator/unit/periode berbeda. Batalkan dan koreksi file sumber.",
      );
    if (different && matches.length > 1)
      throw Error(
        "Benturan ID dan periode ganda. Gunakan data lokal lalu koreksi sumber.",
      );
    if (matches.length && !different) {
      remap.set(item.record.id, matches[0].id);
      continue;
    }
    const old = matches[0];
    const r = { ...item.record, id: old?.id ?? item.record.id };
    remap.set(item.record.id, r.id);
    next.records = next.records.filter((x) => !matches.includes(x));
    next.records.push(r);
    next.audit.push(auditEvent(r.id, "Impor konsolidasi", old, r, actor));
  }
  for (const b of bundles) {
    for (const p of b.plans) {
      const recordId = remap.get(p.recordId) ?? p.recordId;
      const old = next.plans.find((x) => x.id === p.id);
      if (!old) next.plans.push({ ...p, recordId });
      else if (JSON.stringify(old) !== JSON.stringify({ ...p, recordId }))
        next.audit.push(
          auditEvent(
            recordId,
            "Konflik tindak lanjut: versi lokal dipertahankan",
            p,
            old,
            actor,
          ),
        );
    }
    for (const a of b.audit)
      if (!next.audit.some((x) => x.id === a.id)) next.audit.push(a);
  }
  return validateState(next);
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function recordsCSV(records: MonthlyRecord[]) {
  const rows = [
    [
      "Periode",
      "Jenis data",
      "Unit",
      "Kode",
      "Indikator",
      "Numerator",
      "Denominator",
      "Capaian (%)",
      "Target (%)",
      "Gap (pp)",
      "Status",
      "Verifikasi",
      "PIC",
      "Diperbarui",
      "Asal perangkat",
    ],
    ...records.map((r) => [
      `${r.year}-${String(r.month).padStart(2, "0")}`,
      r.dataType === "simulation" ? "SIMULASI" : "Aktual",
      unitName(r.unitId),
      r.indicatorId,
      r.snapshot.title,
      r.numerator,
      r.denominator,
      fmt(percentage(r.numerator, r.denominator)),
      fmt(r.snapshot.effectiveTargetPct),
      fmt(
        gap(
          percentage(r.numerator, r.denominator),
          r.snapshot.effectiveTargetPct,
        ),
      ),
      labels[recordStatus(r, r.snapshot)],
      r.status,
      r.enteredBy,
      r.updatedAt,
      r.originDeviceId,
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
