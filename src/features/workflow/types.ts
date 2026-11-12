import { z } from "zod";
export const workflowRoles = [
  "admin",
  "unit",
  "validator",
  "mutu",
  "leader",
] as const;
export type WorkflowRole = (typeof workflowRoles)[number];
export const roleNames: Record<WorkflowRole, string> = {
  admin: "Admin",
  unit: "Petugas Unit",
  validator: "Validator",
  mutu: "Tim Mutu",
  leader: "Pimpinan",
};
export const statuses = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_VALIDATION",
  "VALIDATED",
  "PENDING_MUTU",
  "NEEDS_REVISION",
  "RESUBMITTED",
  "NEEDS_CLARIFICATION",
  "PUBLISHED",
] as const;
export type WorkflowStatus = (typeof statuses)[number];
export const statusNames: Record<WorkflowStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Diajukan",
  UNDER_VALIDATION: "Dalam validasi",
  VALIDATED: "Lolos validasi",
  PENDING_MUTU: "Menunggu Tim Mutu",
  NEEDS_REVISION: "Perlu revisi",
  RESUBMITTED: "Diajukan ulang",
  NEEDS_CLARIFICATION: "Perlu klarifikasi",
  PUBLISHED: "Diterbitkan",
};
export interface Profile {
  id: string;
  display_name: string;
  role: WorkflowRole;
  active: boolean;
}
export interface Assignment {
  user_id: string;
  unit_id: string;
  indicator_id: string | null;
}
export interface Unit {
  id: string;
  name: string;
  active: boolean;
}
export interface Indicator {
  id: string;
  code: string;
  name: string;
  category: "INM" | "IMP-RS" | "IMP-Unit";
  active: boolean;
}
export const definitionSchema = z
  .object({
    definition: z.string().min(1).max(4000),
    numerator_label: z.string().max(1000),
    denominator_label: z.string().max(1000),
    measurement: z.enum(["proportion", "rate", "time", "count"]),
    multiplier: z.number().positive().max(1000000),
    direction: z.enum(["higher_is_better", "lower_is_better", "range"]),
    aggregation: z.enum(["weighted", "sum", "none"]),
    unit_label: z.string().min(1).max(100),
    frequency: z.literal("monthly"),
    source: z.string().min(1).max(1000),
    inclusion: z.string().max(2000),
    exclusion: z.string().max(2000),
    owner: z.string().min(1).max(200),
    min_sample: z.number().int().nonnegative(),
    min_value: z.number().nonnegative(),
    max_value: z.number().positive().max(1e12),
  })
  .superRefine((d, ctx) => {
    if (d.min_value > d.max_value)
      ctx.addIssue({ code: "custom", message: "Rentang nilai tidak valid." });
    if (d.measurement === "proportion" && d.multiplier !== 100)
      ctx.addIssue({
        code: "custom",
        message: "Proporsi memakai pengali 100.",
      });
    if (
      ["proportion", "rate"].includes(d.measurement) !==
      (d.aggregation === "weighted")
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Proporsi/rate harus memakai agregasi tertimbang; nilai lain memakai sum/none.",
      });
  });
export type Definition = z.infer<typeof definitionSchema>;
export interface IndicatorVersion {
  id: string;
  indicator_id: string;
  version: number;
  config: Definition;
  created_at: string;
}
export interface IndicatorTarget {
  id: string;
  version_id: string;
  period: string;
  target: number | null;
  target_upper: number | null;
}
export const measurementSchema = z.object({
  kind: z.enum(["measured", "no_cases", "not_applicable", "missing"]),
  numerator: z.number().min(0).max(1e12).nullable(),
  denominator: z.number().min(0).max(1e12).nullable(),
  value: z.number().min(0).max(1e12).nullable(),
  reason_code: z.enum([
    "",
    "NO_ELIGIBLE_CASES",
    "NOT_APPLICABLE",
    "AWAITING_DATA",
  ]),
  reason: z.string().max(2000),
  notes: z.string().max(4000),
  intervention: z.string().max(1000),
});
export type Measurement = z.infer<typeof measurementSchema>;
export const emptyMeasurement: Measurement = {
  kind: "measured",
  numerator: null,
  denominator: null,
  value: null,
  reason_code: "",
  reason: "",
  notes: "",
  intervention: "",
};
export interface Submission {
  id: string;
  indicator_id: string;
  unit_id: string;
  period: string;
  version_id: string;
  target_id: string;
  snapshot: {
    definition: Definition;
    target: number;
    target_upper: number | null;
    version: number;
    code: string;
    name: string;
  };
  data: Measurement;
  result: number | null;
  status: WorkflowStatus;
  lock_version: number;
  revision_no: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}
export interface Audit {
  id: string;
  submission_id: string | null;
  actor_id: string;
  action: string;
  before_state: { status?: string; lock_version?: number } | null;
  after_state: { status?: string; lock_version?: number } | null;
  reason: string;
  created_at: string;
}
export interface Revision {
  id: string;
  submission_id: string;
  payload: Submission;
  created_at: string;
}
export interface Notification {
  id: string;
  recipient_id: string;
  message: string;
  target_url: string;
  read_at: string | null;
  created_at: string;
}
export interface Evidence {
  id: string;
  submission_id: string;
  object_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}
export interface CorrectiveAction {
  id: string;
  submission_id: string;
  root_cause: string;
  recommendation: string;
  action: string;
  owner: string;
  due_date: string;
  evidence: string;
  evaluation: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  lock_version: number;
}
export interface IndicatorUnit {
  indicator_id: string;
  unit_id: string;
  due_day: number;
}
export interface WorkflowSummary {
  indicator_id: string;
  unit_id: string;
  period: string;
  pending_validation: number;
  pending_mutu: number;
  reported: number;
  validation_hours: number;
  validation_count: number;
}
export interface WorkflowData {
  metrics: WorkflowSummary[];
  profiles: Profile[];
  assignments: Assignment[];
  units: Unit[];
  indicators: Indicator[];
  versions: IndicatorVersion[];
  targets: IndicatorTarget[];
  submissions: Submission[];
  official: Submission[];
  audit: Audit[];
  revisions: Revision[];
  notifications: Notification[];
  evidence: Evidence[];
  actions: CorrectiveAction[];
  indicator_units: IndicatorUnit[];
}
export type Transition =
  | "submit"
  | "start_validation"
  | "reject"
  | "approve"
  | "publish"
  | "clarify"
  | "amend";
export interface DraftInput {
  id: string;
  indicator_id: string;
  unit_id: string;
  period: string;
  data: Measurement;
  expected_version: number;
}
export interface MasterInput {
  indicator: Indicator;
  config: Definition;
  period: string;
  target: number;
  target_upper: number | null;
  unit_ids: string[];
}
export interface WorkflowRepository {
  load(): Promise<WorkflowData>;
  saveDraft(input: DraftInput): Promise<Submission>;
  transition(
    s: Submission,
    action: Transition,
    note: string,
  ): Promise<Submission>;
  markRead(id: string): Promise<void>;
  saveAction(action: CorrectiveAction): Promise<void>;
  upload(s: Submission, file: File): Promise<void>;
  evidenceUrl(e: Evidence): Promise<string>;
  saveMaster(input: MasterInput): Promise<void>;
  saveUser(p: Profile, assignments: Assignment[]): Promise<void>;
  saveUnit(unit: Unit): Promise<void>;
  remind(): Promise<void>;
  subscribe(onChange: () => void): () => void;
}
