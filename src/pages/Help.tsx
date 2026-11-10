import { useState } from "react";
import { useStore } from "../app/store";
import { seedIndicators } from "../features/indicators/indicatorService";
import { Heading, Panel } from "../components/ui";
import type { MonthlyRecord } from "../types";
export default function Help() {
  const { state, role, update, reset, notify } = useStore();
  const [resetText, setResetText] = useState("");
  return (
    <>
      <Heading
        eyebrow="PANDUAN & PENGATURAN"
        title="Bekerja dengan data yang benar"
      >
        Penyimpanan lokal, definisi indikator, dan tata kelola konsolidasi.
      </Heading>
      <div className="two-columns">
        <Panel title="Alur kerja unit → pimpinan">
          <div className="help-content">
            <ol>
              <li>
                Pilih persona Petugas Unit dan unit pelapor. Admin menugaskan
                indikator RS melalui Master Indikator.
              </li>
              <li>
                Isi numerator dan denominator bulanan. Denominator adalah sampel
                eligible setelah eksklusi; jumlah eksklusi tidak dikurangi
                ulang.
              </li>
              <li>
                Simpan draft atau ajukan laporan. Draft valid disimpan otomatis
                setelah 1,4 detik. Perubahan pada laporan terverifikasi membuat
                draft revisi.
              </li>
              <li>
                Ganti persona Kepala Unit / Komite Mutu untuk tinjauan, catatan,
                dan verifikasi lokal. Buat RCA dan PDCA/PDSA bila diperlukan.
              </li>
              <li>
                Ekspor JSON aktual unit, pindahkan melalui sarana internal, lalu
                admin mengimpor dengan pratinjau dan penyelesaian konflik.
              </li>
              <li>
                Pimpinan membuka laporan bulanan, triwulan, atau tahunan.
                Persentase kumulatif dihitung dari Σ numerator / Σ denominator.
              </li>
            </ol>
          </div>
        </Panel>
        <Panel title="Batas penyimpanan & keamanan">
          <div className="help-content">
            <p>
              <b>Data di browser ini, bukan database bersama.</b> localStorage
              terpisah per browser, profil, domain, dan perangkat. Menghapus
              data situs atau mode privat dapat menghilangkan data.
            </p>
            <p>
              Persona bukan akun aman, tidak ada login server, enkripsi
              aplikasi, atau autentikasi persetujuan. Vercel hanya menayangkan
              frontend dan tidak menyimpan dataset bersama.
            </p>
            <p>
              Jangan simpan identitas pasien, NIK, rekam medis individual,
              username/password asli, PDF/foto, atau berkas sensitif. Gunakan
              angka agregat, pseudonim petugas, dan referensi bukti
              non-sensitif.
            </p>
            <p>
              Backup JSON juga tidak terenkripsi. Simpan dan kirim melalui
              saluran internal yang sesuai. Impor data terverifikasi dari
              perangkat lain tetap memerlukan tinjauan provenance.
            </p>
          </div>
        </Panel>
        <Panel title="Aturan statistik & master">
          <div className="help-content">
            <p>
              Numerator dan denominator harus bilangan bulat nonnegatif,
              numerator ≤ denominator. Penyebut nol adalah N/A dengan alasan
              wajib, bukan 0% atau 100%.
            </p>
            <p>
              Gap dan perubahan bulanan ditampilkan dalam poin persentase (pp).
              Perbandingan target memakai angka presisi sebelum pembulatan.
              Tidak ada persentase mutu gabungan dari indikator berbeda.
            </p>
            <p>
              IMP-RS-06 dan SDM konflik 95% vs 100% dan tetap unresolved sampai
              disahkan dengan alasan. Humas belum memiliki definisi
              numerator/denominator resmi. PDF sumber belum dilampirkan;
              metadata yang belum ada ditulis “Belum dikonfigurasi”.
            </p>
            <p>
              IMP-RS-05 memerlukan minimal 200 peluang per unit per bulan.
              Sampel lebih kecil tidak masuk capaian final kecuali Komite Mutu
              mencatat kebijakan tindak lanjut secara eksplisit.
            </p>
            <p>
              Alias HLIU/HILU dan Laundry/Loundry mengacu unit yang sama. ID
              RSAS-U bukan kode resmi. Versi profil disimpan bersama laporan;
              perubahan master tidak menulis ulang sejarah.
            </p>
          </div>
        </Panel>
        <Panel title="Preferensi analisis">
          <div className="form-content">
            <label>
              Ambang penurunan MoM (pp)
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                disabled={role !== "Admin/Pimpinan"}
                defaultValue={state.settings.dropThreshold}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 0 && n <= 100)
                    update(
                      (s) => ({
                        ...s,
                        settings: { ...s.settings, dropThreshold: n },
                      }),
                      "Ubah ambang MoM",
                    );
                  else notify("Ambang harus 0–100 pp.");
                }}
              />
            </label>
            <p className="helper">
              Dua periode berurutan di bawah target dan penurunan melebihi
              ambang memicu notifikasi. Hanya data aktual final dengan versi
              profil sama yang dibandingkan.
            </p>
            <p>
              Untuk penggunaan multi-user aman di masa depan, diperlukan
              backend, autentikasi, kontrol akses, audit terpusat, dan
              persetujuan digital. Fitur tersebut tidak diimplementasikan dalam
              versi localStorage ini.
            </p>
          </div>
        </Panel>
      </div>
      <Panel title="Dataset simulasi · terpisah dari aktual">
        <div className="form-content">
          <p>
            Latihan opsional membuat dua laporan IGD berlabel SIMULASI. Tidak
            ada simulasi pada inisialisasi pertama. Data ini tidak masuk grafik
            final aktual, laporan pimpinan, atau ekspor unit.
          </p>
          <div className="toolbar-actions">
            <button
              className="button"
              onClick={() => {
                if (!confirm("Tambahkan data SIMULASI terpisah untuk latihan?"))
                  return;
                const now = new Date().toISOString();
                const snapshot =
                  state.indicators.find((i) => i.id === "RSAS-U-01") ??
                  seedIndicators[10];
                const records: MonthlyRecord[] = [1, 2].map((month, index) => ({
                  id: crypto.randomUUID(),
                  indicatorId: "RSAS-U-01",
                  unitId: "UNIT-01",
                  year: 2026,
                  month,
                  numerator: index ? 40 : 45,
                  denominator: 50,
                  excludedCount: 0,
                  populationSize: null,
                  sampleMethod: "SIMULASI",
                  noEligibleReason: "",
                  sourceNote: "SIMULASI — bukan data pelayanan nyata",
                  evidenceReference: "",
                  enteredBy: "SIMULASI",
                  measuredAt: `2026-0${month}-28`,
                  status: "draft",
                  reviewNote: "",
                  reviewer: "",
                  createdAt: now,
                  updatedAt: now,
                  revision: 1,
                  originDeviceId: state.deviceId,
                  dataType: "simulation",
                  snapshot,
                  overlapRisk: false,
                  comparabilityNote: "",
                  samplePolicyNote: "",
                  categories: [],
                }));
                if (
                  update(
                    (s) => ({
                      ...s,
                      records: [
                        ...s.records,
                        ...records.filter(
                          (r) =>
                            !s.records.some(
                              (x) =>
                                x.dataType === "simulation" &&
                                x.indicatorId === r.indicatorId &&
                                x.unitId === r.unitId &&
                                x.year === r.year &&
                                x.month === r.month,
                            ),
                        ),
                      ],
                    }),
                    "Tambahkan SIMULASI",
                  )
                )
                  notify(
                    "SIMULASI ditambahkan. Pilih jenis data SIMULASI di filter.",
                  );
              }}
            >
              Isi data contoh (SIMULASI)
            </button>
            <button
              className="button"
              onClick={() => {
                if (
                  confirm("Hapus semua laporan SIMULASI dan tindak lanjutnya?")
                )
                  update(
                    (s) => ({
                      ...s,
                      records: s.records.filter((r) => r.dataType === "actual"),
                      plans: s.plans.filter((p) =>
                        s.records.some(
                          (r) => r.id === p.recordId && r.dataType === "actual",
                        ),
                      ),
                    }),
                    "Hapus SIMULASI",
                  );
              }}
            >
              Hapus simulasi
            </button>
          </div>
        </div>
      </Panel>
      <Panel title="Reset seluruh data browser">
        <div className="form-content">
          <p>
            Unduh backup terlebih dahulu. Reset menghapus laporan, pengesahan
            master, penugasan, tindak lanjut, dan audit dari browser ini; master
            sumber akan dipulihkan.
          </p>
          <label>
            Ketik RESET untuk konfirmasi pertama
            <input
              aria-label="Konfirmasi reset"
              value={resetText}
              onChange={(e) => setResetText(e.target.value)}
            />
          </label>
          <button
            className="button danger"
            disabled={role !== "Admin/Pimpinan" || resetText !== "RESET"}
            onClick={() => {
              if (
                confirm(
                  "Konfirmasi kedua: hapus seluruh dataset lokal? Tindakan ini tidak dapat dibatalkan tanpa backup.",
                )
              ) {
                if (reset()) {
                  setResetText("");
                  notify(
                    "Dataset direset ke master sumber tanpa data capaian.",
                  );
                }
              }
            }}
          >
            Reset seluruh data
          </button>
        </div>
      </Panel>
    </>
  );
}
