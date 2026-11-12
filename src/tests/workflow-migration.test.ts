import { expect, it } from "vitest";
import { record } from "./fixtures";
import { initialState } from "../lib/storageService";
import { exportBundle } from "../lib/importExportService";
import { demoSeed } from "../features/workflow/demoRepository";
import {
  migrateLegacyDraft,
  readLegacy,
} from "../features/workflow/legacyMigration";
it("migrates local verified records only into drafts, retaining the source and rejecting retries", () => {
  const source = record();
  const state = initialState();
  state.records = [source];
  const raw = JSON.stringify(state);
  const data = demoSeed();
  data.versions.push({
    ...data.versions[0],
    indicator_id: source.indicatorId,
    config: {
      ...data.versions[0].config,
      numerator_label: source.snapshot.numeratorDefinition,
      denominator_label: source.snapshot.denominatorDefinition,
    },
  });
  const parsed = readLegacy(raw);
  expect(parsed).toHaveLength(1);
  expect(readLegacy(JSON.stringify(exportBundle(state)))).toHaveLength(1);
  const draft = migrateLegacyDraft(parsed[0], data);
  expect(draft.expected_version).toBe(0);
  expect(draft.data.numerator).toBe(45);
  expect(draft.data.notes).toContain("tidak dipindahkan sebagai persetujuan");
  expect(raw).toBe(JSON.stringify(state));
  expect(draft).not.toHaveProperty("status");
  data.submissions.push({
    ...data.submissions[0],
    indicator_id: draft.indicator_id,
    unit_id: draft.unit_id,
    period: draft.period,
  });
  expect(() => migrateLegacyDraft(parsed[0], data)).toThrow(/Konflik/);
});
it("rejects unknown schema, synthetic legacy records, mismatched definitions and unapproved targets", () => {
  expect(() => readLegacy('{"schemaVersion":2}')).toThrow();
  const source = record();
  const data = demoSeed();
  expect(() =>
    migrateLegacyDraft({ ...source, dataType: "simulation" }, data),
  ).toThrow(/simulasi/);
  expect(() => migrateLegacyDraft(source, data)).toThrow(/setara/);
});
