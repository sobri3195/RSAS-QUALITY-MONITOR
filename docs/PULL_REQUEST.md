# Implementasikan RSAS Quality Monitor dengan pelaporan unit dan konsolidasi lokal

Repositori sebelumnya kosong. Perubahan ini menambahkan SPA Vite/React/TypeScript dengan 34 master indikator dari JSON sumber, input numerator/denominator bulanan, draft otomatis, revisi, pengajuan dan verifikasi lokal, dashboard dan grafik Recharts, RCA/PDCA, serta laporan bulanan/triwulanan/tahunan yang dapat dicetak.

Target konflik IMP-RS-06 dan SDM tetap belum disahkan; profil Humas tidak diisi dengan definisi buatan. Penilaian final hanya memakai data aktual terverifikasi yang memenuhi syarat. Agregasi memakai jumlah numerator/denominator dan memblokir sumber yang tidak sebanding. Snapshot profil melindungi histori dari perubahan master.

Konsolidasi JSON menyertakan validasi skema, provenance, deduplikasi, preview, resolver konflik, dan audit. Tersedia backup/restore terkonfirmasi, CSV BOM, perlindungan kuota/storage rusak dan revisi lintas tab. Persona hanya penyederhanaan alur kerja; dataset tidak disinkronkan otomatis dan tidak memuat data pasien.

README bahasa Indonesia, GitHub Actions, dan konfigurasi Vercel SPA disertakan. Tidak ada backend atau deployment produksi yang dibuat.

Validasi: `npm run lint`, `npm test`, `npm run build`, dan `npm run test:e2e`. Lihat `docs/VALIDASI.md` untuk hasil akhir yang benar-benar dijalankan.
