import { initialState } from "../lib/storageService";
import { seedIndicators } from "../features/indicators/indicatorService";
import type { MonthlyRecord } from "../types";
export function record(overrides: Partial<MonthlyRecord> = {}): MonthlyRecord {
  const now = new Date().toISOString();
  const id = overrides.indicatorId ?? "RSAS-U-03";
  return {
    id: crypto.randomUUID(),
    indicatorId: id,
    unitId: "UNIT-03",
    year: 2026,
    month: 1,
    numerator: 45,
    denominator: 50,
    excludedCount: 0,
    populationSize: null,
    sampleMethod: "Total sampling",
    noEligibleReason: "",
    sourceNote: "Data uji otomatis, bukan data aktual pelayanan",
    evidenceReference: "Referensi uji",
    enteredBy: "Pengujian",
    measuredAt: "2026-01-31",
    status: "verified",
    reviewNote: "Ditinjau dalam pengujian",
    reviewer: "Penguji",
    createdAt: now,
    updatedAt: now,
    revision: 1,
    originDeviceId: initialState().deviceId,
    dataType: "actual",
    snapshot: structuredClone(seedIndicators.find((i) => i.id === id)!),
    overlapRisk: false,
    comparabilityNote: "",
    samplePolicyNote: "",
    categories: [],
    ...overrides,
  };
}
