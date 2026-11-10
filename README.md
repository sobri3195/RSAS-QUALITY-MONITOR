# RSAS QUALITY MONITOR

Sistem Monitoring, Evaluasi, dan Analisis Indikator Mutu **RSAU Prof. dr. Abdulrachman Saleh**.

*Sagraha Abhipraya Nawasena — Kesehatan untuk Kedaulatan.*

SPA Vite, React, TypeScript, Tailwind CSS, Recharts, Lucide, React Router, dan Zod. Tidak membutuhkan backend, database, akun, API aplikasi, atau layanan berbayar. Seluruh UI berbahasa Indonesia. Monogram RSAS digunakan karena logo resmi tidak dilampirkan.

## Menjalankan

Gunakan Node.js 22.12+ (pin major di `.nvmrc`) dan npm:

```sh
npm ci
npm run dev
```

Di cloud ini, bila cache npm bawaan tidak dapat ditulis, gunakan `npm ci --cache /workspace/.npm-cache`. Gunakan checkout yang tersedia di `/workspace/RSAS-QUALITY-MONITOR`; setiap task cloud telah terisolasi dan tidak memerlukan worktree baru.

```sh
npm run lint       # ESLint + aturan React Hooks
npm test           # Vitest: rumus, master, storage, impor, laporan
npm run build      # TypeScript + build produksi dist/
npm run preview    # pemeriksaan lokal hasil build
npm run test:e2e   # pengujian Chromium dengan Playwright
```

Pengujian browser memakai `/usr/bin/chromium` bila tersedia, atau Chromium Playwright (`npx playwright install chromium`). Override opsional: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. CI GitHub Actions memasang Chromium serta menjalankan lint, unit test, build, dan tes browser. Tes memakai konteks browser terisolasi; angka uji tidak ditanamkan ke dataset aplikasi.

## Alur pemakaian

1. **Master** otomatis memuat tepat 34 indikator (10 prioritas RS, 24 unit), tanpa data capaian. JSON sumber dipertahankan di `src/data/rsas_master_indikator_2026.json`.
2. Pilih persona **Admin/Pimpinan** untuk penugasan indikator RS ke unit dan penyuntingan profil. Tidak ada penugasan RS otomatis. HLIU/HILU dan Laundry/Loundry adalah alias satu unit. `RSAS-U-XX` adalah ID internal, bukan kode resmi.
3. Sebagai **Petugas Unit**, buka Input Data Unit, pilih unit, indikator, tahun, dan bulan. Masukkan numerator, denominator, metode sampel, tanggal pengukuran, pseudonim petugas, dan referensi bukti non-sensitif. Draft valid disimpan otomatis setelah 1,4 detik; tombol Simpan draft menyimpan segera. Tunggu indikator “Tersimpan” sebelum berpindah.
4. Numerator adalah jumlah yang memenuhi indikator. Denominator adalah total objek/sampel eligible **setelah eksklusi**, sesuai definisi spesifik master. Jumlah eksklusi bersifat informasi dan **tidak dikurangi ulang**. Angka harus bilangan bulat nonnegatif; numerator tidak boleh melebihi denominator. Penyebut nol memerlukan alasan dan menghasilkan N/A.
5. **Ajukan laporan**, lalu pilih persona Kepala Unit / Komite Mutu untuk peninjauan. Verifikasi lokal memerlukan catatan dan label peninjau. Perlu perbaikan mengembalikan laporan ke unit. Penyuntingan laporan terverifikasi menyimpan revisi draft dengan verifikasi ulang; tidak membuat duplikat periode.
6. Buka Analitik untuk grafik garis, perbandingan target, gap, status pelaporan bertumpuk, heatmap, dan kategori kejadian. Pareto hanya menggunakan kategori/frekuensi yang diinput, bukan kategori buatan. RCA/5 Why/Fishbone dan PDCA/PDSA disimpan sebagai teks di Rencana Tindak Lanjut.
7. Laporan pimpinan dapat difilter **bulanan, triwulanan, tahunan**, lalu dicetak/disimpan PDF melalui browser atau diekspor CSV. Laporan selalu memakai data **aktual terverifikasi yang layak**, termasuk provenance dan versi definisi. Data yang belum layak ditampilkan terpisah.

