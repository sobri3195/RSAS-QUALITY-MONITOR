# PROMPT CODEX — RSAS QUALITY MONITOR

Anda adalah **senior full-stack frontend engineer, clinical quality data analyst, UX architect, dan QA engineer**. Bangun aplikasi web **nyata dan siap dijalankan**, bukan sekadar mockup, bernama:

**RSAS QUALITY MONITOR**
**Sistem Monitoring, Evaluasi, dan Analisis Indikator Mutu RSAU Prof. dr. Abdulrachman Saleh**
Tagline: **"Sagraha Abhipraya Nawasena — Kesehatan untuk Kedaulatan"**.

## 0. Misi, data sumber, dan batasan utama

Tujuan: setiap unit RSAS mengisi data indikator mutu bulanan (numerator/pembilang dan denominator/penyebut), aplikasi memvalidasi, menghitung capaian, membandingkan target, menganalisis tren dalam **tabel dan grafik**, mendukung penilaian Komite Mutu, dan mencetak/mengunduh laporan pimpinan.

**Teknologi wajib:** Vite + React + TypeScript + Tailwind CSS + Recharts + Lucide Icons + React Router + Zod. State management boleh Zustand/Context bila diperlukan. Deploy ke **Vercel** sebagai static SPA. **Penyimpanan utama hanya browser localStorage**; jangan buat backend/database, API server, login server, atau dependensi berbayar pada versi ini.

Sumber master: tiga PDF RSAS tahun 2026. Gunakan juga file **rsas_master_indikator_2026.json** yang menyertai prompt ini bila tersedia, sebagai sumber seed 34 indikator. Jangan mengarang kriteria atau mengubah target tanpa persetujuan. Bila PDF tersedia dalam project, ekstrak metadata lanjutan seperti definisi operasional, metode, inklusi/eksklusi, penanggung jawab dan instrumen dari PDF. Bila belum tersedia, tampilkan 'Belum dikonfigurasi' secara eksplisit, jangan isi palsu.

**Batasan yang harus dijelaskan dalam halaman Bantuan:** localStorage TERPISAH per browser/per perangkat, tidak otomatis tersinkron antara unit. Untuk konsolidasi gunakan **Ekspor Data Unit JSON** dan **Impor Konsolidasi JSON** pada perangkat admin. Persona/role client-side hanya penyederhanaan alur kerja, **bukan keamanan autentikasi sebenarnya**. Vercel menayangkan frontend, tidak menyimpan data bersama. Jangan memproses atau menyimpan identitas pasien, NIK, rekam medis individual, username/password asli, atau berkas sensitif pada localStorage. Gunakan data agregat tanpa identitas.

## 1. Master indikator wajib lengkap (34)

### A. Indikator Mutu Prioritas Rumah Sakit (10)

| Kode resmi | Indikator | Target master |
|---|---|---:|
| IMP-RS-01 | Kepatuhan identifikasi pasien infeksi | 100% |
| IMP-RS-02 | Kelengkapan serah terima pasien infeksi | ≥95% |
| IMP-RS-03 | Kepatuhan pelabelan dan penyimpanan obat LASA/high-alert pada pelayanan infeksi | 100% |
| IMP-RS-04 | Kepatuhan Surgical Safety Checklist pada pasien infeksi | 100% |
| IMP-RS-05 | Kepatuhan kebersihan tangan 5 Momen pada pelayanan infeksi | ≥85% |
| IMP-RS-06 | Kepatuhan upaya pencegahan risiko jatuh pada pelayanan infeksi | ≥95% (KONFLIK: profil menulis 100%) |
| IMP-RS-07 | Asuhan kasus klinis prioritas sesuai PPK/CP | ≥90% |
| IMP-RS-08 | Kesiapan deteksi dan respons infeksi | ≥95% |
| IMP-RS-09 | Rekam medis terintegrasi | ≥95% |
| IMP-RS-10 | Kepatuhan skrining risiko infeksi/kewaspadaan transmisi | ≥95% |

### B. Indikator Mutu Prioritas Unit (24)

