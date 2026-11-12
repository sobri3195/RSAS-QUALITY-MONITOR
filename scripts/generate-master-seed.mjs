import { readFile, writeFile } from "node:fs/promises";
const source = JSON.parse(
  await readFile(
    new URL("../src/data/rsas_master_indikator_2026.json", import.meta.url),
    "utf8",
  ),
);
const quote = (v) =>
  v === null ? "null" : `'${String(v).replaceAll("'", "''")}'`;
const lines = [
  "-- Source: unchanged 2026 JSON. All masters inactive pending clinical configuration and approval.",
  "-- No synthetic measurements or inferred clinical definitions are seeded in production.",
  "begin;",
];
for (const entry of source.entries) {
  if (entry.unit_id)
    lines.push(
      `insert into public.units(id,name) values(${quote(entry.unit_id)},${quote(entry.unit_name)}) on conflict do nothing;`,
    );
  lines.push(
    `insert into public.indicators(id,code,name,category,active) values(${quote(entry.id)},${quote(entry.official_code ?? entry.id)},${quote(entry.title)},${quote(entry.kind === "unit" ? "IMP-Unit" : "IMP-RS")},false);`,
  );
  const config = {
    definition: "",
    numerator_label: entry.numerator_definition ?? "",
    denominator_label: entry.denominator_definition ?? "",
    measurement: "proportion",
    multiplier: 100,
    direction:
      entry.comparison === "<=" ? "lower_is_better" : "higher_is_better",
    aggregation: "weighted",
    unit_label: "%",
    frequency: "monthly",
    source: `Master sumber 2026 halaman ${entry.source.master_pdf_page}. Lengkapi definisi dan pengesahan sebelum aktif.`,
    inclusion: "",
    exclusion: "",
    owner: "",
    min_sample: entry.id === "IMP-RS-05" ? 200 : 0,
    min_value: 0,
    max_value: 100,
  };
  lines.push(
    `insert into public.indicator_versions(indicator_id,version,config) values(${quote(entry.id)},1,${quote(JSON.stringify(config))}::jsonb);`,
  );
  // Source targets are deliberately not made effective for any reporting period automatically.
  if (entry.unit_id)
    lines.push(
      `insert into public.indicator_unit_assignments(indicator_id,unit_id) values(${quote(entry.id)},${quote(entry.unit_id)});`,
    );
}
lines.push("commit;");
await writeFile(
  new URL(
    "../supabase/migrations/202611120002_legacy_master.sql",
    import.meta.url,
  ),
  lines.join("\n") + "\n",
);
