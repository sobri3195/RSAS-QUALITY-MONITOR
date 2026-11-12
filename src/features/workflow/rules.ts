import type {
  Assignment,
  Definition,
  Measurement,
  Profile,
  Submission,
  Transition,
  WorkflowData,
} from "./types";
import { measurementSchema } from "./types";
export function calculate(
  config: Definition,
  input: Measurement,
  submitting = false,
): number | null {
  const data = measurementSchema.parse(input);
  if (data.kind !== "measured") {
    const expected = {
      no_cases: "NO_ELIGIBLE_CASES",
      not_applicable: "NOT_APPLICABLE",
      missing: "AWAITING_DATA",
    }[data.kind];
    if (data.reason_code !== expected || !data.reason.trim())
      throw Error("Alasan terstruktur wajib diisi untuk data kosong/N/A.");
    if (submitting && data.kind === "missing")
      throw Error("Data belum lengkap tidak dapat diajukan.");
    if ([data.numerator, data.denominator, data.value].some((v) => v !== null))
      throw Error("Kosongkan angka untuk status tanpa pengukuran.");
    return null;
  }
  let result: number;
  if (config.measurement === "proportion" || config.measurement === "rate") {
    const { numerator: n, denominator: d } = data;
    if (
      n === null ||
      d === null ||
      !Number.isInteger(n) ||
      !Number.isInteger(d)
    )
      throw Error("Numerator dan denominator wajib bilangan bulat.");
    if (d <= 0)
      throw Error("Denominator nol: pilih Tidak ada kasus dan isi alasan.");
    if (config.measurement === "proportion" && n > d)
      throw Error("Numerator tidak boleh melebihi denominator untuk proporsi.");
    if (submitting && d < config.min_sample)
      throw Error(`Sampel minimal ${config.min_sample} belum terpenuhi.`);
    if (data.value !== null)
      throw Error("Nilai manual tidak dipakai untuk formula rasio.");
    result = (n / d) * config.multiplier;
  } else {
    if (
      data.value === null ||
      (config.measurement === "count" && !Number.isInteger(data.value))
    )
      throw Error("Nilai wajib sesuai tipe indikator.");
    if (data.numerator !== null || data.denominator !== null)
      throw Error("Numerator/denominator tidak dipakai untuk indikator nilai.");
    result = data.value;
  }
  if (
    !Number.isFinite(result) ||
    result < config.min_value ||
    result > config.max_value
  )
    throw Error("Nilai di luar rentang definisi.");
  return result;
}
export function meetsTarget(s: Submission): boolean | null {
  if (s.result === null) return null;
  const { definition: d, target: t, target_upper: u } = s.snapshot;
  return d.direction === "lower_is_better"
    ? s.result <= t
    : d.direction === "range"
      ? s.result >= t && u !== null && s.result <= u
      : s.result >= t;
}
export function assignedTo(
  assignments: Assignment[],
  userId: string,
  unit: string,
  indicator: string,
) {
  return assignments.some(
    (a) =>
      a.user_id === userId &&
      a.unit_id === unit &&
      (!a.indicator_id || a.indicator_id === indicator),
  );
}
export function transitionSteps(
  s: Submission,
  action: Transition,
  p: Profile,
  assignments: Assignment[],
  note: string,
): Submission["status"][] {
  if (!p.active) throw Error("Akun tidak aktif.");
  const owner =
    s.created_by === p.id &&
    p.role === "unit" &&
    assignedTo(assignments, p.id, s.unit_id, s.indicator_id);
  const validator =
    p.role === "validator" &&
    s.created_by !== p.id &&
    assignedTo(assignments, p.id, s.unit_id, s.indicator_id);
  if (action !== "submit" && !note.trim())
    throw Error("Catatan keputusan/alasan wajib diisi.");
  if (
    action === "submit" &&
    owner &&
    ["DRAFT", "NEEDS_REVISION", "NEEDS_CLARIFICATION"].includes(s.status)
  ) {
    calculate(s.snapshot.definition, s.data, true);
    return [s.status === "DRAFT" ? "SUBMITTED" : "RESUBMITTED"];
  }
  if (
    action === "start_validation" &&
    validator &&
    ["SUBMITTED", "RESUBMITTED"].includes(s.status)
  )
    return ["UNDER_VALIDATION"];
  if (action === "reject" && validator && s.status === "UNDER_VALIDATION")
    return ["NEEDS_REVISION"];
  if (action === "approve" && validator && s.status === "UNDER_VALIDATION")
    return ["VALIDATED", "PENDING_MUTU"];
  if (
    action === "clarify" &&
    p.role === "mutu" &&
    p.id !== s.created_by &&
    s.status === "PENDING_MUTU"
  )
    return ["NEEDS_CLARIFICATION"];
  if (
    action === "publish" &&
    p.role === "mutu" &&
    p.id !== s.created_by &&
    s.status === "PENDING_MUTU"
  )
    return ["PUBLISHED"];
  if (action === "amend" && owner && s.status === "PUBLISHED") return ["DRAFT"];
  throw Error("Transisi tidak sah atau akses ditolak.");
}
export function officialRows(rows: Submission[]): Submission[] {
  return rows.filter((s) => s.status === "PUBLISHED");
}
export function aggregate(rows: Submission[]): number | null {
  const eligible = officialRows(rows).filter((s) => s.result !== null);
  if (!eligible.length) return null;
  const first = eligible[0];
  if (
    eligible.some(
      (s) =>
        s.indicator_id !== first.indicator_id ||
        s.version_id !== first.version_id ||
        JSON.stringify(s.snapshot) !== JSON.stringify(first.snapshot),
    )
  )
    throw Error("Definisi/target tidak sebanding; tampilkan per versi.");
  const config = first.snapshot.definition;
  if (config.aggregation === "weighted")
    return (
      (eligible.reduce((sum, s) => sum + s.data.numerator!, 0) /
        eligible.reduce((sum, s) => sum + s.data.denominator!, 0)) *
      config.multiplier
    );
  if (config.aggregation === "sum")
    return eligible.reduce((sum, s) => sum + s.result!, 0);
  return eligible.length === 1 ? first.result : null;
}
export function monthlySeries(
  rows: Submission[],
  indicator: string,
  end: string,
  count: number,
) {
  const date = new Date(`${end.slice(0, 7)}-01T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => {
    const month = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - count + 1 + i, 1),
    )
      .toISOString()
      .slice(0, 10);
    const items = officialRows(rows).filter(
      (s) => s.indicator_id === indicator && s.period === month,
    );
    let value: number | null = null;
    let comparable = true;
    try {
      value = aggregate(items);
    } catch {
      comparable = false;
    }
    const numeric = items.filter((s) => s.result !== null);
    return {
      month: month.slice(0, 7),
      value,
      comparable,
      met:
        items[0] && value !== null
          ? meetsTarget({ ...items[0], result: value })
          : null,
      target: comparable ? (items[0]?.snapshot.target ?? null) : null,
      upper: comparable ? (items[0]?.snapshot.target_upper ?? null) : null,
      numerator: numeric.some((s) => s.data.numerator !== null)
        ? numeric.reduce((n, s) => n + (s.data.numerator ?? 0), 0)
        : null,
      denominator: numeric.some((s) => s.data.denominator !== null)
        ? numeric.reduce((n, s) => n + (s.data.denominator ?? 0), 0)
        : null,
      intervention: items
        .map((s) => s.data.intervention)
        .filter(Boolean)
        .join("; "),
    };
  });
}
export function failureStreak(
  rows: Submission[],
  indicator: string,
  unit: string,
) {
  const ordered = officialRows(rows)
    .filter((s) => s.indicator_id === indicator && s.unit_id === unit)
    .sort((a, b) => b.period.localeCompare(a.period));
  let count = 0;
  for (let i = 0; i < ordered.length; i++) {
    if (meetsTarget(ordered[i]) !== false) break;
    if (
      i &&
      new Date(ordered[i - 1].period).getTime() !==
        Date.UTC(
          new Date(ordered[i].period).getUTCFullYear(),
          new Date(ordered[i].period).getUTCMonth() + 1,
          1,
        )
    )
      break;
    count++;
  }
  return count;
}
export function overdueSlots(
  data: WorkflowData,
  period: string,
  today = new Date(),
) {
  const deadline = new Date(`${period}T00:00:00Z`);
  deadline.setUTCMonth(deadline.getUTCMonth() + 1);
  return data.indicator_units.filter((a) => {
    const due = new Date(
      Date.UTC(
        deadline.getUTCFullYear(),
        deadline.getUTCMonth(),
        a.due_day,
        23,
        59,
        59,
      ),
    );
    return (
      due < today &&
      !data.metrics.some(
        (s) =>
          s.unit_id === a.unit_id &&
          s.indicator_id === a.indicator_id &&
          s.period === period &&
          s.reported > 0,
      )
    );
  });
}
export function csvReport(rows: Submission[]) {
  const quote = (s: unknown) =>
    `"${String(s ?? "")
      .replace(/^[=+\-@\t\r]/, "'$&")
      .replaceAll('"', '""')}"`;
  const data = officialRows(rows).map((s) => [
    s.snapshot.code,
    s.unit_id,
    s.period,
    s.data.kind,
    s.data.numerator,
    s.data.denominator,
    s.result,
    s.snapshot.definition.unit_label,
    s.snapshot.target,
    s.snapshot.target_upper,
    s.snapshot.version,
    s.revision_no,
    s.published_at,
  ]);
  return (
    "\uFEFF" +
    [
      [
        "Kode",
        "Unit",
        "Periode",
        "Jenis",
        "Numerator",
        "Denominator",
        "Nilai",
        "Satuan",
        "Target",
        "Batas atas",
        "Versi definisi",
        "Revisi",
        "Diterbitkan",
      ],
      ...data,
    ]
      .map((row) => row.map(quote).join(";"))
      .join("\r\n")
  );
}
/** p chart: binary trials, independent observations, stable comparable baseline must be confirmed by the analyst. */
export function pChart(rows: Submission[], assumptionsConfirmed: boolean) {
  const baseline = officialRows(rows)
    .filter((s) => s.result !== null)
    .sort((a, b) => a.period.localeCompare(b.period));
  if (
    !assumptionsConfirmed ||
    baseline.length < 20 ||
    baseline.some(
      (s) =>
        s.snapshot.definition.measurement !== "proportion" ||
        s.unit_id !== baseline[0].unit_id ||
        s.version_id !== baseline[0].version_id,
    )
  )
    return null;
  for (let i = 1; i < baseline.length; i++)
    if (
      Date.UTC(
        new Date(baseline[i - 1].period).getUTCFullYear(),
        new Date(baseline[i - 1].period).getUTCMonth() + 1,
        1,
      ) !== new Date(baseline[i].period).getTime()
    )
      return null;
  const center =
    baseline.reduce((n, s) => n + s.data.numerator!, 0) /
    baseline.reduce((n, s) => n + s.data.denominator!, 0);
  return baseline.map((s) => ({
    month: s.period.slice(0, 7),
    value: s.result,
    center: center * 100,
    upper:
      Math.min(
        1,
        center + 3 * Math.sqrt((center * (1 - center)) / s.data.denominator!),
      ) * 100,
    lower:
      Math.max(
        0,
        center - 3 * Math.sqrt((center * (1 - center)) / s.data.denominator!),
      ) * 100,
  }));
}