| ID internal (BUKAN kode resmi) | Unit | Indikator | Target master |
|---|---|---|---:|
| RSAS-U-01 | IGD | Kepatuhan waktu tanggap pelayanan IGD | ≥90% |
| RSAS-U-02 | Rawat Jalan | Waktu tunggu rawat jalan | ≥80% |
| RSAS-U-03 | Rawat Inap | Kepatuhan asesmen awal pasien rawat inap | ≥95% |
| RSAS-U-04 | ICU | Kepatuhan monitoring pasien kritis | ≥95% |
| RSAS-U-05 | HLIU | Kepatuhan kewaspadaan isolasi | 100% |
| RSAS-U-06 | Kamar Operasi | Kepatuhan penandaan lokasi operasi | 100% |
| RSAS-U-07 | Rehabilitasi Medik | Kepatuhan pelaksanaan program rehabilitasi pasien | ≥80% |
| RSAS-U-08 | Farmasi | Kepatuhan penggunaan formularium nasional | ≥80% |
| RSAS-U-09 | Laboratorium | Pelaporan hasil kritis laboratorium | 100% |
| RSAS-U-10 | Radiologi | Pelaporan hasil kritis radiologi | 100% |
| RSAS-U-11 | CSSD | Kepatuhan proses sterilisasi | 100% |
| RSAS-U-12 | Gizi | Ketepatan pemberian diet pasien | ≥80% |
| RSAS-U-13 | Laundry | Kepatuhan pemisahan linen infeksius dan noninfeksius | 100% |
| RSAS-U-14 | Rekam Medis | Kelengkapan rekam medis elektronik | ≥80% |
| RSAS-U-15 | Pendaftaran | Kepatuhan kelengkapan data administratif pasien | ≥95% |
| RSAS-U-16 | SIMRS | Penyelesaian gangguan SIMRS | ≥90% |
| RSAS-U-17 | Pemeliharaan Alat Medis | Kepatuhan kalibrasi alat medis | ≥90% |
| RSAS-U-18 | Ambulans | Kepatuhan kelengkapan alat dan obat emergensi ambulans | 100% |
| RSAS-U-19 | Pemulasaraan Jenazah | Kepatuhan serah terima jenazah | ≥90% |
| RSAS-U-20 | Sanitasi/Limbah | Kepatuhan pengelolaan limbah infeksius | 100% |
| RSAS-U-21 | Humas | Kecepatan respon terhadap komplain pasien | ≥85% (profil rinci TIDAK ditemukan) |
| RSAS-U-22 | SDM | Kepatuhan orientasi staf baru | 95% (KONFLIK: profil menulis 100%) |
| RSAS-U-23 | Keuangan | Ketepatan penyelesaian administrasi pasien | ≥95% |
| RSAS-U-24 | Housekeeping | Kepatuhan kebersihan area pelayanan | ≥95% |

CATATAN REKONSILIASI: PDF daftar menulis **HLIU** dan profil menulis **HILU**; sediakan alias tanpa menduplikasi unit. PDF daftar juga menulis 'Loundry', profil menulis 'Laundry'; UI gunakan Laundry tetapi simpan alias sumber. Daftar memberi Pendaftaran nomor 15 dan SIMRS 16, sementara profil mendahulukan SIMRS dan menempatkan Pendaftaran nomor 21; jangan jadikan nomor urut profil sebagai identitas database. Untuk IMP-RS-06 dan SDM, effectiveTarget harus `null`/`unresolved` sampai admin menetapkan target tersahkan disertai catatan alasan. Humas belum punya numerator, denominator, inklusi/eksklusi dalam dokumen profil; tampilkan status 'profil belum lengkap', sediakan editor metadata untuk admin, dan JANGAN mengarang rumus resmi atau meluluskan capaian.

Jika file JSON master ada, gunakan atribut numerator_definition dan denominator_definition dari JSON, jangan ganti dengan definisi generik. Semua 34 master harus tampil meski belum ada data capaian.

## 2. Rancangan UI/UX

