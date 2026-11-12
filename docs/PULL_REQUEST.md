# Tambahkan workflow multiuser Validator → Tim Mutu → publikasi resmi

Aplikasi sebelumnya menyimpan laporan dan persona di browser; verifikasi lokal tidak dapat menjadi otorisasi atau sinkronisasi lintas perangkat. Perubahan ini menambahkan workspace Supabase dengan Auth, RLS unit/indikator, RPC atomik, revisi append-only, bukti privat dan notifikasi. Pengajuan harus melewati Validator dan review akhir Tim Mutu sebelum masuk laporan resmi. Amendemen tetap memakai publikasi lama sampai penggantinya diterbitkan.

Workspace baru menyediakan input/pengajuan/riwayat, dua inbox, dashboard/tren/heatmap, RCA, master berversi/target per periode, manajemen role/unit, audit, ekspor CSV/PNG/PDF dan migrasi arsip ke draft. Formula proporsi, rate, waktu dan jumlah memakai whitelist; agregasi tertimbang hanya menggabungkan definisi/target sebanding. Semua rute, data dan fitur v1 dipertahankan sebagai arsip lokal dengan penanda sumber data. Tanpa konfigurasi backend, workspace baru menggunakan DEMO sintetis terpisah; produksi yang salah konfigurasi gagal tertutup.

Dua migration SQL, seed staging opt-in, konfigurasi Vercel/Auth, `.env.example`, audit arsitektur, panduan role, serta backup/rollback disertakan. Master sumber 34 indikator disalin sebagai konfigurasi tidak aktif: definisi/target klinis dan INM resmi perlu disahkan organisasi, bukan diisi dengan asumsi.

Validasi lokal: lint; 78 tes unit/database termasuk RLS dan concurrent approval; build; 12 skenario Chromium; audit dependensi produksi tanpa kerentanan. Suite hosted multi-browser disediakan terpisah dan dilewati tanpa proyek/akun staging. Lihat `docs/VALIDASI.md` untuk hasil final.

Sebelum penggunaan operasional: terapkan migration di Supabase, siapkan Auth/role/penugasan serta master/target periode, isi variabel publik Vercel, aktifkan Realtime dan opsional Cron, lalu jalankan suite staging dan restore test hosted. Tidak ada credential, akun produksi, deployment atau klaim sinkronisasi hosted yang dibuat dalam PR ini.