## Target, sampel, dan perhitungan

- Capaian = `100 × numerator / denominator`, tidak diketik manual. Status memakai angka presisi; tampilan memakai format Indonesia.
- Gap dan perubahan MoM dalam **poin persentase (pp)**. Target 95% dan capaian 90% menghasilkan gap −5 pp.
- Agregat satu indikator = `100 × Σ numerator / Σ denominator`, bukan rerata persentase. Contoh uji: 9/10 dan 1/100 → 10/110 = 9,09%.
- Tidak ada “persentase mutu rumah sakit” dari campuran numerator indikator berbeda. Dashboard menampilkan jumlah/proporsi indikator yang dapat dinilai, coverage slot pelaporan, dan status.
- Agregasi menolak versi, definisi, inklusi/eksklusi, metode, ketentuan sampel, atau target yang berbeda. Sumber lintas unit memerlukan catatan kesetaraan dan pencegahan hitung ganda. Flag potensi tumpang tindih mengecualikan laporan dari agregat final.
- **IMP-RS-06** dan **SDM / RSAS-U-22** tetap memiliki target efektif `null` (95% master vs 100% profil). Admin harus mengesahkan nilai dengan alasan, label pengesah, dan audit. Master sumber tidak diubah.
- **Humas / RSAS-U-21** belum memiliki profil rinci: definisi numerator/denominator tidak dibuat. Harus dilengkapi dan disahkan sebelum capaian dapat dinilai.
- **IMP-RS-05** minimal 200 peluang per unit per bulan. Sampel kurang tetap ditandai; hanya kebijakan tindak lanjut tertulis oleh Komite Mutu/Admin dapat mengizinkan penilaian. Verifikasi semata tidak menghapus warning.
- Snapshot profil disimpan pada laporan. Perubahan master berlaku pada laporan baru atau yang diedit ulang; histori tidak diam-diam dihitung memakai target baru. Periode lintas versi yang tidak konsisten tidak digabungkan.
- PDF profil asli tidak dilampirkan. Metadata lanjutan yang tidak ada di JSON ditampilkan **Belum dikonfigurasi**, tanpa isi fiktif.

## Konsolidasi JSON, CSV, dan backup

**Data di browser ini, bukan database bersama.** Browser/perangkat unit A dan B memiliki dataset terpisah.

1. Unit mengunduh **Ekspor Data Unit JSON**, berisi data aktual seluruh periode unit, versi skema, master, laporan, tindak lanjut, audit, waktu ekspor, dan perangkat asal. Simulasi tidak disertakan.
2. Pindahkan berkas melalui sarana internal yang sesuai. Di perangkat admin, pilih persona Admin/Pimpinan → Impor/Ekspor → pilih banyak JSON sekaligus.
3. Tinjau pratinjau dan provenance. Skema Zod memvalidasi ID, unit, periode, angka, dan versi. Laporan dengan ID/kunci periode sama tidak diduplikasi. Isi berubah menjadi konflik dengan pilihan **simpan lokal / gunakan impor / batalkan**. Draft lama tidak menimpa verified secara diam-diam. ID sama yang menunjuk indikator/periode berbeda tidak boleh dipaksakan.
4. Konfirmasi pratinjau lalu gabungkan. Master/penugasan lokal tidak otomatis diganti oleh impor unit. Snapshot profil asal tetap dibawa untuk analisis dan audit. Konflik ID tindak lanjut mempertahankan versi lokal dan dicatat; tinjau audit serta berkas asal bila perlu memperbarui tindakan.
5. **Backup lengkap** mencakup seluruh dataset termasuk simulasi, pengaturan, dan master kustom. Untuk restore, pilih satu backup, centang mode pemulihan, konfirmasi pratinjau, lalu konfirmasi penggantian lagi. Identitas perangkat lokal dipertahankan. Backup sebelum restore.
6. CSV memakai UTF-8 BOM, separator `;`, pengutipan sel, format angka Indonesia, serta perlindungan injeksi formula. CSV monitoring memakai baris tersaring; CSV laporan final memakai agregat yang sama dengan tabel/grafik laporan.

