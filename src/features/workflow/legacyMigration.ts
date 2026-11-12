import type { MonthlyRecord } from "../../types";
import { parseBundle } from "../../lib/importExportService";
import { validateState } from "../../lib/storageService";
import type { DraftInput, WorkflowData } from "./types";
import { emptyMeasurement } from "./types";
import { calculate } from "./rules";
export function readLegacy(raw: string): MonthlyRecord[] {
  const value = JSON.parse(raw) as { exportType?: string };
  return value.exportType
    ? parseBundle(raw).records
    : validateState(value).records;
}
export function migrateLegacyDraft(
  record: MonthlyRecord,
  data: WorkflowData,
): DraftInput {
  if (record.dataType !== "actual")
    throw Error("Data simulasi tidak dapat dimigrasikan sebagai data resmi.");
  const period = `${record.year}-${String(record.month).padStart(2, "0")}-01`;
  if (
    data.submissions.some(
      (s) =>
        s.id === record.id ||
        (s.unit_id === record.unitId &&
          s.indicator_id === record.indicatorId &&
          s.period === period),
    )
  )
    throw Error("Konflik periode: tidak ada penimpaan otomatis.");
  const version = data.versions
    .filter(
      (v) =>
        v.indicator_id === record.indicatorId &&
        data.targets.some(
          (t) =>
            t.version_id === v.id && t.period === period && t.target !== null,
        ),
    )
    .sort((a, b) => b.version - a.version)[0];
  if (
    !version ||
    version.config.measurement !== "proportion" ||
    version.config.numerator_label !== record.snapshot.numeratorDefinition ||
    version.config.denominator_label !== record.snapshot.denominatorDefinition
  )
    throw Error(
      "Admin harus mengesahkan definisi proporsi yang setara dan target periode terlebih dahulu.",
    );
  const measurement = {
    ...emptyMeasurement,
    ...(record.denominator === 0
      ? {
          kind: "no_cases" as const,
          reason_code: "NO_ELIGIBLE_CASES" as const,
          reason: record.noEligibleReason,
        }
      : { numerator: record.numerator, denominator: record.denominator }),
    notes:
      `Migrasi arsip v1 ${record.id}, revisi ${record.revision}, definisi v${record.snapshot.version}. Status lama ${record.status} tidak dipindahkan sebagai persetujuan. ${record.sourceNote}`.slice(
        0,
        4000,
      ),
  };
  calculate(version.config, measurement);
  return {
    id: record.id,
    indicator_id: record.indicatorId,
    unit_id: record.unitId,
    period,
    data: measurement,
    expected_version: 0,
  };
}
