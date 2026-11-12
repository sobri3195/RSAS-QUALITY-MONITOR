# Alur multiuser RSAS

## Mode dan data lama

Tanpa konfigurasi backend, kunjungi `/pimpinan/dashboard` atau `/unit/input` untuk DEMO MODE yang jelas berlabel sintetis. DEMO memakai namespace terpisah dan IndexedDB untuk bukti latihan. Perangkat/browser lain memiliki DEMO sendiri. Tidak ada klaim sinkronisasi pada mode ini.

Dengan `VITE_DATA_MODE=production`, atau bila salah satu konfigurasi Supabase terisi, aplikasi memerlukan konfigurasi lengkap dan login. Konfigurasi gagal tidak pernah beralih diam-diam ke demo. `/` membuka dashboard baru pada produksi. `/legacy` dan semua rute lama tetap tersedia sebagai arsip lokal dengan banner bahwa verifikasi v1 bukan publikasi server.

## Menyiapkan Supabase

1. Buat proyek Supabase terpisah untuk staging; PostgreSQL 15+ diperlukan (`unique nulls not distinct`, security-invoker view; konfigurasi lokal memakai 17).
2. Terapkan **kedua** migration berurutan di `supabase/migrations`, melalui CLI `supabase db push` ke proyek yang dipilih atau SQL Editor. Cek proyek tujuan sebelum menjalankan. Migration pertama harus berjalan sebagai pemilik database, bukan akun frontend. Jangan menjalankan fixture `supabase/tests/platform-fixture.sql` di Supabase; itu hanya untuk PostgreSQL pengujian.
3. Migration kedua menambahkan 24 unit dan 34 master sumber sebagai konfigurasi **belum aktif**, tanpa target periode efektif dan tanpa angka capaian. Definisi lengkap/INM resmi harus disahkan organisasi; data sintetis INM bukan referensi klinis. Konflik IMP-RS-06/SDM dan profil Humas tidak diselesaikan dengan data karangan. Admin mengisi konfigurasi dan target untuk setiap periode yang akan dibuka.
4. Di Auth, nonaktifkan signup publik, atur site URL/redirect HTTPS deployment, password policy, email/SMTP jika memakai invite/reset, dan batas laju. `supabase/config.toml` menyiapkan konfigurasi lokal; konfigurasi hosted harus diatur juga di Dashboard. Jangan mengirim data pasien melalui email.
5. Buat/invite akun Admin awal melalui Auth Dashboard. Trigger membuat profile tidak aktif. Sebagai pemilik database, aktifkan Admin awal menggunakan UUID akun itu (UUID bukan secret):

   ```sql
   update public.profiles
   set role='admin', active=true, display_name='Admin Mutu'
   where id='<UUID AKUN AUTH>';
   ```

6. Buat/invite akun Petugas, Validator, Tim Mutu, Pimpinan melalui Auth Dashboard. Masuk sebagai Admin → Manajemen User → tetapkan role, aktivasi dan penugasan unit/indikator. Frontend tidak membuat akun memakai service role. Validator hanya melihat/memutuskan penugasan yang sesuai; Petugas hanya dapat menulis draft miliknya di unit yang ditugaskan. Admin aktif terakhir tidak dapat dinonaktifkan dari UI.
7. Konfigurasikan master: definisi, formula whitelist, inklusi/eksklusi, sumber, PIC, target/arah, periode dan unit. Tidak ada `eval`, SQL buatan pengguna atau asumsi semua indikator 100%. Proporsi/rate memakai rasio tertimbang; waktu/jumlah memakai nilai dan agregasi `none` atau `sum` yang dipilih Admin. Frekuensi yang tersedia saat ini bulanan.
8. Bucket `quality-evidence` dibuat privat, 5 MB, MIME PDF/PNG/JPEG. Upload hanya pada draft milik pengaju; tidak ada izin overwrite/delete aplikasi. Signature file diperiksa di frontend, metadata dan otorisasi diperiksa server. Download melalui signed URL 60 detik, sesuai RLS. Hanya bukti agregat non-sensitif; tidak ada unggahan identitas pasien.
9. Realtime diaktifkan untuk submissions, notifications, corrective actions oleh migration. Aktifkan layanan Realtime proyek. Aplikasi juga memuat ulang tiap 30 detik serta saat tab kembali aktif/koneksi pulih. Status sumber dan waktu pemuatan terakhir tampil, tanpa mengklaim subscription yang belum diuji selalu sehat.
10. Untuk pengingat otomatis harian, aktifkan extension `pg_cron` di proyek dan jalankan `supabase/ops/schedule-reminders.sql` sebagai operator. Job pukul 00:15 UTC (07:15 UTC+7) memeriksa periode sebelumnya. Sebelum Cron diaktifkan, Tim Mutu/Admin dapat menekan tombol pengingat di dashboard. Event key unik mencegah duplikasi akibat refresh/retry. Fungsi penjadwal tidak dapat dieksekusi akun frontend.

