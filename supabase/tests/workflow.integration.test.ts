import { beforeAll, afterAll, describe, expect, it } from "vitest";
import EmbeddedPostgres from "embedded-postgres";
import { Client } from "pg";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { demoSeed, demoId } from "../../src/features/workflow/demoRepository";
import { emptyMeasurement } from "../../src/features/workflow/types";
let db: EmbeddedPostgres;
let root: Client;
let port: number;
const user = demoId(1),
  validator = demoId(2),
  mutu = demoId(3),
  leader = demoId(4),
  admin = demoId(5),
  outsider = demoId(6);
const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");
async function actor(id: string, sql: string, params: unknown[] = []) {
  const c = new Client({
    host: "127.0.0.1",
    port,
    user: "postgres",
    password: "test-only",
    database: "postgres",
  });
  await c.connect();
  try {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
    const result = await c.query(sql, params);
    await c.query("commit");
    return result;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    await c.end();
  }
}
const save = (
  id: string,
  n = 9,
  d = 10,
  who = user,
  period = "2026-04-01",
  extra = {},
) =>
  actor(
    who,
    "select to_jsonb(public.save_submission_draft($1,'DEMO-PROP','DEMO-A',$2,$3,0)) as s",
    [
      id,
      period,
      { ...emptyMeasurement, numerator: n, denominator: d, ...extra },
    ],
  ).then((r) => r.rows[0].s);
const transition = (
  id: string,
  version: number,
  action: string,
  who: string,
  request = randomUUID(),
  note = "Catatan uji",
) =>
  actor(
    who,
    "select to_jsonb(public.transition_submission($1,$2,$3,$4,$5)) as s",
    [id, version, action, note, request],
  ).then((r) => r.rows[0].s);