- Tampilan profesional rumah sakit, desktop-first tetapi responsive mobile/tablet. Warna: navy, biru medis, putih, teal; merah/amber hanya untuk status yang bermakna. Logo resmi RSAS hanya bila aset benar-benar tersedia; bila tidak, gunakan monogram RSAS, jangan menggambar logo institusi palsu.
- Header **RSAU PROF. DR. ABDULRACHMAN SALEH — RSAS QUALITY MONITOR** dan pilihan tahun, bulan, unit, kelompok indikator, status. Sidebar desktop dan bottom navigation mobile.
- Menu: **Dashboard Eksekutif; Input Data Unit; Indikator Rumah Sakit; Indikator Unit; Analitik & Grafik; Verifikasi Komite Mutu; Rencana Tindak Lanjut; Laporan; Master Indikator; Impor/Ekspor; Pengaturan/Bantuan**.
- Pencarian cepat, tabel sorting, filter, pagination, empty states, skeleton/loading bila relevan, toast yang bermakna, konfirmasi penghapusan, aksesibilitas keyboard, fokus terlihat, format angka Indonesia.
- Tidak gunakan data simulasi sebagai data aktual. Bila data belum ada, tampilkan **'Belum ada data'**; tombol **'Isi data contoh (simulasi)'** harus terpisah, jelas berlabel SIMULASI, bisa dihapus/direset.

## 3. Alur kerja unit hingga pimpinan

1. Pilih persona/role kerja **Petugas Unit**, **Kepala Unit**, **Komite Mutu**, **Admin/Pimpinan** di browser; jelaskan ini BUKAN sistem akun aman karena tidak ada backend.
2. Petugas memilih unit. Form hanya menampilkan indikator unit terkait dan indikator rumah sakit yang ditugaskan untuk diobservasi oleh unit tersebut (assignment dapat diatur admin).
3. Pilih bulan dan tahun; form otomatis tampilkan judul, target resmi jika sudah terverifikasi, numerator/denominator dalam bahasa Indonesia, sumber data, definisi, inklusi/eksklusi, dan instrumen bila tersedia.
4. Isikan numerator, denominator, jumlah eksklusi (opsional sebagai informasi saja), jenis sampel, tanggal pengukuran, nama/pseudonim petugas internal (tanpa PII pasien), catatan, referensi bukti (nama dokumen atau nomor berita acara TANPA mengunggah data identitas pasien).
5. Hitung nilai otomatis tanpa mengetik persentase manual. Simpan Draft lalu Submit di penyimpanan lokal browser. Kepala Unit/Komite Mutu pada perangkat yang sama dapat memberi verifikasi atau 'Perlu perbaikan'; pada perangkat berbeda proses hanya dapat dilanjutkan dengan impor JSON dan menunjukkan provenance.
6. Komite Mutu meninjau data, menulis temuan, analisis penyebab, rencana tindak lanjut (PIC, tenggat, tindakan), dan status penutupan. Aksi verifikasi lokal harus dilabeli **'verifikasi lokal'**, tidak diklaim sebagai persetujuan digital yang aman.
7. Pimpinan melihat dashboard agregat dan laporan yang dibuat dari DATA TERVERIFIKASI; data belum terverifikasi muncul dalam tabel terpisah, tidak masuk perhitungan final kecuali filter eksplisit.

## 4. Rumus dan validasi klinis/statistik (sangat penting)

- `capaianPersen = denominator > 0 ? (numerator / denominator) * 100 : null`
- Validasi: numerator & denominator bilangan bulat nonnegatif, numerator <= denominator, denominator 0 berarti `Tidak ada objek ukur / N/A` (WAJIB alasan); jangan tampilkan 0% atau 100% sebagai capaian palsu bila penyebut nol.
- Denominator adalah populasi/sampel **yang memenuhi syarat setelah eksklusi** menurut definisi indikator. Jangan otomatis mengurangkan `excludedCount` lagi jika denominator sudah net eligible; jelaskan tooltip.
- Target dicapai hanya jika master indikator valid dan target sudah disahkan, denominator > 0, record terverifikasi, serta `capaianPersen >= effectiveTarget` (termasuk target 100%; perhitungan presisi memakai numerator/denominator sebelum pembulatan display).
- `gapPercentagePoints = capaianPersen - effectiveTarget` dalam **poin persentase (pp)**, bukan persentase relatif.
- Perubahan MoM = capaian bulan berjalan minus capaian bulan sebelumnya dalam pp; hanya perbandingkan periode dengan data valid dan indikator yang sama.
- Kumulatif triwulan/tahunan harus berupa `100 * sum(numerator) / sum(denominator)` untuk indikator dan definisi yang sama; **JANGAN rata-ratakan persentase bulanan**.
- Untuk indikator RS yang diobservasi beberapa unit, agregasi angka dengan SUM numerator dan SUM denominator hanya bila metode, objek ukur, periode, eksklusi, dan satuan konsisten; hindari double count. Sediakan flag 'sumber berpotensi tumpang tindih — perlu audit'.
- Jangan menggabungkan numerator dari indikator yang berbeda untuk membuat 'persentase mutu RSAS'. Ringkasan lintas indikator hanya berupa **jumlah/proporsi indikator yang memenuhi target, coverage pelaporan, dan status**; beri label jelas denominator ringkasan.
- Status eksklusif: `belum_dilaporkan`, `draft`, `diajukan`, `perlu_revisi`, `terverifikasi_tercapai`, `terverifikasi_belum_tercapai`, `n_a`, `target_belum_disahkan`, `profil_belum_lengkap`, `sampel_tidak_memadai`.
- **IMP-RS-05** profil meminta minimal **200 peluang kebersihan tangan** per unit per bulan sesuai observasi; bila <200 peluang, beri warning **sampel belum memenuhi ketentuan** dan jangan tandai hasil final tanpa tindak lanjut kebijakan Komite Mutu. Dukung run chart bulanan.
- Indikator lain: aturan total sampling, sampling, kriteria inklusi dan eksklusi disimpan per indikator jika tersedia di profil; jangan mengasumsikan semua sama.
- Tampilkan persentase dengan 1 atau 2 angka desimal, tetapi gunakan angka presisi untuk status target.

