import { describe, expect, it } from "vitest";
import {
  aggregate,
  calculate,
  csvReport,
  failureStreak,
  meetsTarget,
  monthlySeries,
  pChart,
  transitionSteps,
} from "../features/workflow/rules";
import { demoId, demoSeed } from "../features/workflow/demoRepository";
import { emptyMeasurement, type Submission } from "../features/workflow/types";
import { checkEvidence } from "../features/workflow/supabaseRepository";
const seed = demoSeed();
const base = seed.submissions[0];
const config = base.snapshot.definition;
const row = (overrides: Partial<Submission> = {}): Submission =>
  structuredClone({ ...base, ...overrides });
describe("safe formulas and publication-only reporting", () => {
  it("uses weighted ratios for unequal denominators", () => {
    expect(
      aggregate([
        row({
          data: { ...emptyMeasurement, numerator: 9, denominator: 10 },
          result: 90,
        }),
        row({
          id: demoId(500),
          data: { ...emptyMeasurement, numerator: 1, denominator: 100 },
          result: 1,
        }),
      ]),
    ).toBeCloseTo((100 * 10) / 110);
  });
  it.each([
    "DRAFT",
    "SUBMITTED",
    "UNDER_VALIDATION",
    "VALIDATED",
    "PENDING_MUTU",
    "NEEDS_REVISION",
    "RESUBMITTED",
    "NEEDS_CLARIFICATION",
  ] as const)("excludes %s from reporting and CSV", (status) => {
    const input = row({ status });
    expect(aggregate([input])).toBeNull();
    expect(csvReport([input]).split("\r\n")).toHaveLength(1);
    expect(
      monthlySeries([input], input.indicator_id, input.period, 1)[0].value,
    ).toBeNull();
  });
  it("rejects incompatible versions and targets", () => {
    expect(() => aggregate([row(), row({ version_id: demoId(900) })])).toThrow(
      /sebanding/,
    );
    expect(() =>
      aggregate([row(), row({ snapshot: { ...base.snapshot, target: 99 } })]),
    ).toThrow(/sebanding/);
  });
  it("does not average scalar values without configured aggregation", () => {
    const input = row({
      snapshot: {
        ...base.snapshot,
        definition: { ...config, measurement: "time", aggregation: "none" },
      },
    });
    expect(aggregate([input, input])).toBeNull();
  });
  it("allows rate numerators above denominator without treating them as proportions", () => {
    expect(
      calculate(
        { ...config, measurement: "rate", multiplier: 1000, max_value: 10000 },
        { ...emptyMeasurement, numerator: 20, denominator: 10 },
      ),
    ).toBe(2000);
    expect(() =>
      calculate(config, {
        ...emptyMeasurement,
        numerator: 20,
        denominator: 10,
      }),
    ).toThrow(/Numerator/);
  });
  it("handles lower targets and range endpoints correctly", () => {
    expect(
      meetsTarget(
        row({
          result: 10,
          snapshot: {
            ...base.snapshot,
            target: 15,
            definition: { ...config, direction: "lower_is_better" },
          },
        }),
      ),
    ).toBe(true);
    expect(
      meetsTarget(
        row({
          result: 20,
          snapshot: {
            ...base.snapshot,
            target: 15,
            definition: { ...config, direction: "lower_is_better" },
          },
        }),
      ),
    ).toBe(false);
    expect(
      meetsTarget(
        row({
          result: 15,
          snapshot: {
            ...base.snapshot,
            target: 10,
            target_upper: 15,
            definition: { ...config, direction: "range" },
          },
        }),
      ),
    ).toBe(true);
  });
  it("distinguishes missing, no cases, N/A and measured zero", () => {
    for (const [kind, reason_code] of [
      ["missing", "AWAITING_DATA"],
      ["no_cases", "NO_ELIGIBLE_CASES"],
      ["not_applicable", "NOT_APPLICABLE"],
    ] as const) {
      const data = {
        ...emptyMeasurement,
        kind,
        reason_code,
        reason: "Alasan agregat",
      };
      expect(calculate(config, data)).toBeNull();
      if (kind === "missing")
        expect(() => calculate(config, data, true)).toThrow(/belum lengkap/);
    }
    expect(
      calculate(config, { ...emptyMeasurement, numerator: 0, denominator: 10 }),
    ).toBe(0);
    expect(() =>
      calculate(config, { ...emptyMeasurement, numerator: 0, denominator: 0 }),
    ).toThrow(/Denominator nol/);
  });
  it("does not evaluate arbitrary formula code or accept non-finite numbers", () => {
    expect(() =>
      calculate(config, {
        ...emptyMeasurement,
        numerator: Infinity,
        denominator: 1,
      }),
    ).toThrow();
    expect(() =>
      calculate(config, {
        ...emptyMeasurement,
        numerator: NaN,
        denominator: 1,
      }),
    ).toThrow();
    expect(() =>
      calculate(
        { ...config, measurement: "time" },
        { ...emptyMeasurement, value: -1 },
      ),
    ).toThrow();
  });
  it("treats missing chart months as gaps and requires consecutive failed periods", () => {
    const rows = seed.submissions;
    expect(failureStreak(rows, base.indicator_id, base.unit_id)).toBe(3);
    expect(
      failureStreak([rows[0], rows[2]], base.indicator_id, base.unit_id),
    ).toBe(1);
    expect(
      monthlySeries(rows, base.indicator_id, "2026-04-01", 4)[3].value,
    ).toBeNull();
  });
  it("gates p charts on data and methodological assumptions", () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      row({
        period: new Date(Date.UTC(2025, i, 1)).toISOString().slice(0, 10),
      }),
    );
    expect(pChart(rows, false)).toBeNull();
    expect(pChart(rows.slice(0, 19), true)).toBeNull();
    expect(pChart(rows, true)).toHaveLength(20);
    expect(
      pChart([...rows.slice(0, 19), row({ period: "2027-01-01" })], true),
    ).toBeNull();
  });
  it("protects CSV formula cells and exports snapshot values", () => {
    const text = csvReport([
      row({ snapshot: { ...base.snapshot, code: '=HYPERLINK("evil")' } }),
    ]);
    expect(text).toContain("'=HYPERLINK");
    expect(text).toContain('"95"');
    expect(text.charCodeAt(0)).toBe(0xfeff);
  });
  it("requires assignment, role, non-self approval and a reason", () => {
    const s = row({ status: "UNDER_VALIDATION" });
    const validator = seed.profiles[1];
    expect(
      transitionSteps(s, "approve", validator, seed.assignments, "checked"),
    ).toEqual(["VALIDATED", "PENDING_MUTU"]);
    expect(() =>
      transitionSteps(
        s,
        "approve",
        { ...validator, id: s.created_by },
        seed.assignments,
        "checked",
      ),
    ).toThrow();
    expect(() =>
      transitionSteps(s, "approve", validator, [], "checked"),
    ).toThrow();
    expect(() =>
      transitionSteps(s, "reject", validator, seed.assignments, ""),
    ).toThrow();
  });
  it("checks file signature and maximum size before upload", async () => {
    await expect(
      checkEvidence(
        new File(["not pdf"], "x.pdf", { type: "application/pdf" }),
      ),
    ).rejects.toThrow(/valid/);
    await expect(
      checkEvidence(
        new File(["%PDF-1.7"], "x.pdf", { type: "application/pdf" }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      checkEvidence(
        new File([new Uint8Array(5242881)], "x.pdf", {
          type: "application/pdf",
        }),
      ),
    ).rejects.toThrow(/5 MB/);
  });
});
