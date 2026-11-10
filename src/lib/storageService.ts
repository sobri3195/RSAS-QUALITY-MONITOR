import { stateSchema, type AppState, type AuditEvent } from "../types";
import {
  seedIndicators,
  units,
  validateIndicatorIdentity,
} from "../features/indicators/indicatorService";
export const STORAGE_KEY = "rsas-quality-monitor:v1:dataset";
export function initialState(): AppState {
  return {
    schemaVersion: 1,
    storageRevision: crypto.randomUUID(),
    deviceId: crypto.randomUUID(),
    indicators: structuredClone(seedIndicators),
    records: [],
    plans: [],
    audit: [],
    assignments: Object.fromEntries(units.map((u) => [u.id, []])),
    settings: { dropThreshold: 5 },
  };
}
export function validateState(value: unknown) {
  const state = stateSchema.parse(value);
  const ids = new Set(seedIndicators.map((i) => i.id));
  if (
    new Set(state.indicators.map((i) => i.id)).size !== 34 ||
    state.indicators.some((i) => !ids.has(i.id))
  )
    throw Error("Master indikator tidak sesuai sumber 2026.");
  state.indicators.forEach(validateIndicatorIdentity);
  for (const [unitId, ids] of Object.entries(state.assignments)) {
    if (
      !units.some((u) => u.id === unitId) ||
      new Set(ids).size !== ids.length ||
      ids.some(
        (id) =>
          !seedIndicators.some((i) => i.id === id && i.kind === "rumah_sakit"),
      )
    )
      throw Error("Penugasan unit/indikator tidak valid.");
  }
  const keys = new Set<string>(),
    recordIds = new Set<string>();
  for (const r of state.records) {
    validateIndicatorIdentity(r.snapshot);
    const key = [r.indicatorId, r.unitId, r.year, r.month, r.dataType].join(
      "|",
    );
    if (keys.has(key) || recordIds.has(r.id))
      throw Error("Duplikasi laporan di penyimpanan.");
    keys.add(key);
    recordIds.add(r.id);
    if (!ids.has(r.indicatorId) || !units.some((u) => u.id === r.unitId))
      throw Error("Referensi indikator/unit tidak dikenal.");
  }
  if (state.plans.some((p) => !recordIds.has(p.recordId)))
    throw Error("Rencana tindak lanjut tanpa laporan sumber.");
  if (new Set(state.plans.map((p) => p.id)).size !== state.plans.length)
    throw Error("Duplikasi ID tindak lanjut.");
  return state;
}
export function loadStorage(storage: Pick<Storage, "getItem">): {
  state: AppState;
  error: string;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { state: initialState(), error: "" };
    return { state: validateState(JSON.parse(raw)), error: "" };
  } catch {
    return {
      state: initialState(),
      error:
        "Data lokal rusak, versi tidak didukung, atau penyimpanan tidak dapat dibaca. Data asli tidak ditimpa. Unduh salinan pemulihan lalu pulihkan backup atau reset secara eksplisit.",
    };
  }
}
export function persist(
  storage: Pick<Storage, "getItem" | "setItem">,
  next: AppState,
  previousRevision: string,
  force = false,
) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw && !force) {
    const stored = JSON.parse(raw);
    if (stored.storageRevision !== previousRevision)
      throw Error(
        "Data berubah di tab lain. Muat ulang halaman sebelum menyimpan.",
      );
  }
  const state = validateState({
    ...next,
    storageRevision: crypto.randomUUID(),
  });
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    throw Error(
      "Penyimpanan gagal / kuota penuh. Ekspor backup dan kosongkan ruang; perubahan belum disimpan.",
    );
  }
  return state;
}
export function auditEvent(
  recordId: string,
  action: string,
  before: unknown,
  after: unknown,
  actorLabel: string,
): AuditEvent {
  return {
    id: crypto.randomUUID(),
    recordId,
    action,
    before,
    after,
    at: new Date().toISOString(),
    actorLabel,
  };
}
