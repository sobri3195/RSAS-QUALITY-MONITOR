# Hasil validasi — 10 November 2026

Dijalankan pada lingkungan cloud Linux dengan Node.js v24.22.1, npm 11.9.0, dan Chromium sistem. Semua dataset pengujian berada dalam memori/konteks browser terisolasi; tidak ditanamkan sebagai data aktual aplikasi.

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run lint` | Lulus, tanpa warning ESLint |
| `npm test` | 44 tes Vitest lulus, 0 gagal |
| `npm run build` | TypeScript dan build produksi Vite lulus |
| `npm run test:e2e` | 5 skenario Chromium lulus, 0 gagal |
| `npm audit --omit=dev --audit-level=high` | 0 kerentanan dependensi produksi |
| Pemeriksaan browser hasil produksi `npm run preview` | 12 rute HTTP 200; heading benar; 0 error JavaScript |

Skenario browser mencakup master 34 indikator/24 unit, dashboard kosong, tampilan mobile tanpa overflow halaman, input valid dan invalid, autosave/refresh, pengajuan/verifikasi lokal, tabel/grafik laporan, CSS cetak, edit menjadi revisi draft, unduh JSON, impor ke konteks perangkat lain, deduplikasi, resolver konflik, penugasan RS, sampel <200 yang tidak masuk final, serta tindak lanjut sampai penutupan.

Tes logika mencakup target konflik, Humas tanpa profil buatan, validasi angka, N/A, presisi status 100%, gap pp, agregasi tertimbang 10/110, penolakan agregat beda versi/metode/definisi, alias unit, eksklusi tidak dikurangi dua kali, pemisahan simulasi, sampel minimal, notifikasi penurunan dan dua kegagalan, Pareto, revisi, snapshot historis, kuota/storage rusak, konflik tab, roundtrip JSON, konflik ID/kunci periode, referensi asing, backup, CSV BOM, dan pencegahan injeksi formula.

Build menampilkan peringatan nonfatal anotasi komentar `@__PURE__` dalam dependensi Zod; Rollup membuang komentar tersebut. Tidak ada kegagalan TypeScript atau bundling.

Rute produksi yang diperiksa: `/`, `/input`, `/hospital`, `/units`, `/analytics`, `/verification`, `/actions`, `/reports`, `/master`, `/transfer`, `/help`, `/indicator/IMP-RS-06`.

Konfigurasi Vercel disertakan, namun deployment langsung dan perilaku HTTP pada domain Vercel belum diuji. Setelah deploy, periksa refresh nested route dan 404 asset hilang sesuai README. CI GitHub Actions disertakan; hasil eksekusinya di GitHub belum diamati dari lingkungan ini.

Snapshot tampilan diperiksa secara lokal pada desktop 1512×1080 dan mobile 390×844, dengan storage kosong agar tidak menampilkan capaian simulasi sebagai data aktual.