Contoh sintetis SQL staging tersedia di `supabase/seed.demo.sql` dengan opt-in transaksi eksplisit dan UUID akun latihan yang sudah dibuat. Tidak dijalankan oleh migration atau setup produksi. Seed berupa DRAFT; approval/publikasi tetap melalui RPC.

## Konfigurasi Vercel

Gunakan Node 22.x, `npm ci`, `npm run build`, output `dist`. Isi nilai melalui Environment Variables Vercel, kemudian redeploy:

```text
VITE_DATA_MODE=production
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable atau anon key proyek>
```

Nilai VITE masuk bundle browser. **Jangan gunakan secret/service_role key.** Preflight build menolak key tersebut tanpa mencetak nilainya. Public anon/publishable key bukan otorisasi: seluruh akses data tetap memerlukan Auth dan RLS.

Header Vercel menambahkan HTTPS/HSTS, nosniff, no-referrer, frame denial, permissions policy dan CSP. CSP mengizinkan HTTPS/WSS Supabase `*.supabase.co`; jika menggunakan domain Supabase khusus, tambahkan host tepat itu ke `connect-src` sebelum deploy. Development memakai Vite dan tidak memakai header deployment ini. Jangan menambahkan `unsafe-eval` atau mematikan TLS. Verifikasi refresh nested route dan 404 asset hilang setelah deploy. Deployment hosted belum dijalankan oleh pengujian lokal.

Sesi Auth disimpan di **sessionStorage**, terpisah per tab; refresh tab mempertahankan sesi. Tidak ada token Auth di namespace data localStorage. Sign out menutup sesi tab tersebut. Draft offline hanya untuk angka/catatan agregat non-sensitif, dipulihkan secara eksplisit; server tetap memeriksa versi sebelum menyimpan. Draft resmi yang sudah disimpan tetap di Supabase, bukan cache browser.

## Panduan pengguna

| Role | Alur |
| --- | --- |
| Petugas Unit | Input Data → pilih unit/indikator/periode → isi angka atau jenis N/A beserta alasan → simpan draft → unggah bukti agregat bila perlu → ajukan. Pengajuan Saya menampilkan progress/riwayat. Revisi/klarifikasi diperbaiki dan diajukan ulang. |
| Validator | Validasi → filter unit, indikator, pengirim dan periode → Lihat Riwayat Validasi → Mulai validasi → isi alasan → setujui atau kembalikan. Approval tidak menerbitkan data. |
| Tim Mutu | Inbox Mutu menerima pengajuan yang lolos Validator → review angka, target, bukti dan riwayat → terbitkan atau minta klarifikasi. Kelola RCA, rekomendasi, PIC, tenggat, bukti dan evaluasi efektivitas. |
| Pimpinan | Dashboard/laporan read-only dari revisi terbit → pilih rentang 3/6/12/24 bulan atau kustom → tren, perbandingan, heatmap, detail → PDF/PNG/CSV sesuai hak akses. |
| Admin | Konfigurasi unit, akun/role/penugasan, master dan versi/target periode. Tidak ada bypass persetujuan klinis. |

Numerator tidak boleh melebihi denominator **untuk proporsi**. Rate dapat berbeda sesuai multiplier. Waktu/jumlah tidak dipaksa memiliki denominator. Jenis `missing` hanya boleh draft. Tidak ada kasus/N/A memiliki angka `null`, kode alasan dan penjelasan; nilai ukur nol tetap nol.

Amendemen memerlukan alasan, membuat revisi baru dan kembali melewati Validator serta Tim Mutu. Publikasi lama tetap dipakai sampai pengganti diterbitkan. Semua keputusan dan snapshot dapat dibaca lewat Lihat Riwayat Validasi.

Statistik deskriptif tidak membuktikan sebab atau signifikansi. Run chart menampilkan median, tanpa menebak signifikansi. p-chart hanya dihitung setelah konfirmasi asumsi independensi/baseline stabil dan ≥20 bulan proporsi berurutan, satu unit, satu versi, tanpa gap. Batas kendali bergantung pada denominator. Draft narasi tetap membutuhkan review klinis manusia.