Namespace utama: `rsas-quality-monitor:v1:dataset`. Penyimpanan satu envelope memastikan laporan dan audit tersimpan bersama. Versi awal ini memakai `schemaVersion: 1`; penambahan field kategori lama v1 dinormalisasi oleh default Zod, sedangkan versi lain ditolak untuk mencegah migrasi tak dikenal. JSON rusak tidak ditimpa otomatis: unduh salinan mentah lalu restore backup atau reset eksplisit. Quota/storage error tidak dianggap berhasil. Tab lama tidak boleh menimpa revisi tab lain; muat ulang terlebih dahulu.

Dataset SIMULASI tersedia **opt-in** di Bantuan. Terpisah dari aktual, berlabel jelas, dapat dihapus, dan tidak masuk laporan final atau ekspor unit. Reset seluruh data memerlukan ketikan RESET dan konfirmasi kedua.

## Deploy Vercel

1. Impor repositori ke Vercel, pilih preset **Vite**, Node.js 22.x, install `npm ci`, build `npm run build`, output `dist`.
2. `vercel.json` sudah mengatur build dan fallback SPA: filesystem dilayani dahulu, asset hilang/URL berekstensi mengembalikan 404, rute aplikasi seperti `/verification` kembali ke `index.html`.
3. Tidak ada environment variable atau rahasia aplikasi yang dibutuhkan. Tidak ada database yang harus disiapkan.
4. Setelah deployment, uji refresh `/input`, `/reports`, `/indicator/IMP-RS-01`, dan pastikan `/assets/tidak-ada.js` benar-benar 404. Deploy aktual ke Vercel memerlukan akun/proyek Vercel dan dilakukan terpisah; konfigurasi siap di repositori.

Data terikat **origin/domain**. Mengganti URL preview ke domain produksi tidak memindahkan localStorage: ekspor backup dari origin lama dan impor pada origin baru. Vercel hanya menayangkan frontend; live server/proses lokal tidak diperlukan di produksi.

## Berkas utama

- `src/types/index.ts`: model dan skema Zod.
- `src/features/indicators/indicatorService.ts`: 34 master, alias, profil, penugasan.
- `src/features/entries/recordService.ts`: keunikan periode dan tinjauan lokal.
- `src/features/analytics/analyticsService.ts`: perhitungan murni, status, tren, notifikasi, Pareto.
- `src/features/reports/reportService.ts`: agregat laporan.
- `src/lib/storageService.ts`: penyimpanan, validasi, quota, proteksi tab, audit.
- `src/lib/importExportService.ts`: JSON, preview/merge konflik, CSV, backup.
- `src/pages/`: seluruh halaman operasional; `src/app/`: routing, store, persona, filter.
- `src/tests/`, `e2e/`: pengujian logika dan browser.
- `docs/spesifikasi-sumber.md`: dokumen spesifikasi yang diberikan pengguna.

## Batas keamanan dan roadmap

Persona client-side **bukan autentikasi/otorisasi aman**. Pengguna browser dapat mengubah storage/JSON. Audit dan verifikasi lokal bukan bukti kriptografis atau tanda tangan digital. Data terimpor harus ditinjau, dan akses perangkat serta distribusi backup harus dikelola organisasi. Tidak ada sinkronisasi otomatis antarunit atau tab; perlindungan revisi tab mencegah overwrite usang saat menyimpan.

**Jangan masukkan** nama/identitas pasien, NIK, rekam medis individual, kredensial asli, atau berkas sensitif ke aplikasi/backup. Gunakan agregat dan referensi dokumen tanpa identitas. localStorage/backup tidak dienkripsi; jangan mengandalkannya sebagai satu-satunya arsip. Tidak ada analitik remote, tracking, atau unggahan data ke SaaS.

Opsi pengembangan berikutnya (belum diimplementasikan): backend multi-user, SSO, kontrol akses berbasis unit, database dan audit terpusat, persetujuan digital, pengaturan retensi, validasi klinis profil oleh Komite Mutu, serta konsolidasi dengan pencegahan hitung ganda terpusat.
