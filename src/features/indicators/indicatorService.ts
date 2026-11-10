import seed from "../../data/rsas_master_indikator_2026.json";
import type { Indicator } from "../../types";
export const units = seed.entries
  .filter((e) => e.kind === "unit")
  .map((e) => ({
    id: e.unit_id!,
    name: e.unit_name!,
    aliases:
      e.unit_id === "UNIT-05"
        ? ["HILU"]
        : e.unit_id === "UNIT-13"
          ? ["Loundry"]
          : [],
  }));
export const unitName = (id: string) =>
  units.find((u) => u.id === id)?.name ?? id;
export const seedIndicators: Indicator[] = seed.entries.map((e) => ({
  id: e.id,
  officialCode: e.official_code ?? null,
  kind: e.kind as Indicator["kind"],
  unitId: e.unit_id,
  title: e.title,
  targetMasterPct: e.target_master_pct,
  targetProfilePct: e.target_profile_pct,
  effectiveTargetPct: e.effective_target_pct,
  targetVerification:
    e.effective_target_pct === null ? "perlu_verifikasi" : "sesuai",
  numeratorDefinition: e.numerator_definition ?? "",
  denominatorDefinition: e.denominator_definition ?? "",
  definition: "",
  inclusion: "",
  exclusion: "",
  sampleRule:
    e.id === "IMP-RS-05" ? "Minimal 200 peluang per unit per bulan" : "",
  collectionMethod: "",
  dataSource: "",
  instrument: "",
  pic: "",
  sourceReference: `Master 2026, halaman ${e.source.master_pdf_page}; ${e.source.profile_pdf ?? "Profil rinci belum tersedia"}`,
  profileStatus: e.profile_status as Indicator["profileStatus"],
  aliases:
    e.unit_id === "UNIT-05"
      ? ["HILU"]
      : e.unit_id === "UNIT-13"
        ? ["Loundry"]
        : [],
  minSample: e.id === "IMP-RS-05" ? 200 : 0,
  version: 1,
}));
export function profileComplete(i: Indicator) {
  return (
    i.profileStatus === "tersedia" &&
    !!i.numeratorDefinition.trim() &&
    !!i.denominatorDefinition.trim()
  );
}
export function validateIndicatorIdentity(i: Indicator) {
  const source = seedIndicators.find((s) => s.id === i.id);
  if (
    !source ||
    source.kind !== i.kind ||
    source.unitId !== i.unitId ||
    source.officialCode !== i.officialCode ||
    source.targetMasterPct !== i.targetMasterPct ||
    source.targetProfilePct !== i.targetProfilePct
  )
    throw Error(
      "Identitas atau target sumber indikator tidak boleh diubah oleh impor.",
    );
}
export function assigned(
  i: Indicator,
  unitId: string,
  assignments: Record<string, string[]>,
) {
  return i.kind === "unit"
    ? i.unitId === unitId
    : (assignments[unitId] ?? []).includes(i.id);
}
