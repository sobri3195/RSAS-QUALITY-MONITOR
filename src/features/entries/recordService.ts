import {
  recordSchema,
  type AppState,
  type MonthlyRecord,
  type Role,
} from "../../types";
import { assigned } from "../indicators/indicatorService";
export const recordKey = (
  r: Pick<
    MonthlyRecord,
    "indicatorId" | "unitId" | "year" | "month" | "dataType"
  >,
) => `${r.indicatorId}|${r.unitId}|${r.year}|${r.month}|${r.dataType}`;
export function saveRecord(state: AppState, input: MonthlyRecord) {
  const r = recordSchema.parse(input);
  if (
    !state.indicators.some((i) => i.id === r.indicatorId) ||
    (!assigned(r.snapshot, r.unitId, state.assignments) &&
      !state.records.some(
        (old) => old.id === r.id && recordKey(old) === recordKey(r),
      ))
  )
    throw Error("Indikator belum ditugaskan ke unit ini.");
  const duplicate = state.records.find(
    (x) => recordKey(x) === recordKey(r) && x.id !== r.id,
  );
  if (duplicate)
    throw Error("Periode sudah terisi. Buka dan edit laporan yang ada.");
  return {
    ...state,
    records: [...state.records.filter((x) => x.id !== r.id), r],
  };
}
export function reviewRecord(
  r: MonthlyRecord,
  status: "verified" | "returned",
  note: string,
  actor: string,
  role: Role,
  policyNote = "",
): MonthlyRecord {
  if (!["Kepala Unit", "Komite Mutu", "Admin/Pimpinan"].includes(role))
    throw Error("Pilih persona peninjau untuk verifikasi lokal.");
  if (r.status !== "submitted")
    throw Error("Hanya laporan diajukan yang dapat ditinjau.");
  if (!actor.trim() || !note.trim())
    throw Error("Label peninjau dan catatan tinjauan wajib diisi.");
  if (policyNote.trim() && role === "Kepala Unit")
    throw Error(
      "Kebijakan pengecualian sampel harus dicatat oleh Komite Mutu atau Admin/Pimpinan.",
    );
  return {
    ...r,
    status,
    reviewNote: note,
    reviewer: actor,
    samplePolicyNote: policyNote,
    updatedAt: new Date().toISOString(),
    revision: r.revision + 1,
  };
}
