import { describe, it, expect } from "vitest";
import {
  seedIndicators,
  units,
  profileComplete,
  assigned,
} from "../features/indicators/indicatorService";
import { recordSchema } from "../types";
import {
  recordStatus,
  percentage,
  gap,
  aggregate,
  alerts,
  finalEligible,
  paretoData,
} from "../features/analytics/analyticsService";
import { saveRecord, reviewRecord } from "../features/entries/recordService";
import {
  initialState,
  loadStorage,
  persist,
  STORAGE_KEY,
  validateState,
} from "../lib/storageService";
import {
  exportBundle,
  parseBundle,
  previewImport,
  mergeBundles,
  recordsCSV,
  csvCell,
} from "../lib/importExportService";
import { reportRows } from "../features/reports/reportService";
import { record } from "./fixtures";
describe("Master resmi 2026", () => {
  it("memuat 34 master, 24 unit, dan kode RS lengkap", () => {
    expect(seedIndicators).toHaveLength(34);
    expect(units).toHaveLength(24);
    expect(seedIndicators.slice(0, 10).map((i) => i.id)).toEqual(
      Array.from(
        { length: 10 },
        (_, i) => `IMP-RS-${String(i + 1).padStart(2, "0")}`,
      ),
    );
    expect(seedIndicators.slice(0, 10).map((i) => i.targetMasterPct)).toEqual([
      100, 95, 100, 100, 85, 95, 90, 95, 95, 95,
    ]);
  });
  it.each(["IMP-RS-06", "RSAS-U-22"])(
    "tidak meluluskan target konflik %s",
    (id) => {
      const i = seedIndicators.find((i) => i.id === id)!;
      expect(i.effectiveTargetPct).toBeNull();
      expect(recordStatus(record({ indicatorId: id, snapshot: i }), i)).toBe(
        "target_belum_disahkan",
      );
    },
  );
  it("Humas tidak memiliki definisi buatan", () => {
    const i = seedIndicators.find((i) => i.id === "RSAS-U-21")!;
    expect(profileComplete(i)).toBe(false);
    expect(i.numeratorDefinition).toBe("");
    expect(i.denominatorDefinition).toBe("");
    expect(recordStatus(record({ snapshot: i, indicatorId: i.id }), i)).toBe(
      "profil_belum_lengkap",
    );
  });
  it("menyimpan alias tanpa duplikasi unit", () => {
    expect(units.find((u) => u.name === "HLIU")?.aliases).toContain("HILU");
    expect(units.find((u) => u.name === "Laundry")?.aliases).toContain(
      "Loundry",
    );
  });
  it("tidak menugaskan observasi RS secara diam-diam", () => {
    expect(
      assigned(seedIndicators[0], "UNIT-01", initialState().assignments),
    ).toBe(false);
  });
});
describe("Validasi dan perhitungan", () => {
  it("45/50 = 90%, gap -5 pp, hanya lulus penilaian setelah verifikasi", () => {
    const r = record();
    expect(percentage(45, 50)).toBe(90);
    expect(gap(90, 95)).toBe(-5);
    expect(recordStatus({ ...r, status: "submitted" }, r.snapshot)).toBe(
      "diajukan",
    );
    expect(recordStatus(r, r.snapshot)).toBe("terverifikasi_belum_tercapai");
  });
  it.each([
    [-1, 50],
    [51, 50],
    [1.5, 50],
    [1, -1],
    [NaN, 10],
    [Infinity, 10],
    [1, 2.2],
  ])("menolak numerator/denominator %s/%s", (numerator, denominator) => {
    expect(
      recordSchema.safeParse(record({ numerator, denominator })).success,
    ).toBe(false);
  });
  it("N/A memerlukan alasan dan tidak menjadi 0 atau Infinity", () => {
    expect(
      recordSchema.safeParse(record({ numerator: 0, denominator: 0 })).success,
    ).toBe(false);
    const r = record({
      numerator: 0,
      denominator: 0,
      noEligibleReason: "Tidak ada objek ukur",
    });
    expect(recordSchema.safeParse(r).success).toBe(true);
    expect(percentage(0, 0)).toBeNull();
    expect(recordStatus(r, r.snapshot)).toBe("n_a");
  });
  it("tidak mengurangi eksklusi dua kali", () => {
    const r = record({ excludedCount: 12 });
    expect(aggregate([r]).value).toBe(90);
  });
  it("menggunakan presisi sebelum pembulatan", () => {
    const r = record({
      numerator: 99999,
      denominator: 100000,
      snapshot: { ...record().snapshot, effectiveTargetPct: 100 },
    });
    expect(recordStatus(r, r.snapshot)).toBe("terverifikasi_belum_tercapai");
  });
  it.each([
    [10, 50],
    [100, 1000 / 110],
  ])("agregasi tertimbang denominator Februari %s", (denominator, expected) => {
    const a = record({ numerator: 9, denominator: 10 });
    const b = record({ numerator: 1, denominator, month: 2 });
    expect(aggregate([a, b]).value).toBeCloseTo(expected);
  });
  it("tidak menggabungkan indikator, versi, metode atau unit yang belum sebanding", () => {
    const a = record();
    expect(
      aggregate([a, record({ indicatorId: "RSAS-U-04", unitId: "UNIT-04" })])
        .value,
    ).toBeNull();
    expect(
      aggregate([a, record({ snapshot: { ...a.snapshot, version: 2 } })]).value,
    ).toBeNull();
    expect(
      aggregate([a, record({ sampleMethod: "Sampling acak" })]).value,
    ).toBeNull();
    const rs = record({ indicatorId: "IMP-RS-01", unitId: "UNIT-01" });
    expect(
      aggregate([rs, { ...rs, id: crypto.randomUUID(), unitId: "UNIT-02" }])
        .value,
    ).toBeNull();
  });
  it("memblokir sumber tumpang tindih dari final", () => {
    expect(finalEligible(record({ overlapRisk: true }))).toBe(false);
  });
  it("minimal 200 peluang per unit bulan, tidak tersamarkan agregasi", () => {
    const r = record({
      indicatorId: "IMP-RS-05",
      numerator: 100,
      denominator: 150,
      unitId: "UNIT-01",
    });
    expect(recordStatus(r, r.snapshot)).toBe("sampel_tidak_memadai");
    expect(aggregate([r]).value).toBeNull();
    expect(
      finalEligible({
        ...r,
        samplePolicyNote: "Kebijakan tindak lanjut Komite dengan referensi",
      }),
    ).toBe(true);
  });
  it("simulasi dan belum diverifikasi tidak masuk agregat final", () => {
    expect(
      aggregate([
        record({ dataType: "simulation" }),
        record({ status: "draft" }),
      ]).value,
    ).toBeNull();
  });
  it("memberi notifikasi dua kegagalan dan penurunan >5 pp", () => {
    const a = record({ numerator: 44 }),
      b = record({ numerator: 40, month: 2 });
    expect(
      alerts([a, b], 5)
        .map((a) => a.message)
        .join(" "),
    ).toContain("Dua periode");
    expect(
      alerts([a, b], 5)
        .map((a) => a.message)
        .join(" "),
    ).toContain("Turun 8,0 pp");
  });
  it("Pareto memakai frekuensi aktual dan urutan kumulatif", () => {
    expect(
      paretoData([
        record({
          categories: [
            { name: "A", frequency: 2 },
            { name: "B", frequency: 8 },
          ],
        }),
      ]),
    ).toEqual([
      { name: "B", frequency: 8, cumulative: 80 },
      { name: "A", frequency: 2, cumulative: 100 },
    ]);
  });
});
describe("Pelaporan, snapshot dan penyimpanan", () => {
  it("mencegah duplikasi periode tersembunyi dan mendukung revisi", () => {
    const s = initialState();
    const r = record();
    s.records = [r];
    expect(() => saveRecord(s, record())).toThrow("Periode sudah terisi");
    expect(
      saveRecord(s, { ...r, revision: 2, numerator: 40, status: "draft" })
        .records,
    ).toHaveLength(1);
  });
  it("verifikasi hanya laporan diajukan dan memerlukan catatan", () => {
    const r = record({ status: "submitted" });
    expect(() =>
      reviewRecord(r, "verified", "ok", "Tim", "Petugas Unit"),
    ).toThrow();
    expect(() =>
      reviewRecord(r, "verified", "", "Tim", "Komite Mutu"),
    ).toThrow();
    expect(
      reviewRecord(r, "verified", "Catatan", "Tim", "Komite Mutu").status,
    ).toBe("verified");
    expect(() =>
      reviewRecord(record(), "returned", "Catatan", "Tim", "Komite Mutu"),
    ).toThrow();
  });
  it("perubahan master tidak mengubah snapshot historis", () => {
    const s = initialState(),
      r = record();
    s.records = [r];
    s.indicators = s.indicators.map((i) =>
      i.id === r.indicatorId ? { ...i, effectiveTargetPct: 80, version: 2 } : i,
    );
    expect(
      recordStatus(
        s.records[0],
        s.indicators.find((i) => i.id === r.indicatorId)!,
      ),
    ).toBe("terverifikasi_belum_tercapai");
  });
  it("persist dan refresh mempertahankan laporan", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    };
    const s = initialState();
    s.records = [record()];
    persist(storage, s, s.storageRevision);
    expect(loadStorage(storage).state.records[0]).toEqual(s.records[0]);
  });
  it("JSON rusak tidak ditimpa otomatis", () => {
    const storage = { getItem: () => "{rusak" };
    const loaded = loadStorage(storage);
    expect(loaded.error).toContain("rusak");
    expect(loaded.state.records).toHaveLength(0);
  });
  it("kuota gagal tidak diklaim tersimpan", () => {
    const s = initialState();
    expect(() =>
      persist(
        {
          getItem: () => null,
          setItem: () => {
            throw Error("QuotaExceededError");
          },
        },
        s,
        s.storageRevision,
      ),
    ).toThrow("Penyimpanan gagal");
  });
  it("mencegah tab lama menimpa perubahan baru", () => {
    const s = initialState();
    expect(() =>
      persist(
        {
          getItem: () => JSON.stringify({ ...s, storageRevision: "different" }),
          setItem: () => {},
        },
        s,
        s.storageRevision,
      ),
    ).toThrow("tab lain");
  });
  it("namespace sesuai versi dan master kosong tanpa capaian", () => {
    expect(STORAGE_KEY).toBe("rsas-quality-monitor:v1:dataset");
    expect(initialState().records).toHaveLength(0);
    expect(reportRows([])).toHaveLength(0);
  });
});
describe("Konsolidasi dan laporan", () => {
  it("roundtrip antarperangkat, dedupe, serta angka grafik/laporan konsisten", () => {
    const a = initialState();
    a.records = [record()];
    const b = parseBundle(JSON.stringify(exportBundle(a, "UNIT-03")));
    const empty = initialState();
    const merged = mergeBundles(empty, [b], {}, "Admin");
    expect(merged.records).toHaveLength(1);
    expect(mergeBundles(merged, [b], {}, "Admin").records).toHaveLength(1);
    expect(reportRows(merged.records)[0].value).toBe(
      aggregate(merged.records).value,
    );
  });
  it("mengungkap konflik draft lama terhadap verified dan tidak menimpa diam-diam", () => {
    const local = initialState(),
      r = record();
    local.records = [r];
    const incoming = {
      ...initialState(),
      records: [{ ...r, numerator: 1, status: "draft" as const, revision: 1 }],
    };
    const bundle = exportBundle(incoming, "UNIT-03");
    const preview = previewImport(local, [bundle]);
    expect(preview[0].conflict).toBe(true);
    expect(() => mergeBundles(local, [bundle], {}, "Admin")).toThrow("konflik");
    expect(
      mergeBundles(local, [bundle], { "0:0": "local" }, "Admin").records[0]
        .status,
    ).toBe("verified");
    expect(
      mergeBundles(local, [bundle], { "0:0": "import" }, "Admin").records[0]
        .numerator,
    ).toBe(1);
  });
  it("dedupe kunci periode meski UUID berbeda", () => {
    const local = initialState();
    local.records = [record()];
    const incoming = initialState();
    incoming.records = [record({ numerator: 40 })];
    const b = exportBundle(incoming, "UNIT-03");
    expect(
      mergeBundles(local, [b], { "0:0": "import" }, "Admin").records,
    ).toHaveLength(1);
  });
  it("ID sama dengan indikator lain harus ditolak", () => {
    const s = initialState(),
      r = record();
    s.records = [r];
    const incoming = initialState();
    incoming.records = [
      record({ id: r.id, indicatorId: "RSAS-U-04", unitId: "UNIT-04" }),
    ];
    expect(() =>
      mergeBundles(
        s,
        [exportBundle(incoming, "UNIT-04")],
        { "0:0": "import" },
        "Admin",
      ),
    ).toThrow("ID sama");
  });
  it("menolak unit, ID, dan schemaVersion tidak dikenal", () => {
    const s = initialState();
    s.records = [record()];
    const b = exportBundle(s, "UNIT-03");
    expect(() =>
      parseBundle(JSON.stringify({ ...b, schemaVersion: 2 })),
    ).toThrow();
    expect(() =>
      parseBundle(
        JSON.stringify({
          ...b,
          records: [{ ...b.records[0], unitId: "UNKNOWN" }],
        }),
      ),
    ).toThrow();
    expect(() =>
      parseBundle(
        JSON.stringify({
          ...b,
          records: [{ ...b.records[0], indicatorId: "OTHER" }],
        }),
      ),
    ).toThrow();
  });
  it("backup valid serta tidak mengekspor simulasi sebagai data unit", () => {
    const s = initialState();
    s.records = [record(), record({ dataType: "simulation" })];
    expect(exportBundle(s, "UNIT-03").records).toHaveLength(1);
    expect(
      parseBundle(JSON.stringify(exportBundle(s))).state?.records,
    ).toHaveLength(2);
    expect(() =>
      validateState({ ...s, records: [s.records[0], s.records[0]] }),
    ).toThrow("Duplikasi");
  });
  it("CSV BOM, escaping kutip dan pencegahan formula Excel", () => {
    const r = record({ enteredBy: '=HYPERLINK("unsafe")' });
    expect(recordsCSV([r]).startsWith("\uFEFF")).toBe(true);
    expect(csvCell("=SUM(1)")).toBe('"\'=SUM(1)"');
    expect(recordsCSV([r])).toContain("'=HYPERLINK");
  });
});

