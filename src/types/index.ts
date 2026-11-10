import { z } from "zod";
const text = z.string().max(4000);
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const pct = z.number().min(0).max(100);
export const indicatorSchema = z.object({
  id: z.string(),
  officialCode: z.string().nullable(),
  kind: z.enum(["rumah_sakit", "unit"]),
  unitId: z.string().nullable(),
  title: text,
  targetMasterPct: pct,
  targetProfilePct: pct.nullable(),
  effectiveTargetPct: pct.nullable(),
  targetVerification: z.enum(["sesuai", "perlu_verifikasi", "disahkan"]),
  numeratorDefinition: text,
  denominatorDefinition: text,
  definition: text,
  inclusion: text,
  exclusion: text,
  sampleRule: text,
  collectionMethod: text,
  dataSource: text,
  instrument: text,
  pic: text,
  sourceReference: text,
  profileStatus: z.enum(["tersedia", "belum_tersedia"]),
  aliases: z.array(text),
  minSample: count,
  version: count.min(1),
});
export type Indicator = z.infer<typeof indicatorSchema>;
export const recordSchema = z
  .object({
    id: z.uuid(),
    indicatorId: z.string(),
    unitId: z.string(),
    year: z.number().int().min(2020).max(2100),
    month: z.number().int().min(1).max(12),
    numerator: count,
    denominator: count,
    excludedCount: count,
    populationSize: count.nullable(),
    sampleMethod: text,
    noEligibleReason: text,
    sourceNote: text,
    evidenceReference: text,
    enteredBy: text,
    measuredAt: z.iso.date(),
    status: z.enum(["draft", "submitted", "returned", "verified"]),
    reviewNote: text,
    reviewer: text,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    revision: count.min(1),
    originDeviceId: z.uuid(),
    dataType: z.enum(["actual", "simulation"]),
    snapshot: indicatorSchema,
    overlapRisk: z.boolean(),
    comparabilityNote: text,
    samplePolicyNote: text,
    categories: z
      .array(z.object({ name: z.string().min(1).max(100), frequency: count }))
      .max(50)
      .default([]),
  })
  .superRefine((r, c) => {
    if (r.numerator > r.denominator)
      c.addIssue({
        code: "custom",
        path: ["numerator"],
        message: "Numerator tidak boleh melebihi denominator.",
      });
    if (r.denominator === 0 && !r.noEligibleReason.trim())
      c.addIssue({
        code: "custom",
        path: ["noEligibleReason"],
        message: "Alasan tidak ada objek ukur wajib diisi.",
      });
    if (r.snapshot.id !== r.indicatorId)
      c.addIssue({
        code: "custom",
        path: ["snapshot"],
        message: "Profil tidak sesuai indikator.",
      });
    if (r.snapshot.kind === "unit" && r.snapshot.unitId !== r.unitId)
      c.addIssue({
        code: "custom",
        path: ["unitId"],
        message: "Indikator bukan milik unit ini.",
      });
  });
export type MonthlyRecord = z.infer<typeof recordSchema>;
export const planSchema = z.object({
  id: z.uuid(),
  recordId: z.uuid(),
  problem: text.min(1),
  rootCause: text,
  action: text.min(1),
  owner: text.min(1),
  dueDate: z.iso.date(),
  status: z.enum(["OPEN", "IN PROGRESS", "CLOSED"]),
  evaluation: text,
});
export type ActionPlan = z.infer<typeof planSchema>;
export const auditSchema = z.object({
  id: z.uuid(),
  recordId: z.string(),
  action: text,
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  at: z.iso.datetime(),
  actorLabel: text,
});
export type AuditEvent = z.infer<typeof auditSchema>;
export const roles = [
  "Petugas Unit",
  "Kepala Unit",
  "Komite Mutu",
  "Admin/Pimpinan",
] as const;
export const stateSchema = z.object({
  schemaVersion: z.literal(1),
  storageRevision: z.string(),
  deviceId: z.uuid(),
  indicators: z.array(indicatorSchema).length(34),
  records: z.array(recordSchema),
  plans: z.array(planSchema),
  audit: z.array(auditSchema),
  assignments: z.record(z.string(), z.array(z.string())),
  settings: z.object({ dropThreshold: pct }),
});
export type AppState = z.infer<typeof stateSchema>;
export type Role = (typeof roles)[number];
export type Status =
  | "belum_dilaporkan"
  | "draft"
  | "diajukan"
  | "perlu_revisi"
  | "terverifikasi_tercapai"
  | "terverifikasi_belum_tercapai"
  | "n_a"
  | "target_belum_disahkan"
  | "profil_belum_lengkap"
  | "sampel_tidak_memadai";