beforeAll(async () => {
  port = await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const selected = typeof addr === "object" && addr ? addr.port : 0;
      server.close(() => resolve(selected));
    });
  });
  db = new EmbeddedPostgres({
    databaseDir: join(await mkdtemp(join(tmpdir(), "rsas-db-")), "data"),
    port,
    user: "postgres",
    password: "test-only",
    persistent: false,
    initdbFlags: ["--locale=C", "--encoding=UTF8"],
    postgresFlags: [
      "-c",
      "wal_level=logical",
      "-c",
      "listen_addresses=127.0.0.1",
    ],
    onLog: () => {},
    onError: () => {},
  });
  await db.initialise();
  await db.start();
  root = db.getPgClient();
  await root.connect();
  await root.query(await read("./platform-fixture.sql"));
  try {
    await root.query(await read("../migrations/202611120001_workflow.sql"));
  } catch (e) {
    const err = e as {
      position?: string;
      internalPosition?: string;
      internalQuery?: string;
      message: string;
    };
    const sql = await read("../migrations/202611120001_workflow.sql");
    throw Error(
      `${err.message} position ${err.position} near ${sql.slice(Math.max(0, Number(err.position) - 150), Number(err.position) + 150)} internal ${err.internalPosition} ${err.internalQuery ?? ""}`,
    );
  }
  await root.query(await read("../migrations/202611120002_legacy_master.sql"));
  const seed = demoSeed();
  for (const p of [
    ...seed.profiles,
    {
      id: outsider,
      role: "validator",
      display_name: "Other unit",
      active: true,
    },
  ]) {
    await root.query("insert into auth.users values($1)", [p.id]);
    await root.query(
      "update public.profiles set role=$2,active=true,display_name=$3 where id=$1",
      [p.id, p.role, p.display_name],
    );
  }
  for (const u of seed.units)
    await root.query("insert into public.units(id,name) values($1,$2)", [
      u.id,
      u.name,
    ]);
  await actor(admin, "select public.admin_save_master($1)", [
    {
      indicator: seed.indicators[0],
      config: seed.versions[0].config,
      period: "2026-04-01",
      target: 95,
      target_upper: null,
      unit_ids: ["DEMO-A", "DEMO-B"],
    },
  ]);
  await root.query(
    "insert into public.user_unit_assignments(user_id,unit_id) values($1,'DEMO-A'),($2,'DEMO-A'),($3,'DEMO-B')",
    [user, validator, outsider],
  );
}, 60000);
afterAll(async () => {
  await root?.end();
  await db?.stop();
}, 30000);
describe("PostgreSQL workflow and RLS (real database, platform schemas emulated)", () => {
  it("retains all 34 source masters inactive without seeding production measurements", async () => {
    expect(
      (
        await root.query(
          "select count(*)::int n from public.indicators where id not like 'DEMO-%' and not active",
        )
      ).rows[0].n,
    ).toBe(34);
    expect(
      (
        await root.query(
          "select count(*)::int n from public.indicator_submissions",
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it("requires active account and blocks anonymous helpers, direct writes, and escalation", async () => {
    await expect(
      actor(outsider, "select public.admin_save_unit($1)", [
        { id: "EVIL", name: "test", active: true },
      ]),
    ).rejects.toThrow(/Admin/);
    await expect(
      actor(user, "update public.profiles set role='admin' where id=$1", [
        user,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      actor(user, "select public.record_change(null,null,'evil')"),
    ).rejects.toThrow(/permission denied/);
    await expect(actor(user, "delete from public.audit_logs")).rejects.toThrow(
      /permission denied/,
    );
    expect(
      (
        await root.query(
          "select has_function_privilege('anon','public.transition_submission(uuid,integer,text,text,uuid)','execute') as allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
  });
  it("validates formulas and distinguishes zero, no cases, N/A and missing server-side", async () => {
    await expect(save(randomUUID(), 11, 10)).rejects.toThrow(/Numerator/);
    await expect(save(randomUUID(), 0, 0)).rejects.toThrow(/Denominator nol/);
    await expect(save(randomUUID(), 1.5, 10)).rejects.toThrow(/bilangan bulat/);
    await expect(
      save(randomUUID(), 1, 10, user, "2026-04-01", { kind: "not_applicable" }),
    ).rejects.toThrow(/Alasan/);
    const id = randomUUID();
    const s = await save(id, 0, 10);
    expect(s.result).toBe(0);
    await expect(save(randomUUID(), 1, 10)).rejects.toThrow(/unique/);
    await root.query(
      "delete from public.submission_revisions where submission_id=$1",
      [id],
    );
    await root.query("delete from public.audit_logs where submission_id=$1", [
      id,
    ]);
    await root.query("delete from public.indicator_submissions where id=$1", [
      id,
    ]);
  });
  it("supports revision, clarification, publication, idempotency, immutable targets and amendment", async () => {
    const id = randomUUID();
    let s = await save(id);
    expect(s.status).toBe("DRAFT");
    expect(
      (
        await actor(
          outsider,
          "select * from public.indicator_submissions where id=$1",
          [id],
        )
      ).rowCount,
    ).toBe(0);
    await expect(
      transition(id, s.lock_version, "start_validation", outsider),
    ).rejects.toThrow(/akses ditolak/);
    await expect(
      transition(id, s.lock_version, "publish", leader),
    ).rejects.toThrow(/akses ditolak/);
    const key = randomUUID();
    s = await transition(id, s.lock_version, "submit", user, key);
    await root.query(
      "update public.profiles set role='validator' where id=$1",
      [user],
    );
    await expect(
      transition(id, s.lock_version, "start_validation", user),
    ).rejects.toThrow(/akses ditolak/);
    await root.query("update public.profiles set role='unit' where id=$1", [
      user,
    ]);
    const retry = await transition(id, 1, "submit", user, key);
    expect(retry.lock_version).toBe(s.lock_version);
    expect(
      (await actor(validator, "select * from public.notifications")).rowCount,
    ).toBe(1);
    expect(
      (await actor(leader, "select * from public.official_submissions"))
        .rowCount,
    ).toBe(0);
    await expect(
      transition(id, s.lock_version, "approve", user),
    ).rejects.toThrow(/akses ditolak/);
    s = await transition(id, s.lock_version, "start_validation", validator);
    await expect(
      transition(id, s.lock_version, "reject", validator, randomUUID(), ""),
    ).rejects.toThrow(/Catatan/);
    s = await transition(id, s.lock_version, "reject", validator);
    s = await transition(id, s.lock_version, "submit", user);
    expect(s.status).toBe("RESUBMITTED");
    s = await transition(id, s.lock_version, "start_validation", validator);
    s = await transition(id, s.lock_version, "approve", validator);
    expect(s.status).toBe("PENDING_MUTU");
    expect(
      (await actor(leader, "select * from public.official_submissions"))
        .rowCount,
    ).toBe(0);
    s = await transition(id, s.lock_version, "clarify", mutu);
    expect(s.status).toBe("NEEDS_CLARIFICATION");
    s = await transition(id, s.lock_version, "submit", user);
    s = await transition(id, s.lock_version, "start_validation", validator);
    s = await transition(id, s.lock_version, "approve", validator);
    s = await transition(id, s.lock_version, "publish", mutu);
    const official = (
      await actor(leader, "select payload from public.official_submissions")
    ).rows[0].payload;
    expect(official.result).toBe(90);
    expect(official.snapshot.target).toBe(95);
    const seed = demoSeed();
    await actor(admin, "select public.admin_save_master($1)", [
      {
        indicator: seed.indicators[0],
        config: seed.versions[0].config,
        period: "2026-04-01",
        target: 80,
        target_upper: null,
        unit_ids: ["DEMO-A"],
      },
    ]);
    expect(
      (await actor(leader, "select payload from public.official_submissions"))
        .rows[0].payload.snapshot.target,
    ).toBe(95);
    s = await transition(id, s.lock_version, "amend", user);
    expect(s.revision_no).toBe(2);
    expect(
      (
        await actor(
          leader,
          "select * from public.indicator_submissions where id=$1",
          [id],
        )
      ).rowCount,
    ).toBe(0);
    expect(
      (await actor(leader, "select payload from public.official_submissions"))
        .rows[0].payload.result,
    ).toBe(90);
    await expect(
      actor(
        user,
        "select public.save_submission_draft($1,'DEMO-PROP','DEMO-A','2026-04-01',$2,1)",
        [id, { ...emptyMeasurement, numerator: 8, denominator: 10 }],
      ),
    ).rejects.toThrow(/CONFLICT/);
    const revisions = await actor(
      user,
      "select * from public.submission_revisions where submission_id=$1",
      [id],
    );
    expect(revisions.rows.some((r) => r.payload.status === "VALIDATED")).toBe(
      true,
    );
    await expect(
      actor(user, "update public.submission_revisions set payload='{}'"),
    ).rejects.toThrow(/permission denied/);
  });
  it("validates scalar/rate formulas, structured N/A, and revoked accounts in SQL", async () => {
    const seed = demoSeed();
    for (const [index, value] of [
      [1, 12.5],
      [2, 0],
    ] as const) {
      const indicator = seed.indicators[index],
        config = seed.versions[index].config;
      await actor(admin, "select public.admin_save_master($1)", [
        {
          indicator,
          config,
          period: "2026-04-01",
          target: 15,
          target_upper: null,
          unit_ids: ["DEMO-A"],
        },
      ]);
      const measured = await actor(
        user,
        "select to_jsonb(public.save_submission_draft($1,$2,'DEMO-A','2026-04-01',$3,0)) s",
        [randomUUID(), indicator.id, { ...emptyMeasurement, value }],
      );
      expect(measured.rows[0].s.result).toBe(value);
      if (index === 2)
        await expect(
          actor(
            user,
            "select public.save_submission_draft($1,$2,'DEMO-A','2026-04-01',$3,0)",
            [randomUUID(), indicator.id, { ...emptyMeasurement, value: 0.5 }],
          ),
        ).rejects.toThrow(/tipe/);
    }
    await root.query(
      "insert into public.indicator_targets(version_id,period,target) select id,'2026-07-01',95 from public.indicator_versions where indicator_id='DEMO-PROP' order by version desc limit 1",
    );
    const s = await actor(
      user,
      "select to_jsonb(public.save_submission_draft($1,'DEMO-PROP','DEMO-A','2026-07-01',$2,0)) s",
      [
        randomUUID(),
        {
          ...emptyMeasurement,
          kind: "no_cases",
          reason_code: "NO_ELIGIBLE_CASES",
          reason: "Tanpa peluang eligible",
        },
      ],
    );
    expect(s.rows[0].s.result).toBe(null);
    await transition(s.rows[0].s.id, 1, "submit", user);
    await root.query("update public.profiles set active=false where id=$1", [
      user,
    ]);
    try {
      expect(
        (await actor(user, "select * from public.indicator_submissions"))
          .rowCount,
      ).toBe(0);
      await expect(
        transition(s.rows[0].s.id, 2, "amend", user),
      ).rejects.toThrow(/tidak aktif/);
    } finally {
      await root.query("update public.profiles set active=true where id=$1", [
        user,
      ]);
    }
  });
  it("serializes concurrent approvals; one wins, one receives a version conflict", async () => {
    await root.query(
      "insert into public.indicator_targets(version_id,period,target) select id,'2026-05-01',95 from public.indicator_versions where indicator_id='DEMO-PROP' order by version desc limit 1",
    );
    const id = randomUUID();
    let s = await save(id, 9, 10, user, "2026-05-01");
    s = await transition(id, s.lock_version, "submit", user);
    s = await transition(id, s.lock_version, "start_validation", validator);
    const results = await Promise.allSettled([
      transition(id, s.lock_version, "approve", validator),
      transition(id, s.lock_version, "approve", validator),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(
      (
        await root.query(
          "select count(*)::int n from public.validation_actions where submission_id=$1 and action='approve'",
          [id],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("enforces private storage scope and file metadata limits", async () => {
    const s = (
      await actor(
        user,
        "select * from public.indicator_submissions where status='DRAFT' limit 1",
      )
    ).rows[0];
    const path = `${s.id}/${randomUUID()}.pdf`;
    await actor(
      user,
      "insert into storage.objects(bucket_id,name,metadata) values('quality-evidence',$1,$2)",
      [path, { mimetype: "application/pdf", size: 100 }],
    );
    await expect(
      actor(outsider, "select public.register_evidence($1,$2)", [s.id, path]),
    ).rejects.toThrow(/Akses bukti/);
    await actor(user, "select public.register_evidence($1,$2)", [s.id, path]);
    expect(
      (await actor(outsider, "select * from storage.objects")).rowCount,
    ).toBe(0);
    await expect(
      actor(
        outsider,
        "insert into storage.objects(bucket_id,name) values('quality-evidence',$1)",
        [`${s.id}/${randomUUID()}.pdf`],
      ),
    ).rejects.toThrow(/row-level security/);
    const bad = `${s.id}/${randomUUID()}.exe`;
    await actor(
      user,
      "insert into storage.objects(bucket_id,name,metadata) values('quality-evidence',$1,$2)",
      [bad, { mimetype: "application/x-msdownload", size: 6000000 }],
    );
    await expect(
      actor(user, "select public.register_evidence($1,$2)", [s.id, bad]),
    ).rejects.toThrow(/check constraint/);
  });
  it("uses null for structured missing values and blocks incomplete submission", async () => {
    await root.query(
      "insert into public.indicator_targets(version_id,period,target) select id,'2026-06-01',95 from public.indicator_versions where indicator_id='DEMO-PROP' order by version desc limit 1",
    );
    const id = randomUUID();
    const s = await actor(
      user,
      "select to_jsonb(public.save_submission_draft($1,'DEMO-PROP','DEMO-A','2026-06-01',$2,0)) s",
      [
        id,
        {
          ...emptyMeasurement,
          kind: "missing",
          reason_code: "AWAITING_DATA",
          reason: "Menunggu data agregat",
        },
      ],
    );
    expect(s.rows[0].s.result).toBe(null);
    await expect(transition(id, 1, "submit", user)).rejects.toThrow(
      /belum lengkap/,
    );
  });
  it("deduplicates deadline notifications and refuses an unsafe last-admin change", async () => {
    await actor(mutu, "select public.enqueue_deadline_reminders()");
    const count = (
      await root.query("select count(*)::int n from public.notifications")
    ).rows[0].n;
    await actor(mutu, "select public.enqueue_deadline_reminders()");
    expect(
      (await root.query("select count(*)::int n from public.notifications"))
        .rows[0].n,
    ).toBe(count);
    await expect(
      actor(admin, "select public.admin_save_user($1,'[]')", [
        { id: admin, display_name: "Admin", role: "unit", active: true },
      ]),
    ).rejects.toThrow(/terakhir/);
  });
  it("requires explicit staging opt-in for the synthetic SQL seed", async () => {
    const sql = await read("../seed.demo.sql");
    await expect(root.query(sql)).rejects.toThrow(/staging opt-in/);
    await root.query("begin");
    await root.query(
      "select set_config('rsas.environment','staging',true),set_config('rsas.demo_unit_user',$1,true)",
      [user],
    );
    await root.query(sql);
    await root.query("commit");
    const result = await root.query(
      "select status,result from public.indicator_submissions where indicator_id='DEMO-SQL-PROP'",
    );
    expect(result.rows).toEqual([{ status: "DRAFT", result: "90" }]);
  });
  it("roundtrips a consistent logical workflow backup into a fresh database with RLS intact", async () => {
    const tables = [
      "profiles",
      "units",
      "indicators",
      "user_unit_assignments",
      "indicator_unit_assignments",
      "indicator_versions",
      "indicator_targets",
      "indicator_submissions",
      "submission_revisions",
      "validation_actions",
      "quality_reviews",
      "evidence_files",
      "corrective_actions",
      "notifications",
      "audit_logs",
      "workflow_requests",
    ];
    const snapshot: Record<string, unknown[]> = {};
    await root.query("begin isolation level repeatable read read only");
    const users = (await root.query("select * from auth.users")).rows;
    for (const table of tables)
      snapshot[table] = (
        await root.query(`select * from public.${table}`)
      ).rows;
    const official = (
      await root.query(
        "select * from public.official_submissions order by submission_id",
      )
    ).rows;
    await root.query("commit");
    await db.createDatabase("restore_check");
    const restored = db.getPgClient("restore_check");
    await restored.connect();
    try {
      const fixture = (await read("./platform-fixture.sql"))
        .replace("create role anon nologin;", "")
        .replace("create role authenticated nologin;", "");
      await restored.query(fixture);
      await restored.query(
        await read("../migrations/202611120001_workflow.sql"),
      );
      await restored.query("begin");
      await restored.query(
        "alter table auth.users disable trigger quality_user_created",
      );
      await restored.query(
        "insert into auth.users select * from jsonb_populate_recordset(null::auth.users,$1::jsonb)",
        [JSON.stringify(users)],
      );
      for (const table of tables)
        await restored.query(
          `insert into public.${table} select * from jsonb_populate_recordset(null::public.${table},$1::jsonb)`,
          [JSON.stringify(snapshot[table])],
        );
      await restored.query(
        "alter table auth.users enable trigger quality_user_created",
      );
      await restored.query("commit");
      expect(
        (
          await restored.query(
            "select * from public.official_submissions order by submission_id",
          )
        ).rows,
      ).toEqual(official);
      await restored.query("begin");
      await restored.query("set local role authenticated");
      await restored.query(
        "select set_config('request.jwt.claim.sub',$1,true)",
        [outsider],
      );
      expect(
        (await restored.query("select * from public.indicator_submissions"))
          .rowCount,
      ).toBe(0);
      await restored.query("rollback");
    } finally {
      await restored.end();
    }
  });
});
