import { assignedTo, calculate, transitionSteps } from "./rules";
import { definitionSchema, emptyMeasurement } from "./types";
import type {
  Assignment,
  CorrectiveAction,
  DraftInput,
  Evidence,
  MasterInput,
  Profile,
  Submission,
  Transition,
  Unit,
  WorkflowData,
  WorkflowRepository,
  WorkflowRole,
} from "./types";
import { checkEvidence } from "./supabaseRepository";
export const DEMO_KEY = "rsas-quality-monitor:demo-workflow:v1";
export const demoId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const demoProfiles: Profile[] = (
  ["unit", "validator", "mutu", "leader", "admin"] as WorkflowRole[]
).map((role, i) => ({
  id: demoId(i + 1),
  role,
  display_name: `${role} DEMO`,
  active: true,
}));
export function demoSeed(): WorkflowData {
  const now = new Date().toISOString();
  const config = definitionSchema.parse({
    definition:
      "DEMO sintetis: kepatuhan proses latihan, bukan definisi klinis resmi.",
    numerator_label: "Peluang patuh (DEMO)",
    denominator_label: "Total peluang (DEMO)",
    measurement: "proportion",
    multiplier: 100,
    direction: "higher_is_better",
    aggregation: "weighted",
    unit_label: "%",
    frequency: "monthly",
    source: "Data sintetis",
    inclusion: "Peluang latihan",
    exclusion: "Tidak ada",
    owner: "Tim latihan",
    min_sample: 0,
    min_value: 0,
    max_value: 100,
  });
  const indicators: WorkflowData["indicators"] = [
    {
      id: "DEMO-PROP",
      code: "DEMO-PROP",
      name: "Kepatuhan proses sintetis",
      category: "INM",
      active: true,
    },
    {
      id: "DEMO-TIME",
      code: "DEMO-TIME",
      name: "Waktu proses sintetis",
      category: "IMP-RS",
      active: true,
    },
    {
      id: "DEMO-COUNT",
      code: "DEMO-COUNT",
      name: "Jumlah kegiatan sintetis",
      category: "IMP-Unit",
      active: true,
    },
  ];
  const versions = indicators.map((indicator, i) => ({
    id: demoId(100 + i),
    indicator_id: indicator.id,
    version: 1,
    created_at: now,
    config: {
      ...config,
      measurement: (["proportion", "time", "count"] as const)[i],
      direction:
        i === 1 ? ("lower_is_better" as const) : ("higher_is_better" as const),
      aggregation:
        i === 0
          ? ("weighted" as const)
          : i === 1
            ? ("none" as const)
            : ("sum" as const),
      unit_label: i === 0 ? "%" : i === 1 ? "menit" : "kegiatan",
      max_value: i === 0 ? 100 : 1e6,
    },
  }));
  const targets = versions.flatMap((v, i) =>
    Array.from({ length: 12 }, (_, m) => ({
      id: demoId(200 + i * 12 + m),
      version_id: v.id,
      period: `2026-${String(m + 1).padStart(2, "0")}-01`,
      target: i === 0 ? 95 : i === 1 ? 15 : 10,
      target_upper: null,
    })),
  );
  const published: Submission[] = Array.from({ length: 3 }, (_, i) => ({
    id: demoId(300 + i),
    indicator_id: indicators[0].id,
    unit_id: "DEMO-A",
    period: `2026-${String(i + 1).padStart(2, "0")}-01`,
    version_id: versions[0].id,
    target_id: targets[i].id,
    snapshot: {
      definition: versions[0].config,
      target: 95,
      target_upper: null,
      version: 1,
      code: indicators[0].code,
      name: indicators[0].name,
    },
    data: {
      ...emptyMeasurement,
      numerator: 87 - i,
      denominator: 100,
      intervention: i === 2 ? "DEMO: pelatihan proses" : "",
    },
    result: 87 - i,
    status: "PUBLISHED",
    lock_version: 5,
    revision_no: 1,
    created_by: demoProfiles[0].id,
    created_at: now,
    updated_at: now,
    published_at: now,
  }));
  return {
    metrics: [],
    profiles: demoProfiles,
    assignments: demoProfiles
      .slice(0, 2)
      .map((p) => ({ user_id: p.id, unit_id: "DEMO-A", indicator_id: null })),
    units: [
      { id: "DEMO-A", name: "Unit Latihan A", active: true },
      { id: "DEMO-B", name: "Unit Latihan B", active: true },
    ],
    indicators,
    versions,
    targets,
    submissions: published,
    official: published,
    audit: [],
    revisions: published.map((s) => ({
      id: crypto.randomUUID(),
      submission_id: s.id,
      payload: s,
      created_at: now,
    })),
    notifications: [],
    evidence: [],
    actions: [],
    indicator_units: indicators.map((i) => ({
      indicator_id: i.id,
      unit_id: "DEMO-A",
      due_day: 10,
    })),
  };
}
export class DemoRepository implements WorkflowRepository {
  constructor(
    private profile: Profile,
    private storage: Storage = localStorage,
  ) {}
  private read(): WorkflowData {
    const raw = this.storage.getItem(DEMO_KEY);
    if (raw) {
      try {
        const state = JSON.parse(raw) as WorkflowData;
        if (!Array.isArray(state.submissions) || !Array.isArray(state.versions))
          throw Error();
        return state;
      } catch {
        throw Error(
          "Data DEMO rusak. Unduh salinan dari Pengaturan sebelum reset; arsip lama tidak diubah.",
        );
      }
    }
    const state = demoSeed();
    this.storage.setItem(DEMO_KEY, JSON.stringify(state));
    return state;
  }
  private commit(data: WorkflowData) {
    this.storage.setItem(DEMO_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event("rsas-demo-change"));
  }
  private canRead(d: WorkflowData, s: Submission) {
    return (
      ["admin", "mutu", "leader"].includes(this.profile.role) ||
      assignedTo(d.assignments, this.profile.id, s.unit_id, s.indicator_id)
    );
  }
  async load() {
    const d = this.read();
    const ids = new Set(
      d.submissions.filter((s) => this.canRead(d, s)).map((s) => s.id),
    );
    const metrics = d.submissions
      .filter((s) => this.canRead(d, s))
      .map((s) => ({
        indicator_id: s.indicator_id,
        unit_id: s.unit_id,
        period: s.period,
        pending_validation: [
          "SUBMITTED",
          "RESUBMITTED",
          "UNDER_VALIDATION",
        ].includes(s.status)
          ? 1
          : 0,
        pending_mutu: s.status === "PENDING_MUTU" ? 1 : 0,
        reported:
          d.official.some((x) => x.id === s.id) ||
          !["DRAFT", "NEEDS_REVISION", "NEEDS_CLARIFICATION"].includes(s.status)
            ? 1
            : 0,
        validation_hours: 0,
        validation_count: 0,
      }));
    return {
      ...d,
      metrics,
      submissions: d.submissions.filter(
        (s) =>
          ids.has(s.id) &&
          (this.profile.role !== "leader" || s.status === "PUBLISHED"),
      ),
      official: d.official.filter((s) => this.canRead(d, s)),
      audit: d.audit.filter(
        (a) => !a.submission_id || ids.has(a.submission_id),
      ),
      revisions: d.revisions.filter(
        (r) =>
          ids.has(r.submission_id) &&
          (this.profile.role !== "leader" || r.payload.status === "PUBLISHED"),
      ),
      assignments: d.assignments.filter(
        (a) =>
          a.user_id === this.profile.id ||
          ["admin", "mutu"].includes(this.profile.role),
      ),
      notifications: d.notifications.filter(
        (n) => n.recipient_id === this.profile.id,
      ),
      actions: d.actions.filter((a) => ids.has(a.submission_id)),
      evidence: d.evidence.filter((e) => ids.has(e.submission_id)),
    };
  }
  private log(
    d: WorkflowData,
    s: Submission,
    before: Submission | null,
    note: string,
  ) {
    d.revisions.push({
      id: crypto.randomUUID(),
      submission_id: s.id,
      payload: structuredClone(s),
      created_at: s.updated_at,
    });
    d.audit.push({
      id: crypto.randomUUID(),
      submission_id: s.id,
      actor_id: this.profile.id,
      action: s.status,
      before_state: before
        ? { status: before.status, lock_version: before.lock_version }
        : null,
      after_state: { status: s.status, lock_version: s.lock_version },
      reason: note,
      created_at: s.updated_at,
    });
  }
  async saveDraft(input: DraftInput) {
    const d = this.read();
    if (
      this.profile.role !== "unit" ||
      !assignedTo(
        d.assignments,
        this.profile.id,
        input.unit_id,
        input.indicator_id,
      )
    )
      throw Error("Akses unit ditolak.");
    const old = d.submissions.find((s) => s.id === input.id);
    if (
      old &&
      (old.created_by !== this.profile.id ||
        !["DRAFT", "NEEDS_REVISION", "NEEDS_CLARIFICATION"].includes(
          old.status,
        ) ||
        old.unit_id !== input.unit_id ||
        old.indicator_id !== input.indicator_id ||
        old.period !== input.period)
    )
      throw Error("Draft terkunci.");
    if ((old?.lock_version ?? 0) !== input.expected_version)
      throw Error("CONFLICT: muat ulang data.");
    if (
      !old &&
      d.submissions.some(
        (s) =>
          s.indicator_id === input.indicator_id &&
          s.unit_id === input.unit_id &&
          s.period === input.period,
      )
    )
      throw Error("Periode sudah memiliki pengajuan.");
    const version = d.versions
      .filter(
        (v) =>
          v.indicator_id === input.indicator_id &&
          d.targets.some(
            (t) => t.version_id === v.id && t.period === input.period,
          ),
      )
      .sort((a, b) => b.version - a.version)[0];
    const target = d.targets.find(
      (t) => t.version_id === version?.id && t.period === input.period,
    );
    const indicator = d.indicators.find(
      (i) => i.id === input.indicator_id && i.active,
    );
    if (!indicator || (!old && (!version || !target || target.target === null)))
      throw Error("Target/definisi periode belum disahkan Admin.");
    const now = new Date().toISOString();
    const snapshot = old?.snapshot ?? {
      definition: version.config,
      target: target!.target!,
      target_upper: target!.target_upper,
      version: version.version,
      code: indicator.code,
      name: indicator.name,
    };
    const s: Submission = {
      ...(old ?? {
        id: input.id,
        indicator_id: input.indicator_id,
        unit_id: input.unit_id,
        period: input.period,
        version_id: version.id,
        target_id: target!.id,
        snapshot,
        status: "DRAFT",
        revision_no: 1,
        created_by: this.profile.id,
        created_at: now,
        published_at: null,
      }),
      data: input.data,
      result: calculate(snapshot.definition, input.data),
      lock_version: input.expected_version + 1,
      updated_at: now,
    };
    d.submissions = [...d.submissions.filter((x) => x.id !== s.id), s];
    this.log(d, s, old ?? null, "Simpan draft DEMO");
    this.commit(d);
    return s;
  }
  async transition(record: Submission, action: Transition, note: string) {
    const d = this.read();
    let s = d.submissions.find((s) => s.id === record.id);
    if (!s || s.lock_version !== record.lock_version)
      throw Error("CONFLICT: versi berubah; muat ulang.");
    const steps = transitionSteps(s, action, this.profile, d.assignments, note);
    for (const status of steps) {
      const before = structuredClone(s);
      s = {
        ...s,
        status,
        lock_version: s.lock_version + 1,
        revision_no: s.revision_no + (action === "amend" ? 1 : 0),
        updated_at: new Date().toISOString(),
        published_at:
          status === "PUBLISHED"
            ? new Date().toISOString()
            : action === "amend"
              ? null
              : s.published_at,
      };
      this.log(d, s, before, note);
    }
    if (s.status === "PUBLISHED")
      d.official = [...d.official.filter((x) => x.id !== s!.id), s];
    d.submissions = d.submissions.map((x) => (x.id === s!.id ? s! : x));
    const recipients = d.profiles.filter((p) =>
      action === "submit"
        ? p.role === "validator" &&
          assignedTo(d.assignments, p.id, s!.unit_id, s!.indicator_id)
        : action === "approve"
          ? p.role === "mutu"
          : action === "publish"
            ? p.role === "leader"
            : p.id === s!.created_by,
    );
    recipients.forEach((p) =>
      d.notifications.push({
        id: crypto.randomUUID(),
        recipient_id: p.id,
        message: `${s!.snapshot.code} · ${s!.status} (DEMO)`,
        target_url:
          p.role === "validator"
            ? "/validator"
            : p.role === "mutu"
              ? "/mutu/inbox"
              : p.role === "leader"
                ? "/pimpinan/dashboard"
                : "/unit/submissions",
        created_at: s!.updated_at,
        read_at: null,
      }),
    );
    this.commit(d);
    return s;
  }
  async markRead(id: string) {
    const d = this.read();
    d.notifications = d.notifications.map((n) =>
      n.id === id && n.recipient_id === this.profile.id
        ? { ...n, read_at: new Date().toISOString() }
        : n,
    );
    this.commit(d);
  }
  async saveAction(a: CorrectiveAction) {
    const d = this.read();
    const s = d.submissions.find((s) => s.id === a.submission_id);
    if (
      !s ||
      !this.canRead(d, s) ||
      !["unit", "mutu"].includes(this.profile.role)
    )
      throw Error("Akses ditolak.");
    const old = d.actions.find((x) => x.id === a.id);
    if ((old?.lock_version ?? 0) !== a.lock_version)
      throw Error("CONFLICT: tindak lanjut berubah.");
    if (
      !a.action.trim() ||
      !a.owner.trim() ||
      (a.status === "CLOSED" && !a.evaluation.trim())
    )
      throw Error("Tindakan/PIC/evaluasi wajib.");
    d.actions = [
      ...d.actions.filter((x) => x.id !== a.id),
      { ...a, lock_version: a.lock_version + 1 },
    ];
    this.commit(d);
  }
  async upload(s: Submission, file: File) {
    await checkEvidence(file);
    const d = this.read();
    const current = d.submissions.find((x) => x.id === s.id);
    if (
      !current ||
      current.created_by !== this.profile.id ||
      !["DRAFT", "NEEDS_REVISION", "NEEDS_CLARIFICATION"].includes(
        current.status,
      )
    )
      throw Error("Bukti hanya untuk draft sendiri.");
    const id = crypto.randomUUID();
    await blobStore(id, file);
    d.evidence.push({
      id,
      submission_id: s.id,
      object_path: id,
      mime_type: file.type,
      size_bytes: file.size,
      created_at: new Date().toISOString(),
    });
    this.commit(d);
  }
  async evidenceUrl(e: Evidence) {
    const file = await blobStore(e.object_path);
    if (!file) throw Error("Bukti DEMO tidak tersedia di browser ini.");
    return URL.createObjectURL(file);
  }
  async saveMaster(input: MasterInput) {
    if (this.profile.role !== "admin") throw Error("Admin diperlukan.");
    definitionSchema.parse(input.config);
    const d = this.read();
    const v = {
      id: crypto.randomUUID(),
      indicator_id: input.indicator.id,
      version:
        Math.max(
          0,
          ...d.versions
            .filter((v) => v.indicator_id === input.indicator.id)
            .map((v) => v.version),
        ) + 1,
      config: input.config,
      created_at: new Date().toISOString(),
    };
    d.indicators = [
      ...d.indicators.filter((i) => i.id !== input.indicator.id),
      input.indicator,
    ];
    d.versions.push(v);
    d.targets.push({
      id: crypto.randomUUID(),
      version_id: v.id,
      period: input.period,
      target: input.target,
      target_upper: input.target_upper,
    });
    input.unit_ids.forEach((unit_id) => {
      if (
        !d.indicator_units.some(
          (a) => a.unit_id === unit_id && a.indicator_id === input.indicator.id,
        )
      )
        d.indicator_units.push({
          unit_id,
          indicator_id: input.indicator.id,
          due_day: 10,
        });
    });
    this.commit(d);
  }
  async saveUser(p: Profile, a: Assignment[]) {
    if (this.profile.role !== "admin") throw Error("Admin diperlukan.");
    const d = this.read();
    d.profiles = d.profiles.map((x) => (x.id === p.id ? p : x));
    d.assignments = [...d.assignments.filter((x) => x.user_id !== p.id), ...a];
    this.commit(d);
  }
  async saveUnit(u: Unit) {
    if (this.profile.role !== "admin") throw Error("Admin diperlukan.");
    const d = this.read();
    d.units = [...d.units.filter((x) => x.id !== u.id), u];
    this.commit(d);
  }
  async remind() {
    if (!["admin", "mutu"].includes(this.profile.role))
      throw Error("Akses ditolak.");
  }
  subscribe(onChange: () => void) {
    const change = (e: StorageEvent) => {
      if (e.key === DEMO_KEY) onChange();
    };
    window.addEventListener("storage", change);
    window.addEventListener("rsas-demo-change", onChange);
    return () => {
      window.removeEventListener("storage", change);
      window.removeEventListener("rsas-demo-change", onChange);
    };
  }
}
async function blobStore(key: string, value?: Blob): Promise<Blob | undefined> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("rsas-demo-evidence", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onerror = () => reject(Error("Penyimpanan bukti DEMO gagal."));
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("files", value ? "readwrite" : "readonly");
      const op = value
        ? tx.objectStore("files").put(value, key)
        : tx.objectStore("files").get(key);
      let result: Blob | undefined;
      op.onsuccess = () => {
        result = op.result as Blob | undefined;
      };
      tx.oncomplete = () => {
        db.close();
        resolve(value ?? result);
      };
      tx.onerror = () => {
        db.close();
        reject(Error("Penyimpanan bukti DEMO gagal."));
      };
    };
  });
}
