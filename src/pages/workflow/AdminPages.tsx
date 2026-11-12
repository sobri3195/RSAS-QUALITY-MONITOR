import { useState } from "react";
import { Heading, Panel } from "../../components/ui";
import { useWorkflow } from "../../features/workflow/WorkflowProvider";
import {
  definitionSchema,
  roleNames,
  workflowRoles,
  type Assignment,
  type Definition,
  type Indicator,
  type MasterInput,
  type Profile,
  type Unit,
} from "../../features/workflow/types";
const blank: Definition = {
  definition: "",
  numerator_label: "",
  denominator_label: "",
  measurement: "proportion",
  multiplier: 100,
  direction: "higher_is_better",
  aggregation: "weighted",
  unit_label: "%",
  frequency: "monthly",
  source: "",
  inclusion: "",
  exclusion: "",
  owner: "",
  min_sample: 0,
  min_value: 0,
  max_value: 100,
};
export function WorkflowMaster() {
  const { data, profile, repo, run, busy } = useWorkflow();
  const [selected, setSelected] = useState("");
  const indicator = data!.indicators.find((i) => i.id === selected);
  const version = data!.versions
    .filter((v) => v.indicator_id === selected)
    .sort((a, b) => b.version - a.version)[0];
  return (
    <>
      <Heading eyebrow="KONFIGURASI" title="Master Indikator">
        INM · IMP-RS · IMP-Unit. Setiap penyimpanan membuat versi definisi dan
        target periode baru; histori tidak dihitung ulang.
      </Heading>
      <Panel title="Daftar master">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama / kategori</th>
                <th>Status</th>
                <th>Versi</th>
              </tr>
            </thead>
            <tbody>
              {data!.indicators.map((i) => (
                <tr key={i.id}>
                  <td>
                    <button
                      className="text-link"
                      onClick={() => setSelected(i.id)}
                    >
                      {i.code}
                    </button>
                  </td>
                  <td>
                    {i.name}
                    <small>{i.category}</small>
                  </td>
                  <td>{i.active ? "Aktif" : "Menunggu konfigurasi"}</td>
                  <td>
                    {
                      data!.versions.filter((v) => v.indicator_id === i.id)
                        .length
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {version && (
        <Panel title={`Definisi ${indicator!.code} v${version.version}`}>
          <div className="form-content">
            <p>{version.config.definition || "Belum dikonfigurasi"}</p>
            <p>
              Formula {version.config.measurement} · Arah{" "}
              {version.config.direction} · Agregasi {version.config.aggregation}
            </p>
            <p>
              Numerator: {version.config.numerator_label || "—"}
              <br />
              Denominator: {version.config.denominator_label || "—"}
            </p>
            <p>
              Sumber: {version.config.source} · PIC:{" "}
              {version.config.owner || "Belum dikonfigurasi"}
            </p>
            <p>
              Inklusi: {version.config.inclusion || "—"} · Eksklusi:{" "}
              {version.config.exclusion || "—"}
            </p>
            {data!.targets
              .filter((t) => t.version_id === version.id)
              .map((t) => (
                <p key={t.id}>
                  {t.period.slice(0, 7)} · Target {t.target ?? "Belum disahkan"}
                  {t.target_upper !== null ? ` – ${t.target_upper}` : ""}
                </p>
              ))}
          </div>
        </Panel>
      )}
      {profile!.role === "admin" && (
        <>
          <button className="button" onClick={() => setSelected("")}>
            Indikator baru
          </button>
          <MasterForm
            key={selected}
            indicator={indicator}
            config={version?.config}
            onSave={(input) =>
              run(
                () => repo!.saveMaster(input),
                "Versi definisi dan target periode disimpan.",
              )
            }
            disabled={busy}
          />
        </>
      )}
    </>
  );
}
function MasterForm({
  indicator,
  config,
  onSave,
  disabled,
}: {
  indicator?: Indicator;
  config?: Definition;
  onSave: (input: MasterInput) => Promise<unknown>;
  disabled: boolean;
}) {
  const { data } = useWorkflow();
  const [identity, setIdentity] = useState<Indicator>(
    indicator ?? { id: "", code: "", name: "", category: "INM", active: true },
  );
  const [definition, setDefinition] = useState(config ?? blank);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [target, setTarget] = useState("");
  const [upper, setUpper] = useState("");
  const [unitIds, setUnitIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  return (
    <Panel
      title={indicator ? "Buat versi / target periode baru" : "Tambah master"}
    >
      <form
        className="form-content"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const parsed = definitionSchema.safeParse(definition);
          if (!parsed.success) {
            setError(parsed.error.issues.map((i) => i.message).join(" "));
            return;
          }
          if (
            definition.direction === "range" &&
            (upper === "" || Number(upper) < Number(target))
          ) {
            setError("Rentang target tidak valid.");
            return;
          }
          await onSave({
            indicator: identity,
            config: parsed.data,
            period: `${period}-01`,
            target: Number(target),
            target_upper: upper === "" ? null : Number(upper),
            unit_ids: unitIds,
          });
        }}
      >
        <fieldset disabled={disabled}>
          <div className="form-grid">
            <label>
              ID stabil
              <input
                aria-label="ID stabil"
                value={identity.id}
                required
                maxLength={100}
                disabled={Boolean(indicator)}
                onChange={(e) =>
                  setIdentity({ ...identity, id: e.target.value })
                }
              />
            </label>
            <label>
              Kode
              <input
                aria-label="Kode"
                value={identity.code}
                required
                maxLength={100}
                onChange={(e) =>
                  setIdentity({ ...identity, code: e.target.value })
                }
              />
            </label>
            <label>
              Nama indikator
              <input
                aria-label="Nama indikator"
                value={identity.name}
                required
                maxLength={1000}
                onChange={(e) =>
                  setIdentity({ ...identity, name: e.target.value })
                }
              />
            </label>
            <label>
              Kategori master
              <select
                aria-label="Kategori master"
                value={identity.category}
                onChange={(e) =>
                  setIdentity({
                    ...identity,
                    category: e.target.value as Indicator["category"],
                  })
                }
              >
                {["INM", "IMP-RS", "IMP-Unit"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Jenis formula
              <select
                aria-label="Jenis formula"
                value={definition.measurement}
                onChange={(e) => {
                  const measurement = e.target
                    .value as Definition["measurement"];
                  setDefinition({
                    ...definition,
                    measurement,
                    aggregation: ["proportion", "rate"].includes(measurement)
                      ? "weighted"
                      : "none",
                    multiplier: measurement === "proportion" ? 100 : 1,
                    max_value: measurement === "proportion" ? 100 : 1e12,
                    unit_label:
                      measurement === "proportion"
                        ? "%"
                        : measurement === "time"
                          ? "menit"
                          : "jumlah",
                  });
                }}
              >
                {["proportion", "rate", "time", "count"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Arah keberhasilan
              <select
                aria-label="Arah keberhasilan"
                value={definition.direction}
                onChange={(e) =>
                  setDefinition({
                    ...definition,
                    direction: e.target.value as Definition["direction"],
                  })
                }
              >
                {["higher_is_better", "lower_is_better", "range"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Agregasi aman
              <select
                aria-label="Agregasi aman"
                value={definition.aggregation}
                onChange={(e) =>
                  setDefinition({
                    ...definition,
                    aggregation: e.target.value as Definition["aggregation"],
                  })
                }
              >
                {["weighted", "sum", "none"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          {(
            [
              "definition",
              "numerator_label",
              "denominator_label",
              "source",
              "inclusion",
              "exclusion",
              "owner",
              "unit_label",
            ] as const
          ).map((key, i) => (
            <label key={key}>
              {
                [
                  "Definisi operasional",
                  "Definisi numerator",
                  "Definisi denominator",
                  "Sumber data / referensi pengesahan",
                  "Kriteria inklusi",
                  "Kriteria eksklusi",
                  "Penanggung jawab",
                  "Satuan ukur",
                ][i]
              }
              <textarea
                value={definition[key]}
                required={[
                  "definition",
                  "source",
                  "owner",
                  "unit_label",
                ].includes(key)}
                maxLength={
                  key === "definition"
                    ? 4000
                    : key === "owner"
                      ? 200
                      : key === "unit_label"
                        ? 100
                        : 1000
                }
                onChange={(e) =>
                  setDefinition({ ...definition, [key]: e.target.value })
                }
              />
            </label>
          ))}
          <div className="form-grid">
            {(
              ["multiplier", "min_sample", "min_value", "max_value"] as const
            ).map((key, i) => (
              <label key={key}>
                {
                  [
                    "Pengali rasio",
                    "Sampel minimal",
                    "Batas nilai minimum",
                    "Batas nilai maksimum",
                  ][i]
                }
                <input
                  type="number"
                  required
                  min={key === "multiplier" || key === "max_value" ? 0.0001 : 0}
                  step={key === "min_sample" ? 1 : "any"}
                  max="1000000000000"
                  value={definition[key]}
                  onChange={(e) =>
                    setDefinition({
                      ...definition,
                      [key]: Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
            <label>
              Periode target
              <input
                aria-label="Periode target"
                type="month"
                required
                min="2020-01"
                max="2100-12"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </label>
            <label>
              Target sah
              <input
                aria-label="Target sah"
                type="number"
                required
                min="0"
                max="1000000000000"
                step="any"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </label>
            {definition.direction === "range" && (
              <label>
                Batas atas target
                <input
                  aria-label="Batas atas target"
                  type="number"
                  required
                  min={target}
                  max="1000000000000"
                  step="any"
                  value={upper}
                  onChange={(e) => setUpper(e.target.value)}
                />
              </label>
            )}
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={identity.active}
              onChange={(e) =>
                setIdentity({ ...identity, active: e.target.checked })
              }
            />
            Aktif untuk pelaporan baru
          </label>
          <label>
            Tambahkan pemetaan indikator ke unit (pilih banyak)
            <select
              aria-label="Tambahkan pemetaan indikator ke unit (pilih banyak)"
              multiple
              value={unitIds}
              onChange={(e) =>
                setUnitIds(Array.from(e.target.selectedOptions, (o) => o.value))
              }
            >
              {data!.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <small>
              Pemetaan lama tetap dipertahankan. Frekuensi saat ini bulanan.
            </small>
          </label>
          <button className="button primary">
            Sahkan versi & target periode
          </button>
          {error && (
            <p className="alert warning" role="alert">
              {error}
            </p>
          )}
        </fieldset>
      </form>
    </Panel>
  );
}
export function UserManagement() {
  const { data, repo, run, busy } = useWorkflow();
  const [selected, setSelected] = useState("");
  const profile = data!.profiles.find((p) => p.id === selected);
  return (
    <>
      <Heading eyebrow="OTORISASI" title="Manajemen User">
        Buat atau invite akun melalui Supabase Auth. Akun baru tidak aktif
        sampai Admin menetapkan role dan unit.
      </Heading>
      <Panel title="Akun yang terdaftar">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Akun</th>
                <th>Role</th>
                <th>Status</th>
                <th>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {data!.profiles.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.display_name}
                    <small>{p.id}</small>
                  </td>
                  <td>{roleNames[p.role]}</td>
                  <td>{p.active ? "Aktif" : "Nonaktif"}</td>
                  <td>
                    <button
                      className="text-link"
                      onClick={() => setSelected(p.id)}
                    >
                      Atur akun
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {profile && (
        <UserForm
          key={profile.id}
          profile={profile}
          assignments={data!.assignments.filter(
            (a) => a.user_id === profile.id,
          )}
          onSave={(p, a) =>
            run(() => repo!.saveUser(p, a), "Role dan penugasan disimpan.")
          }
          disabled={busy}
        />
      )}
      <UnitForm />
    </>
  );
}
function UserForm({
  profile,
  assignments,
  onSave,
  disabled,
}: {
  profile: Profile;
  assignments: Assignment[];
  onSave: (p: Profile, a: Assignment[]) => Promise<unknown>;
  disabled: boolean;
}) {
  const { data } = useWorkflow();
  const [p, setP] = useState(profile);
  const [mapping, setMapping] = useState(assignments);
  return (
    <Panel title="Role & penugasan validator/unit">
      <form
        className="form-content"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(p, mapping);
        }}
      >
        <fieldset disabled={disabled}>
          <label>
            Label akun
            <input
              aria-label="Label akun"
              value={p.display_name}
              required
              maxLength={200}
              onChange={(e) => setP({ ...p, display_name: e.target.value })}
            />
          </label>
          <label>
            Role server
            <select
              aria-label="Role server"
              value={p.role}
              onChange={(e) =>
                setP({ ...p, role: e.target.value as Profile["role"] })
              }
            >
              {workflowRoles.map((r) => (
                <option key={r} value={r}>
                  {roleNames[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={p.active}
              onChange={(e) => setP({ ...p, active: e.target.checked })}
            />
            Akun aktif
          </label>
          {data!.units.map((u) => (
            <label key={u.id}>
              {u.name} · penugasan (pilih banyak)
              <select
                multiple
                value={mapping
                  .filter((a) => a.unit_id === u.id)
                  .map((a) => a.indicator_id ?? "*")}
                onChange={(e) => {
                  const chosen = Array.from(
                    e.target.selectedOptions,
                    (o) => o.value,
                  );
                  const ids = chosen.includes("*") ? ["*"] : chosen;
                  setMapping([
                    ...mapping.filter((a) => a.unit_id !== u.id),
                    ...ids.map((indicator_id) => ({
                      user_id: p.id,
                      unit_id: u.id,
                      indicator_id: indicator_id === "*" ? null : indicator_id,
                    })),
                  ]);
                }}
              >
                <option value="*">Semua indikator unit ini</option>
                {data!.indicators.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button className="button primary">Simpan otorisasi</button>
        </fieldset>
      </form>
    </Panel>
  );
}
function UnitForm() {
  const { data, repo, run, busy } = useWorkflow();
  const [unit, setUnit] = useState<Unit>({ id: "", name: "", active: true });
  return (
    <Panel title="Konfigurasi unit">
      <div className="form-content">
        <div className="toolbar-actions">
          {data!.units.map((u) => (
            <button key={u.id} className="text-link" onClick={() => setUnit(u)}>
              {u.name}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => repo!.saveUnit(unit), "Unit disimpan.");
          }}
        >
          <label>
            ID unit
            <input
              aria-label="ID unit"
              value={unit.id}
              required
              maxLength={100}
              onChange={(e) => setUnit({ ...unit, id: e.target.value })}
            />
          </label>
          <label>
            Nama unit
            <input
              aria-label="Nama unit"
              value={unit.name}
              required
              maxLength={200}
              onChange={(e) => setUnit({ ...unit, name: e.target.value })}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={unit.active}
              onChange={(e) => setUnit({ ...unit, active: e.target.checked })}
            />
            Unit aktif
          </label>
          <button className="button primary" disabled={busy}>
            Simpan unit
          </button>
        </form>
      </div>
    </Panel>
  );
}