## 5. Data model dan localStorage

Gunakan type/interface TypeScript dan Zod. Minimal entitas:

```ts
Indicator {
 id: string; officialCode?: string | null; internalCode?: string;
 kind: 'rumah_sakit'|'unit'; unitId?: string | null; title: string;
 targetMasterPct: number; targetProfilePct?: number | null;
 effectiveTargetPct: number | null; targetVerification: 'sesuai'|'perlu_verifikasi'|'disahkan';
 numeratorDefinition?: string | null; denominatorDefinition?: string | null;
 definition?: string; inclusion?: string; exclusion?: string;
 sampleRule?: string; collectionMethod?: string; dataSource?: string;
 instrument?: string; pic?: string; sourceReference?: string;
 profileStatus: 'tersedia'|'belum_tersedia'; aliases?: string[];
}
MonthlyRecord {
 id: string; indicatorId: string; unitId: string;
 year: number; month: number; numerator: number; denominator: number;
 excludedCount?: number; populationSize?: number; sampleMethod?: string;
 noEligibleReason?: string; sourceNote?: string; evidenceReference?: string;
 enteredBy?: string; measuredAt?: string;
 status: 'draft'|'submitted'|'returned'|'verified';
 reviewNote?: string; reviewer?: string; createdAt: string; updatedAt: string;
 revision: number; originDeviceId: string; dataType:'actual'|'simulation';
}
ActionPlan { id: string; recordId: string; problem: string; rootCause: string;
 action: string; owner: string; dueDate: string; status: string; evaluation?: string; }
AuditEvent { id: string; recordId: string; action: string;
 before?: unknown; after?: unknown; at: string; actorLabel?: string; }
```

Gunakan `rsas-quality-monitor:v1:<entity>` sebagai namespace keys. Implementasi `useLocalStorage` dengan parsing Zod, migrations, try/catch saat storage quota penuh, versi schema, pemulihan saat JSON rusak, debounced writes bila perlu. Simpan data numerik & metadata saja; jangan masukkan PDF/foto besar sebagai base64. Gunakan UUID untuk record. Beri constraint unik `(indicatorId,unitId,year,month)` untuk record utama; edit menyimpan revision, tidak membuat duplikat tersembunyi. Pastikan refresh browser tidak menghilangkan data.

## 6. Ekspor-impor dan konsolidasi antarunit (HARUS berfungsi)