## Migrasi, backup dan rollback

- **Sebelum migrasi:** unduh backup lengkap/mentah v1 lewat Impor/Ekspor atau Pengaturan. Key v1 tidak diubah oleh workflow baru, termasuk jika JSON rusak.
- Pengaturan → pratinjau arsip browser atau file backup v1 → tinjau sumber dan konfirmasi backup → Petugas menyalin record aktual yang sesuai sebagai **DRAFT**. Definisi proporsi/target periode harus sudah disahkan dan sebanding. Konflik periode ditolak, simulasi tidak diterima. Approval lokal lama tidak diimpor sebagai approval server. Bukti berbentuk referensi, RCA dan audit lama tetap dalam arsip/backup; tidak dipalsukan sebagai aksi pengguna Auth baru.
- Backup server: gunakan backup/PITR Supabase atau `pg_dump` dengan credential operator melalui binding aman di mesin operator; jangan menaruh connection string di repositori, frontend atau log. Backup Storage **terpisah** dari metadata PostgreSQL. Ekspor JSON UI hanya data sesuai akses, bukan backup database/Auth/Storage penuh.
- Uji restore ke proyek staging terpisah: pulihkan Auth/UUID, skema dan data, lalu objek Storage; periksa constraints, jumlah/isi publikasi, snapshot, role/RLS, bukti dan login lintas role sebelum mengalihkan traffic. Jangan restore menimpa produksi sebagai tes.
- Pengujian lokal memverifikasi logical roundtrip semua tabel workflow ke database baru dan RLS setelah restore. Ini tidak menguji backup layanan hosted, password Auth atau blob Storage hosted.
- Rollback aplikasi: hentikan penerimaan perubahan, ambil backup DB + Storage, redeploy build Vercel sebelumnya. Simpan database tambahan dan localStorage v1; **jangan DROP tabel atau menjalankan down migration destruktif**. Build lama hanya menampilkan arsip v1, bukan data multiuser baru. Kembalikan build baru untuk melihat data server yang tetap dipertahankan. Untuk kerusakan database, uji restore staging dahulu; pilih pemulihan terencana, bukan penimpaan histori.

## Pengujian dan batas validasi

```sh
npm ci --cache /workspace/.npm-cache
npm run lint
npm test          # aturan lama/baru + PostgreSQL native terisolasi
npm run build
npm run test:e2e  # Chromium: arsip lama, workflow demo, config production gagal tertutup
npm run test:live # SKIP tanpa proyek staging dan empat akun yang disiapkan
```

`embedded-postgres` memasang binary PostgreSQL sesuai platform dari lockfile dan membuat cluster sementara di `/tmp` sebagai user biasa. Bukan proses database produksi dan bukan emulasi SQL. Schema `auth.uid`, role platform dan Storage test dibuat sebagai fixture; Auth HTTP, signed URL HTTP dan layanan WebSocket Supabase hosted tidak ditiru sebagai bukti keberhasilan.

Suite live memerlukan `RSAS_LIVE_ENV=staging`, `RSAS_LIVE_URL`, `RSAS_LIVE_PERIOD`, `RSAS_LIVE_INDICATOR`, `RSAS_LIVE_UNIT`, dan `RSAS_LIVE_{UNIT,VALIDATOR,MUTU,LEADER}_{EMAIL,PASSWORD}` di secret settings mesin pengujian. Jangan menulis nilai di chat atau source. Siapkan indikator proporsi sintetis, denominator 10 diizinkan, periode kosong dan pemetaan akun. Suite memakai empat konteks browser independen, memeriksa refresh, data belum final tidak tampil dan publikasi muncul di browser pimpinan tanpa reload (Realtime/polling). Trace/screenshot/video dimatikan untuk mencegah credential terekam. Jangan arahkan suite ke produksi.

Belum divalidasi tanpa proyek: operasi Auth/Storage/Realtime hosted, delivery email, scheduler Cron, deployment Vercel dan restore managed backup. Pengaturan manual tersebut diperlukan sebelum menerima data operasional. Tidak ada data pasien, password baru atau credential produksi yang dibuat. XLSX tidak disertakan; tersedia CSV, PNG dan PDF melalui cetak browser. Server error tidak dikirim ke layanan monitoring eksternal; operasikan log Supabase/Vercel dengan redaksi dan akses terbatas.