describe("Integritas konsolidasi lanjutan", () => {
  it("menolak perubahan identitas atau target sumber pada snapshot impor", () => {
    const state = initialState();
    state.records = [record()];
    const bundle = exportBundle(state, "UNIT-03");
    bundle.records[0].snapshot.targetMasterPct = 10;
    expect(() => parseBundle(JSON.stringify(bundle))).toThrow("target sumber");
  });
  it("memungkinkan revisi laporan RS terimpor tanpa penugasan ulang, tetapi tidak laporan baru", () => {
    const state = initialState();
    const r = record({ indicatorId: "IMP-RS-01", unitId: "UNIT-01" });
    state.records = [r];
    expect(
      saveRecord(state, { ...r, status: "draft", revision: 2 }).records,
    ).toHaveLength(1);
    expect(() =>
      saveRecord(state, { ...r, id: crypto.randomUUID(), month: 2 }),
    ).toThrow("ditugaskan");
  });
  it("kebijakan sampel hanya oleh Komite Mutu/Admin", () => {
    expect(() =>
      reviewRecord(
        record({ status: "submitted" }),
        "verified",
        "Catatan",
        "Tim",
        "Kepala Unit",
        "Kebijakan sampel",
      ),
    ).toThrow("Komite Mutu");
  });
  it("menolak penugasan ke unit tidak dikenal", () => {
    const state = initialState();
    state.assignments["UNKNOWN"] = ["IMP-RS-01"];
    expect(() => validateState(state)).toThrow("Penugasan");
  });
});
