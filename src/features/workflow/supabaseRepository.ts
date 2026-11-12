import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CorrectiveAction,
  DraftInput,
  Evidence,
  MasterInput,
  Profile,
  Assignment,
  Submission,
  Transition,
  Unit,
  WorkflowData,
  WorkflowRepository,
} from "./types";
export const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);
export const productionMode =
  import.meta.env.VITE_DATA_MODE === "production" ||
  Boolean(
    import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_ANON_KEY,
  );
let client: SupabaseClient | null = null;
let configError =
  productionMode && !configured
    ? "Konfigurasi Supabase belum lengkap. Isi URL dan publishable/anon key; mode produksi tidak beralih ke demo."
    : "";
if (configured) {
  try {
    const url = new URL(import.meta.env.VITE_SUPABASE_URL);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        ))
    )
      throw Error();
    const key: string = import.meta.env.VITE_SUPABASE_ANON_KEY;
    let role = "";
    try {
      role =
        JSON.parse(
          atob(
            (key.split(".")[1] ?? "").replaceAll("-", "+").replaceAll("_", "/"),
          ),
        ).role ?? "";
    } catch {
      /* Publishable keys are not JWTs. */
    }
    if (key.startsWith("sb_secret_") || role === "service_role") throw Error();
    client = createClient(url.href, key, {
      auth: {
        persistSession: true,
        storage:
          typeof sessionStorage === "undefined" ? undefined : sessionStorage,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });
  } catch {
    configError =
      "Konfigurasi Supabase tidak valid. Gunakan URL HTTPS dan publishable/anon key; secret/service_role dilarang.";
  }
}
// Fail closed: a broken production configuration must never initialize synthetic data.
export const configurationError = configError;
export const supabase = client;
export async function checkEvidence(file: File) {
  if (file.size === 0 || file.size > 5 * 1024 * 1024)
    throw Error("Ukuran bukti harus 1 byte–5 MB.");
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const signatures: Record<string, number[]> = {
    "application/pdf": [37, 80, 68, 70, 45],
    "image/png": [137, 80, 78, 71, 13, 10, 26, 10],
    "image/jpeg": [255, 216, 255],
  };
  if (!signatures[file.type]?.every((byte, i) => bytes[i] === byte))
    throw Error(
      "Bukti hanya PDF, PNG, JPEG yang valid; jangan sertakan identitas pasien.",
    );
}
export class SupabaseRepository implements WorkflowRepository {
  constructor(private client: SupabaseClient) {}
  private async rpc<T>(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<T> {
    const { data, error } = await this.client.rpc(name, args);
    if (error) throw Error(error.message);
    return data as T;
  }
  async load(): Promise<WorkflowData> {
    const tables = {
      profiles: "profiles",
      assignments: "user_unit_assignments",
      units: "units",
      indicators: "indicators",
      versions: "indicator_versions",
      targets: "indicator_targets",
      submissions: "indicator_submissions",
      audit: "audit_logs",
      revisions: "submission_revisions",
      notifications: "notifications",
      evidence: "evidence_files",
      actions: "corrective_actions",
      indicator_units: "indicator_unit_assignments",
      official: "official_submissions",
    };
    // Paginate: PostgREST's default 1,000-row cap must never silently truncate reports.
    const result = await Promise.all(
      Object.entries(tables).map(async ([key, table]) => {
        const rows: unknown[] = [];
        const order =
          table === "official_submissions"
            ? "submission_id"
            : table === "indicator_unit_assignments"
              ? "indicator_id"
              : "id";
        for (let offset = 0; ; offset += 500) {
          let query = this.client
            .from(table)
            .select("*")
            .order(order)
            .range(offset, offset + 499);
          if (table === "indicator_unit_assignments")
            query = query.order("unit_id");
          const { data, error } = await query;
          if (error) throw Error(error.message);
          rows.push(...data);
          if (data.length < 500) break;
        }
        return [
          key,
          key === "official"
            ? rows.map((r) => (r as { payload: Submission }).payload)
            : rows,
        ];
      }),
    );
    const metrics = await this.rpc<WorkflowData["metrics"]>("workflow_summary");
    return {
      ...Object.fromEntries(result),
      metrics,
    } as unknown as WorkflowData;
  }
  saveDraft(input: DraftInput) {
    return this.rpc<Submission>("save_submission_draft", {
      p_id: input.id,
      p_indicator_id: input.indicator_id,
      p_unit_id: input.unit_id,
      p_period: input.period,
      p_data: input.data,
      p_expected_version: input.expected_version,
    });
  }
  // Keep the request token after a transport error so a retry is idempotent.
  private requests = new Map<string, string>();
  async transition(s: Submission, action: Transition, note: string) {
    const key = `${s.id}:${s.lock_version}:${action}:${note}`;
    const id = this.requests.get(key) ?? crypto.randomUUID();
    this.requests.set(key, id);
    const response = await this.rpc<Submission>("transition_submission", {
      p_id: s.id,
      p_expected_version: s.lock_version,
      p_action: action,
      p_note: note,
      p_request_id: id,
    });
    this.requests.delete(key);
    return response;
  }
  async markRead(id: string) {
    await this.rpc("mark_notification_read", { p_id: id });
  }
  async saveAction(action: CorrectiveAction) {
    await this.rpc("save_corrective_action", { p_action: action });
  }
  async upload(s: Submission, file: File) {
    await checkEvidence(file);
    const extension = {
      "application/pdf": "pdf",
      "image/png": "png",
      "image/jpeg": "jpg",
    }[file.type];
    const path = `${s.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await this.client.storage
      .from("quality-evidence")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw Error(error.message);
    await this.rpc("register_evidence", {
      p_submission_id: s.id,
      p_path: path,
    });
  }
  async evidenceUrl(e: Evidence) {
    const { data, error } = await this.client.storage
      .from("quality-evidence")
      .createSignedUrl(e.object_path, 60, { download: true });
    if (error) throw Error(error.message);
    return data.signedUrl;
  }
  async saveMaster(input: MasterInput) {
    await this.rpc("admin_save_master", { p_input: input });
  }
  async saveUser(p: Profile, assignments: Assignment[]) {
    await this.rpc("admin_save_user", {
      p_profile: p,
      p_assignments: assignments,
    });
  }
  async saveUnit(unit: Unit) {
    await this.rpc("admin_save_unit", { p_unit: unit });
  }
  async remind() {
    await this.rpc("enqueue_deadline_reminders");
  }
  subscribe(onChange: () => void) {
    const channel = this.client
      .channel(`quality-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "indicator_submissions" },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "corrective_actions" },
        onChange,
      )
      .subscribe();
    return () => {
      void this.client.removeChannel(channel);
    };
  }
}