- Unit dapat mengunduh **JSON satu unit** berisi versi skema, rumah sakit, nama unit, periode, indikator, record, audit/provenance minimal, timestamp ekspor, `originDeviceId`. Juga CSV tabel bulanan.
- Admin dapat **Impor Banyak JSON Unit** (multi-file) sekaligus: preview sebelum merge, validasi schema Zod, validasi indicatorId & unitId, cek perbedaan versi skema, dedupe berdasar id dan key periode, tampilkan konflik serta pilihan `simpan lokal`, `gunakan impor`, `batalkan`, dengan log merge.
- Tidak boleh silently overwrite record verified dengan draft lebih lama atau data dari indikator lain. Jika sama id tetapi berubah isi, tampilkan conflict resolver.
- Izinkan ekspor full backup JSON dan restore dengan preview dan confirmation, serta tombol **Reset data** yang membutuhkan konfirmasi ganda.
- Export ke CSV UTF-8 BOM agar bisa dibuka Excel Indonesia. Laporan cetak melalui CSS print dan `window.print()` yang dapat disimpan pengguna sebagai PDF; untuk Excel XLSX boleh gunakan SheetJS library lokal jika diperlukan.
- Label nyata: **"Data di browser ini, bukan database bersama"**.

## 7. Halaman dan grafik wajib nyata (bukan gambar statis)

### Dashboard Eksekutif
- Kartu: total 34 indikator master, 24 unit, jumlah laporan masuk/terverifikasi, jumlah indikator mencapai/belum mencapai target, belum dilaporkan, unresolved master, progres tindak lanjut.
- Filter tahun, bulan, triwulan, jenis indikator, unit, status.
- **Line chart** tren 12 bulan (capaian vs garis target) per indikator.
- **Grouped bar chart** capaian vs target per indikator dengan label %.
- **Horizontal bar chart** urutan gap ke target dan prioritas perbaikan.
- **Heatmap** unit x bulan, status capaian/pelaporan, tooltip numerator/denominator.
- **Stacked bar** status pelaporan per unit dan per periode.
- Run chart khusus bila relevan; **Pareto keluhan/jenis gangguan** hanya bila pengguna memasukkan kategori dan frekuensi nyata (jangan buat kategori palsu).

### Tabel Monitoring
Kolom: No, Periode, Jenis, Unit, Kode, Indikator, Numerator, Denominator, Capaian (%), Target (%), Gap (pp), Status Target, Status Verifikasi, PIC, Tanggal update, Tindakan. Sticky header, sort, search, filter, pagination dan ekspor CSV/print. Baris clickable membuka **detail indikator**: seluruh profil dan histori 12 bulan serta data sumber.

### Input Data Unit
Form dua bagian: metadata profil read-only + data pengukuran. Kalkulator live, validasi inline, autosave draft lokal, edit/hapus, duplikasi periode dicegah. Form penugasan indikator RS ke unit tanpa menduplikasi master RS.

### Analisis & Tindak Lanjut
- Analisis deskriptif otomatis **berbasis aturan transparan**, misalnya: 'capaian 82% di bawah target 90% (-8 pp)' atau 'turun 4 pp dari bulan sebelumnya'. Hindari klaim penyebab klinis tanpa data.
- Notifikasi: 2 periode terverifikasi berturut-turut gagal target; turun >5 pp MoM (ambang dapat diatur); data kosong; sampel tidak memadai; target belum disahkan.
- RCA sederhana (5 Why/Fishbone berupa form teks), rencana **PDCA/PDSA**, PIC, target penyelesaian, bukti tindak lanjut berupa referensi non-sensitif.
- Tabel prioritas masalah dan status OPEN/IN PROGRESS/CLOSED.

### Laporan
Laporan bulanan, triwulan, tahunan: judul resmi RSAS, periode, metode & definisi, tabel capaian, grafik, interpretasi singkat berbasis data, indikator yang belum memenuhi target, tindak lanjut, catatan kualitas data, disclaimer data simulasi jika ada, tanggal cetak. Semua persentase dari data aktual terverifikasi yang tersedia. Print-to-PDF.

### Master Indikator
Admin dapat melihat dan memperbarui definisi, target, alias unit, PIC, formula, eksklusi, sumber, ketentuan sampling, status validasi. Perubahan target harus menyimpan `oldValue, newValue, tanggal, alasan, actorLabel`, dan tidak mengubah historis tanpa catatan versi efektif. Indikator dengan target konflik tetap `unresolved` sampai resolusi manual; profil Humas harus dilengkapi dahulu.

## 8. Teknis frontend, routing, kualitas

- Project dapat dibangun dengan `npm install`, `npm run dev`, `npm run build`, `npm run preview`, `npm test`, `npm run lint`.
- Struktur folder: `src/app`, `src/pages`, `src/components`, `src/features/indicators`, `src/features/entries`, `src/features/analytics`, `src/features/reports`, `src/data`, `src/lib`, `src/types`, `src/tests`.
- Gunakan modular services: `indicatorService`, `recordService`, `analyticsService`, `importExportService`, `storageService`.
- Semua rumus berupa fungsi murni dan diuji dengan Vitest; tidak boleh dibenamkan di komponen React.
- Gunakan Recharts dengan tooltip, legend, chart kosong yang informatif, responsive containers. Grafik tidak boleh menghitung sendiri dari data yang berbeda dari tabel.
- Vercel SPA: siapkan `vercel.json` rewrite agar refresh nested route tetap membuka aplikasi, tanpa menyamarkan 404 untuk asset statis; sesuaikan dengan build output `dist`.
- Jika ada aset logo resmi yang diunggah, letakkan di public; selain itu tampilkan teks monogram RSAS.
- Seed **master 34 indikator saja**. Dataset angka simulasi harus disuntikkan secara opt-in, selalu berlabel `SIMULASI`, tidak tercampur dengan actual export/verified reports.
- Hindari library analitik remote, tracking user, analytics SaaS dan ketergantungan network API yang tidak diperlukan.

## 9. Automated tests / Acceptance criteria

1. 34 indikator master + 24 unit tampil benar setelah inisialisasi pertama.
2. Semua 10 `IMP-RS-01..10` muncul dengan target master sumber.
3. Konflik `IMP-RS-06` (95 vs 100) dan `RSAS-U-22` SDM (95 vs 100) terlihat sebagai **perlu verifikasi**, tidak otomatis lulus.
4. Humas (`RSAS-U-21`) tampil sebagai **profil belum lengkap**, tanpa rumus palsu.
5. Input numerator=45, denominator=50 menghasilkan capaian 90%; jika target=95%, gap=-5 pp dan status belum tercapai SETELAH diverifikasi.
6. Numerator > denominator, angka negatif, desimal, input tidak valid ditolak.
7. Denominator=0 menghasilkan N/A bukan 0% atau Infinity.
8. Jan=9/10 dan Feb=1/10 menghasilkan agregat 10/20=50%, bukan perhitungan yang salah; uji juga Jan=9/10 dan Feb=1/100 menjadi 10/110≈9,09%, **bukan** rata-rata dua persentase (45,5%).
9. Menyimpan record, refresh, lalu kembali: data masih ada.
10. JSON export dari perangkat/unit A bisa diimpor pada dataset B; perubahan terlihat di grafik/tabel, duplicate tidak dobel, konflik muncul.
11. Indikator `IMP-RS-05` dengan peluang <200 muncul warning sampel.
12. Dashboard dari storage kosong tidak mengklaim angka capaian fiktif.
13. Laporan printable memuat angka yang sama dengan tabel dan grafik serta provenance yang jelas.
14. Build produksi sukses, routing refresh normal pada Vercel.

## 10. Cara bekerja Codex

1. Periksa isi repository. Jika kosong, inisialisasi Vite React TypeScript.
2. Implementasi **end-to-end** seluruh fitur inti di atas; jangan berhenti di rencana, wireframe, atau komponen visual tanpa fungsi.
3. Baca dan gunakan `rsas_master_indikator_2026.json` dari folder proyek jika tersedia. Jangan buat master baru yang bertentangan.
4. Fokus MVP yang berfungsi: master, input, validasi, analytics, chart, export/import, laporan print, revisi/verifikasi lokal. Lanjutkan fitur lanjutan setelah MVP teruji.
5. Buat README bahasa Indonesia: instalasi, cara input unit, penjelasan numerator/denominator, konsolidasi manual JSON, batas localStorage, backup data, Vercel deployment, keterbatasan keamanan, dan roadmap backend multi-user (sebagai opsi selanjutnya, jangan diimplementasikan sekarang).
6. Jalankan build/lint/test, perbaiki error sebelum menyatakan selesai. Sertakan daftar file utama, perintah menjalankan, dan hasil pengujian. Jangan berkata berhasil jika belum menjalankan pemeriksaan.

**Output final:** source code aplikasi siap menjalankan `npm run dev`, siap deploy Vercel, seluruh 34 master indikator terisi, input data unit benar-benar berfungsi, tabel & grafik dinamis dari data lokal, laporan cetak, dan mekanisme konsolidasi impor/ekspor JSON. Semua teks UI menggunakan Bahasa Indonesia.
