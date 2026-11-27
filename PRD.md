# Product Requirement Document (PRD)
**Nama Proyek:** ExamPro PAI - Sistem CBT Ujian Online (Pretest & Postest)  
**Afiliasi & Penyelenggara:** Direktorat PAI Kemenag RI & FITK UIN Syarif Hidayatullah Jakarta  
**Versi:** 2.5.0 (Final Release — Multi-Role RBAC, Live Monitoring, Pemetaan Paket Kelas, Ekspor PDF/Excel & Optimasi 4-Tahap)  
**Tanggal:** 26 November 2026  
**Status:** Implemented & Production Ready  

---

## 1. Ringkasan Eksekutif
**ExamPro PAI** adalah sistem ujian online modern (*Computer-Based Test / CBT*) berbasis web yang dirancang khusus untuk memfasilitasi pelaksanaan asesmen pretest dan postest Pelatihan Guru PAI secara efisien, aman, akurat, dan tanpa biaya sewa infrastruktur server (*zero hosting cost*).

Sistem ini mengadopsi arsitektur **Jamstack & Serverless Modern**:
* **Frontend:** Single Page Application (SPA) berbasis React.js 18 (Vite 6), Tailwind CSS, Framer Motion, dan SheetJS (`xlsx`), dihosting di **Cloudflare Pages** melalui integrasi CI/CD repositori **GitHub**.
* **Backend:** Serverless REST API menggunakan **Google Apps Script (GAS)** Web App (`gas/Code.gs`) yang diperkuat `CacheService` (RAM Cache) dan `LockService` (antrean transaksi).
* **Database:** **Google Sheets** sebagai basis data relasional 5-tabel (`Sessions`, `Questions`, `Participants`, `Submissions`, `Admins`).
* **Media Storage:** **Google Drive** sebagai penyimpanan publik aset gambar soal dan opsi jawaban menggunakan direct CDN link.

Implementasi versi 2.5.0 memprioritaskan **integritas & pengawasan ujian real-time** (*Live Proctoring*, token berputar setiap 1 menit, deteksi pindah tab), **penilaian sisi server** dengan rumus transparan berbasis bobot soal, **pemisahan modul administrasi yang ergonomis** dengan dukungan **RBAC 3-peran**, serta **pelaporan lengkap** (PDF individu berkop resmi & rekap Excel massal sesuai urutan template Bank Soal).

---

## 2. Tujuan & Sasaran
* **Zero Infrastructure Cost:** Memanfaatkan sepenuhnya ekosistem Google Workspace (Sheets, Drive, Apps Script) dan Cloudflare Pages tanpa kebutuhan VPS atau database berbayar.
* **Integritas & Pengawasan Real-Time:**
  * Kunci jawaban terlindungi 100% di sisi server (*server-side scoring* dan sensor kunci pada payload soal peserta).
  * Token masuk dinamis yang berputar otomatis setiap **1 menit** (*time-windowed rotating token* bebas ambiguitas karakter) dilengkapi *grace period* 60 detik dan dukungan token master sesi.
  * Deteksi perpindahan tab/jendela browser (*Tab Switch / Visibility Change*), mode layar penuh (*Fullscreen*), pemblokiran klik kanan dan pintasan copy-paste/DevTools, serta **Live Monitor Real-Time** yang memungkinkan pengawas mengirim teguran layar, memaksa pengumpulan ujian, atau mereset status peserta.
* **Keandalan Tinggi & Konsistensi Data (Fault Tolerance):**
  * Auto-save jawaban secara real-time ke `localStorage` browser per peserta & sesi.
  * Timer terhitung dari waktu mulai server (`start_time`) + durasi sesi.
  * Mekanisme **Deduplikasi Peserta** di backend maupun frontend agar jumlah peserta sesi tidak pernah mengganda saat peserta login/mengerjakan, serta **Auto-Recalculation** untuk memulihkan skor jika terjadi ketidaksesuaian sesi.
* **Kemudahan Rekapitulasi & Pelaporan:**
  * Penilaian otomatis pilihan ganda berdasarkan bobot soal (`Jumlah Benar × Bobot Soal`), penilaian essay manual, ekspor **PDF Lembar Hasil Evaluasi Individu** berkop Kemenag RI & FITK UIN Jakarta, serta ekspor **Excel Massal** sesuai urutan butir Bank Soal asli.

---

## 3. Target Pengguna & Hak Akses (RBAC)

Sistem menerapkan *Role-Based Access Control (RBAC)* untuk panel pengelola serta alur terpisah bagi peserta:

1. **Super Admin (`superadmin`):**
   * Akses penuh ke seluruh menu: Dashboard & Sesi, Live Monitor Ujian, Pengaturan Ujian & Soal (3 Sub-menu), Data Peserta & Excel, Rekap Nilai & Essay, **Cadangan & Pemulihan (Backup/Restore/Repair DB)**, serta **Kelola Admin & Role**.
2. **Pengajar / Dosen (`instructor`):**
   * Mengelola Dashboard & Sesi, Live Monitor, Pengaturan Ujian & Soal (Atur Ujian & Pemetaan Kelas, Data Mata Ujian / Kegiatan, Bank Soal & Paket), Data Peserta, serta Rekap Nilai & Penilaian Essay.
3. **Pengawas Ujian (`proctor`):**
   * Mengakses Dashboard & Sesi, **Live Monitor Ujian Real-Time** (memantau progres terjawab, pelanggaran pindah tab, mengirim *Tegur Layar*, *Kumpulkan Paksa*, *Reset*), dan melihat Data Peserta.
4. **Peserta Ujian (`participant`):**
   * Login melalui alur **2-Tahap**: (1) Autentikasi Username & Password, (2) Konfirmasi Data Peserta & Token Ujian berputar 1 menit.
   * Mengerjakan soal dengan navigasi interaktif (`NavGrid`), auto-save lokal, dan langsung melihat perolehan skor pilihan ganda setelah submit (kecuali dinonaktifkan oleh admin pada sesi terkait).

---

## 4. Arsitektur Sistem & Spesifikasi Deployment

```text
+-------------------------------------------------------------------------+
|                              GITHUB REPO                                |
|           (Source Code, Branch Main, CI/CD Cloudflare Hook)             |
+------------------------------------+------------------------------------+
                                     | (Webhook Trigger on Git Push)
                                     v
+-------------------------------------------------------------------------+
|                        CLOUDFLARE PAGES (FRONTEND)                      |
|  - React 18 (Vite 6 SPA) + Tailwind CSS + Framer Motion + SheetJS       |
|  - SWR Client-Side Cache (Admin Navigation 0 ms) + Mock Fallback DB     |
|  - Routing SPA via public/_redirects (/* /index.html 200)               |
+------------------------------------+------------------------------------+
                                     |
                                     | HTTP REST API Request (doGet/doPost)
                                     | (Payload JSON tanpa preflight CORS)
                                     v
+-------------------------------------------------------------------------+
|                    GOOGLE APPS SCRIPT (BACKEND SERVERLESS)              |
|  - Web App Deployment (Execute as: Me, Access: Anyone)                 |
|  - CacheService RAM (Master Soal, Sesi, Heartbeat Live Proctor)         |
|  - LockService (Antrean Submit Ujian Massal Anti-Race Condition)        |
|  - Server-Side Scoring, Deduplikasi Peserta, Drive Upload Handler       |
+-------------------+--------------------------------+--------------------+
                    |                                |
                    v                                v
+------------------------------------+ +----------------------------------+
|      GOOGLE SHEETS (DATABASE)      | |   GOOGLE DRIVE (MEDIA STORAGE)   |
| 1. Sessions (Mata Ujian / Sesi)    | | - Folder Khusus Aset Ujian       |
| 2. Questions (Bank Soal per Paket) | | - Permission: Public View        |
| 3. Participants (13 Kolom Profil)  | | - Direct CDN Link (lh3 format)   |
| 4. Submissions (Jawaban & Nilai)   | +----------------------------------+
| 5. Admins (Akun & Role RBAC)       |
+------------------------------------+
```

### A. Frontend (Cloudflare Pages via GitHub)
* **Kompilasi:** Vite v6, React v18.3 (**Strictly JavaScript `.jsx`**, tanpa TypeScript).
* **Routing:** React Router DOM v6 dengan `public/_redirects` (`/* /index.html 200`).
* **Mode Offline/Preview:** `gasApi.js` menyediakan fallback database lokal (`localStorage` mock DB) apabila `VITE_GAS_API_URL` belum dikonfigurasi, serta automatic fallback pada penghapusan peserta massal apabila deployment GAS belum diperbarui.

### B. Backend (Google Apps Script / GAS)
* **Endpoint Tunggal:** `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`.
* **Keamanan CORS:** Seluruh permintaan `POST` dikirim menggunakan `fetch(URL, { method: 'POST', body: JSON.stringify(data) })` (default `text/plain`) guna menghindari kegagalan *preflight OPTIONS* pada Google Apps Script redirect (HTTP 302).

### C. Database (5 Master Sheets di Google Sheets)

#### 1. Sheet `Sessions` (Data Mata Ujian / Kegiatan)
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `session_id` | String | ID unik sesi (misal: `SES-001`) |
| `title` | String | Judul kegiatan / mata ujian |
| `type` | String | `pretest` atau `postest` |
| `token` | String | Token master statis sesi (pendamping token berputar 1 menit) |
| `duration_minutes` | Number | Durasi pengerjaan dalam menit (default: `60`) |
| `is_active` | Boolean | `TRUE` jika sesi dibuka, `FALSE` jika ditutup |
| `shuffle_questions` | Boolean | Acak urutan nomor soal per peserta |
| `shuffle_options` | Boolean | Acak urutan opsi PG per peserta |
| `show_score` | Boolean | Tampilkan skor langsung ke peserta setelah submit (default: `TRUE`) |
| `created_at` | String | ISO Timestamp pembuatan sesi |
| `start_at` | String | ISO Timestamp hari & jam awal jadwal ujian (opsional) |
| `end_at` | String | ISO Timestamp hari & jam akhir jadwal ujian (opsional) |

#### 2. Sheet `Questions` (Bank Soal & Paket)
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `question_id` | String | ID unik soal (misal: `Q-001`) |
| `session_id` | String | Relasi default ke `session_id` |
| `paket` | String | Nama paket soal (misal: `Pretest`, `Postest`, `Paket A`) |
| `type` | String | `single_choice`, `multiple_choice`, atau `essay` |
| `question_text` | String | Teks pertanyaan |
| `image_url` | String | URL gambar soal dari Google Drive (opsional) |
| `options_json` | String | JSON Array opsi `[{"id":"A","text":"...","image":""}, ...]` |
| `key_answer` | String | Kunci jawaban (`"A"`, `"A,C"`, atau rubrik essay) |
| `weight` | Number | Bobot poin per butir soal (default: `1`, misal `2` poin/soal) |

#### 3. Sheet `Participants` (Data Peserta — 13 Kolom)
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `participant_id` | String | ID unik peserta |
| `session_id` | String | Relasi ke sesi ujian |
| `username` | String | Username login peserta (misal: `guru_pai_01`) |
| `password` | String | Password akun peserta (default import: `kemenag2026`) |
| `full_name` | String | Nama lengkap peserta |
| `gender` | String | Jenis kelamin (`Laki-Laki`, `Perempuan`, atau `-` jika kosong) |
| `identifier` | String | Nomor Induk / NIP / NIM / NIK |
| `kelas` | String | Kelas / rombel / kelompok dinamis |
| `institution` | String | Asal madrasah / sekolah / instansi |
| `paket` | String | Paket soal yang dipetakan oleh admin untuk peserta ini |
| `token_used` | String | Token yang dipakai saat memulai ujian |
| `start_time` | String | ISO Timestamp waktu mulai pengerjaan |
| `status` | String | `registered`, `in_progress`, `submitted`, atau `disqualified` |

#### 4. Sheet `Submissions` (Lembar Jawaban & Nilai)
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `submission_id` | String | ID unik submisi |
| `participant_id` | String | Relasi ke `participant_id` / `username` peserta |
| `session_id` | String | Relasi ke `session_id` |
| `answers_json` | String | JSON pasangan `question_id` terhadap jawaban template peserta |
| `pg_score` | Number | Skor PG terhitung (`Jumlah Benar × Bobot Soal`) |
| `essay_score` | Number | Skor manual penilaian essay (default: `0`) |
| `total_score` | Number | Total akumulasi nilai (`pg_score + essay_score`) |
| `tab_switch_count` | Number | Total pelanggaran keluar layar / pindah tab |
| `submitted_at` | String | ISO Timestamp pengumpulan |

#### 5. Sheet `Admins` (Manajemen Admin & Role)
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `admin_id` | String | ID unik admin (misal: `ADM-001`) |
| `username` | String | Username login admin |
| `password` | String | Password akun admin |
| `name` | String | Nama tampilan lengkap |
| `role` | String | `superadmin`, `instructor`, atau `proctor` |
| `is_active` | Boolean | Status keaktifan akun |
| `created_at` | String | ISO Timestamp pembuatan akun |

---

## 5. Fitur Fungsional Utama

### A. Modul Admin & Pengawasan
1. **Autentikasi Admin (`AdminLoginPage.jsx`):**
   * Login menggunakan **Username dan Password** (tanpa input PIN/Secret Key di antarmuka login) yang diverifikasi ke sheet `Admins` dengan fallback akun darurat bawaan.
2. **Dashboard & Ringkasan Sesi (`DashboardPage.jsx`):**
   * Menampilkan statistik cepat jumlah sesi, soal, peserta, submisi, kartu kontrol cepat sesi, serta tautan langsung menuju Google Sheets & Google Drive.
3. **Live Monitor & Pengawasan Ujian Real-Time (`LiveMonitorPage.jsx`):**
   * Memilih sesi ujian yang dipantau dengan auto-refresh yang dapat diatur (`5s`, `10s`, `20s`, `30s`) beserta mode Pause/Play dan refresh manual.
   * Menampilkan 4 kartu KPI: *Total Peserta Sesi* (unik/terdeduplikasi), *Sedang Mengerjakan*, *Sudah Mengumpulkan*, dan *Terdeteksi Curang* (dengan notifikasi audio Web Audio API saat pelanggaran bertambah).
   * Tampilan ganda **Grid Kartu** dan **Tabel** lengkap dengan filter status, kelas, pencarian, progres terjawab (`answered_count / total_questions`), jumlah pelanggaran, dan skor akhir.
   * Kontrol Pengawas Real-Time ke peserta aktif: **Tegur Layar**, **Kumpulkan Paksa**, dan **Buka Kunci / Reset**.
4. **Pengaturan Ujian & Soal (3 Sub-Menu Terpisah dengan `ExamSubNav.jsx`):**
   * **1. Atur Ujian & Pemetaan Kelas (`/admin/exam-setup` — `ExamSetupPage.jsx`):** Memetakan paket soal ke seluruh peserta dalam satu kelas secara massal atau berdasarkan pilihan ceklis peserta.
   * **2. Data Mata Ujian / Kegiatan (`/admin/sessions` — `SessionsPage.jsx`):** Membuat, mengedit, mengaktifkan/menutup sesi (Pretest/Postest), mengatur token statis, durasi, **rentang hari & waktu awal–akhir (`start_at` s.d. `end_at`)**, acak soal, acak opsi, toggle tampilkan skor, serta proteksi hapus sesi. Ketika sesi dinonaktifkan, peserta aktif otomatis keluar ruang ujian, login diblokir, dan tabel/Excel `Participants` otomatis di-reset bersih ke kondisi sebelum plotting (tanpa menghapus riwayat nilai `Submissions`).
   * **3. Data Bank Soal & Paket (`/admin/questions` — `QuestionBankPage.jsx`):** CRUD soal (PG Tunggal, PG Jamak, Essay), upload gambar soal ke Google Drive, unduh template Excel soal, import massal via 2D Matrix ke paket tertentu, hapus soal per paket, dan ekspor bank soal ke `.xlsx`.
5. **Data Peserta & Excel (`/admin/participants` — `ParticipantsPage.jsx`):**
   * Pencarian dan filter berdasarkan Kelas, Paket Soal, dan Jenis Kelamin.
   * Tambah peserta manual (tanpa field paket soal karena paket dipetakan terpusat di menu Atur Ujian; jenis kelamin kosong otomatis diisi `-`), edit peserta, hapus satuan, **Hapus Massal Terpilih via Ceklis**, dan **Hapus Semua** (dengan konfirmasi ketik `HAPUS SEMUA`).
   * Unduh template Excel peserta, Import Excel massal (`batchSaveParticipants`), dan Backup data peserta (`.xlsx`).
   * Mitigasi tampilan tabel agar teks nama instansi/kelas yang panjang membungkus rapi (`inline-block`, `break-words`) tanpa terpotong atau menimpa baris lain.
6. **Rekap Nilai & Penilaian Essay (`/admin/results` — `ResultsPage.jsx`):**
   * Formula nilai konsisten: **Skor PG = Jumlah Benar × Bobot Soal** dan **Total Nilai = Skor PG + Skor Essay** (dengan sanitasi otomatis kelas/paket agar tidak menampilkan string timestamp).
   * Tabel ringkasan menampilkan Nama & NIP, Kelas, Paket, Skor PG, Skor Essay, Total Nilai, Analisis PG (Benar/Salah), Jumlah Pelanggaran, dan Waktu Selesai.
   * **Modal Review Visual (`Detail`)**: Menampilkan rekap 5 metrik nilai, filter butir soal (`Semua`, `Benar`, `Salah`, `Essay`), perbandingan teks jawaban peserta vs kunci jawaban asli, serta form input nilai Essay.
   * **Cetak / Unduh PDF Individual & PDF Lengkap Semua Peserta**:
     * PDF Individual: Dokumen A4 resmi siap cetak/Simpan PDF berkop Direktorat PAI Kemenag RI & FITK UIN Jakarta, identitas lengkap peserta, ringkasan 5 metrik skor, tabel butir soal berstatus `✓ BETUL (BENAR)` / `✗ SALAH` / `KOSONG`, dan kolom tanda tangan panitia.
     * **Unduh PDF Lengkap (.pdf)**: Dokumen multi-halaman A4 yang memuat halaman rekapitulasi massal beserta lembar rincian evaluasi butir soal seluruh peserta yang sudah mengerjakan.
   * **Unduh Excel Massal (`.xlsx`)**: Menghasilkan file dengan sheet `Rekap_Jawaban_Template` (Kolom A: No, B: Nomor Peserta, C: Nama, D: Kelas, E: Paket, diikuti kolom Soal 1, Soal 2, dst. sesuai urutan template Bank Soal beserta abjad jawaban template asli walaupun diacak saat ujian, hingga Total Benar/Salah & Skor) dan sheet `Analisis_Benar_Salah`.
7. **Cadangan & Pemulihan (`/admin/backup-restore` — `BackupRestorePage.jsx`):**
   * Ekspor Master Backup Excel 5 sheet lengkap dan Snapshot JSON.
   * Restore data dari file backup (mode *Append* atau *Overwrite* dengan konfirmasi keamanan).
   * Fitur **Periksa & Perbaiki Database** (`checkAndRepairDatabase`): memvalidasi/memformat 5 sheet, menyisipkan header bila hilang tanpa menghapus data, menjalankan **deduplikasi baris peserta ganda** di sheet `Participants`, dan **menghitung ulang otomatis** skor submission yang sempat bernilai 0.
8. **Kelola Admin & Role (`/admin/users` — `AdminUsersPage.jsx`):**
   * CRUD akun administrator, pengajar, dan pengawas beserta pengaturan role RBAC dan status aktif/non-aktif.

### B. Modul Peserta Ujian
1. **Login & Konfirmasi 2-Tahap (`/`, `TokenLoginPage.jsx`):**
   * **Tahap 1 (Login Akun):** Input **Username** dan **Password** untuk autentikasi akun terdaftar (`participantLogin`). Ditolak otomatis bila mata ujian nonaktif, di luar jadwal pelaksanaan, sudah pernah submit, atau waktu pengerjaannya sudah habis.
   * **Tahap 2 (Konfirmasi Data Peserta):**
     * Panel kiri menampilkan **Token Dinamis Berputar 1 Menit** (`getMinuteRotatingToken`) dengan hitung mundur rotasi detik dan petunjuk konfirmasi.
     * Panel kanan menampilkan data readonly **Username** dan **Nama Lengkap Peserta** (baris 2 menampilkan nama full peserta), pilihan **Jenis Kelamin**, badge **Kelas** & **Paket Ujian**, **Mata Ujian & Jadwal Pelaksanaan**, field input konfirmasi **Nama Peserta**, dan field **Token** (disertai tombol *Salin Token Otomatis*).
     * Validasi ke backend (`startExam`): memverifikasi token (mendukung token menit ini, toleransi 1 menit sebelumnya, atau token master sesi), mengupdate status peserta asli menjadi `in_progress` (mempertahankan `start_time` asli bila melanjutkan), serta menolak masuk ulang apabila peserta sudah `submitted` atau waktu ujian telah habis.
2. **Ruang Pengerjaan Ujian (`/exam`, `ExamRoomPage.jsx`):**
   * **Keseragaman & Pengaturan Ukuran Font:** Teks soal, pilihan jawaban, dan textarea essay memakai ukuran font seragam (`Standar: text-base / 16px`) dengan kontrol variasi ukuran (`A-`, `A`, `A+`, `A++`) yang tersimpan di browser peserta.
   * **Timer & Heartbeat + Auto-Save:** Hitung mundur disinkronkan terhadap waktu mulai server dan batas akhir jadwal (`end_at`). Setiap interval 12 detik mengirimkan progres, pelanggaran, serta cadangan jawaban sementara (`draftAnswers`) ke RAM Cache GAS, sekaligus auto-keluar bila sesi dinonaktifkan pengawas dan auto-simpan + submit seluruh jawaban tepat saat waktu mundur mencapai 0.
   * **Penghapusan Token Saat Submit (`submitExam`):** Setelah jawaban berhasil dikumpulkan, kolom `token_used` di sheet `Participants` langsung dihapus/dikosongkan dan status berubah menjadi `submitted` agar token tidak bisa dipakai ulang.
   * **Navigasi Soal (`NavGrid.jsx`):** Menampilkan grid nomor soal dengan warna permanen yang tidak tumpang tindih: **Sudah Dijawab** (Biru solid `bg-blue-600 text-white`), **Ragu-ragu** (Kuning Amber `bg-amber-400`), **Belum Dijawab** (Abu-abu `bg-slate-100`), serta cincin hijau (`ring-emerald-500`) penanda nomor aktif yang sedang dibuka.
   * **Anti-Kecurangan (`useAntiCheat.js`):** Deteksi `visibilitychange` dan `blur`, permintaan mode fullscreen, pemblokiran klik kanan dan shortcut `Ctrl+C/V/U/F12`, serta modal interupsi `ViolationModal`.
3. **Halaman Selesai & Pengumuman Skor (`/result`, `ResultPage.jsx`):**
   * Efek visual selebrasi `canvas-confetti` saat skor ditampilkan.
   * Untuk soal Pilihan Ganda (PG), **skor langsung ditampilkan secara default** (`pgScore/100`) begitu peserta selesai ujian, dan hanya disembunyikan jika admin secara eksplisit mematikan opsi *Tampilkan Skor* (`show_score = false`) pada pengaturan sesi ujian.

---

## 6. Spesifikasi Teknis & Stack Teknologi

| Komponen | Pilihan Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Frontend Framework** | React.js `^18.3.1` + Vite `^6.0.0` | SPA modern, strictly `.jsx` (No TypeScript). |
| **Styling & UI** | Tailwind CSS `^3.4.16` | Utility-first, tipografi `Plus Jakarta Sans`, palet Kemenag & UIN. |
| **Animasi & Efek** | Framer Motion `^11.5.4`, Canvas Confetti `^1.9.3` | Transisi halus, modal dialog, confetti halaman hasil. |
| **Ikon** | Lucide React `^0.441.0` | Paket ikon UI ringan dan konsisten. |
| **Olah Excel (.xlsx)** | SheetJS (`xlsx` `^0.18.5`) | Parsing import Excel & ekspor multi-sheet di sisi klien. |
| **State Management** | React Context API (`AuthContext`, `ExamContext`) | Pengelolaan kredensial RBAC, soal, auto-save, dan timer. |
| **Routing** | React Router DOM `^6.26.2` | Navigasi SPA peserta & multi-laman admin. |
| **Hosting Frontend** | Cloudflare Pages | Deploy otomatis dari branch `main` GitHub. |
| **Backend API** | Google Apps Script (GAS) | Serverless Web App (`doGet` & `doPost`). |
| **Database** | Google Sheets | 5 Master Sheets (`Sessions`, `Questions`, `Participants`, `Submissions`, `Admins`). |
| **Media Storage** | Google Drive | Penyimpanan aset gambar soal & opsi jawaban. |

---

## 7. Desain UI/UX Guidelines

* **Identitas Resmi Instansi:** Menggunakan aset resmi `Logo_Kemenag.png` dan `Logo_UIN.png` (termasuk sebagai favicon di `index.html`), serta header status peserta (`[Username] - PESERTA [NAMA LENGKAP]`) di `HeaderBar.jsx`.
* **Modern & Rounded Aesthetic:** Kontainer kartu, tabel, input, dan modal memakai radius besar (`rounded-2xl` / `1rem`, `rounded-3xl` / `1.5rem`, dan `rounded-4xl` / `2rem`).
* **Palet Warna (`tailwind.config.js`):**
  * **Primary Kemenag Green:** `kemenag-600` (`#0D7A5F`) hingga `kemenag-900` (`#04382A`).
  * **Aksen UIN Jakarta:** `uin.blue` (`#1A569E`), `uin.gold` (`#E5A91E`), latar belakang `uin.mint` (`#EBF8F4` / `bg-mint-grid`).
  * **Status & Indikator:**
    * Terjawab (NavGrid): Biru solid (`bg-blue-600 text-white`).
    * Ragu-ragu: Kuning (`bg-amber-400`).
    * Sukses / Aktif: Emerald (`emerald-500` / `emerald-600`).
    * Peringatan / Pelanggaran: Rose (`rose-500` / `rose-600`).
* **Komponen Kunci:** `HeaderBar`, `AdminLayout`, `ExamSubNav`, `QuestionCard`, `OptionItem`, `TimerDisplay`, `NavGrid`, `ViolationModal`, `LoadingScreen`, `Button`, `Card`, `Modal`.

---

## 8. Kontrak API Google Apps Script (`gas/Code.gs`)

Endpoint tunggal Web App: `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`

### A. Endpoint `GET` (`doGet`)
* `?action=ping`: Mengecek status aktif API GAS.
* `?action=setup` / `checkAndRepair` / `repairDatabase`: Menjalankan validasi, perbaikan 5 sheet, deduplikasi peserta, dan kalkulasi ulang skor 0.
* `?action=getSession&token={TOKEN}`: Mengambil informasi sesi ujian berdasarkan token.
* `?action=getExamQuestions&token={TOKEN}&participantId={ID}&paket={PAKET}`: Mengambil soal sesuai paket dari RAM Cache (opsi diacak jika aktif, **tanpa kunci jawaban**).
* `?action=getAdminDashboard&secretKey={KEY}`: Mengambil seluruh data sesi, bank soal, peserta, submisi, dan daftar admin dalam 1 panggilan batch.
* `?action=getAdminUsers&secretKey={KEY}`: Mengambil daftar akun pengelola/admin.
* `?action=getLiveProctor&secretKey={KEY}&sessionId={SESSION_ID}`: Mengambil status real-time pengawasan ujian dari gabungan RAM Cache & spreadsheet (terdeduplikasi).

### B. Endpoint `POST` (`doPost`)
* `adminLogin`: Autentikasi admin berbasis `username` + `password` terhadap sheet `Admins` (mengembalikan profil & `role`).
* `participantLogin`: Autentikasi peserta tahap 1 (`username` + `password`).
* `startExam`: Validasi token berputar/master tahap 2, mengupdate baris peserta eksisting ke status `in_progress` (atau menambah walk-in), mencatat `start_time`, dan inisialisasi cache proctor.
* `submitExam`: Penilaian server-side PG (`Jumlah Benar × Bobot`), penyimpanan jawaban ke `Submissions` dalam `LockService`, pembaruan status peserta menjadi `submitted`, dan pengembalian skor.
* `updateExamProgress`: Menerima heartbeat progres terjawab & pelanggaran dari browser peserta dan mengirimkan perintah pengawas tertunda (`pendingCommand`).
* `getLiveProctor` & `proctorAction`: Memantau status peserta dan mengirim aksi pengawas (`warn`, `force_submit`, `reset`).
* `saveSession` & `deleteSession`: CRUD mata ujian / sesi dan pembersihan cache ujian.
* `saveQuestion`, `batchSaveQuestions`, `deleteQuestion`, `deleteQuestionsByPaket`: CRUD satuan dan import massal 2D Matrix soal per paket.
* `saveParticipant`, `batchSaveParticipants`, `deleteParticipant`, `batchDeleteParticipants`, `deleteAllParticipants`: CRUD satuan, import massal 2D Matrix, hapus pilihan ceklis, dan hapus seluruh peserta.
* `gradeEssay`: Penyimpanan nilai essay manual dan pembaruan total nilai di `Submissions`.
* `uploadMedia`: Upload gambar Base64 ke Google Drive dan pengembalian tautan langsung CDN (`lh3.googleusercontent.com/d/{FILE_ID}`).
* `saveAdminUser` & `deleteAdminUser`: CRUD pengguna admin & role RBAC.
* `checkAndRepair` / `repairDatabase`, `exportFullBackup`, `restoreFullBackup`: Pemeliharaan database, backup 5 sheet, dan pemulihan (`append` / `overwrite`).

---

## 9. Struktur Folder Proyek Aktual

```text
Aplikasi Pre Pos/
├── PRD.md                           # Dokumen Spesifikasi Produk (File Ini)
├── README.md                        # Dokumentasi Proyek
├── package.json                     # Dependensi & Script Build Vite
├── vite.config.js
├── tailwind.config.js               # Konfigurasi Palet Warna Kemenag & UIN Jakarta
├── postcss.config.js
├── index.html                       # Entry HTML dengan Favicon Logo Kemenag & Font Plus Jakarta Sans
├── .env.example
├── public/
│   ├── _redirects                   # Konfigurasi SPA Cloudflare Pages (/* /index.html 200)
│   ├── Logo_Kemenag.png
│   ├── Logo_UIN.png
│   └── favicon.svg
├── gas/
│   ├── Code.gs                      # Backend Google Apps Script Lengkap (doGet, doPost, Cache, Lock, RBAC)
│   ├── SETUP_GUIDE.md               # Panduan Setup Google Sheets & Apps Script
│   └── appsscript.json              # Manifest Konfigurasi GAS
├── src/
│   ├── assets/                      # Logo_Kemenag.png & Logo_UIN.png
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AdminLayout.jsx      # Sidebar Navigasi RBAC & Header Admin
│   │   │   ├── ExamSubNav.jsx       # Navigasi 3 Sub-Menu Pengaturan Ujian & Soal
│   │   │   └── HeaderBar.jsx        # Header Resmi Kemenag & UIN + Info Peserta Aktif
│   │   ├── exam/
│   │   │   ├── NavGrid.jsx          # Grid Nomor Soal (Biru Permanen Terjawab, Kuning Ragu, Ring Aktif)
│   │   │   ├── OptionItem.jsx       # Item Opsi PG Tunggal/Jamak + Lightbox Gambar
│   │   │   ├── QuestionCard.jsx     # Tampilan Soal, Gambar Zoom, Pilihan Ganda & Essay
│   │   │   ├── TimerDisplay.jsx     # Timer Mundur Sinkron Server
│   │   │   └── ViolationModal.jsx   # Modal Peringatan Anti-Kecurangan
│   │   └── ui/
│   │       ├── Button.jsx
│   │       ├── Card.jsx
│   │       ├── LoadingScreen.jsx    # Layar Loading Terpadu Kemenag/UIN
│   │       └── Modal.jsx
│   ├── context/
│   │   ├── AuthContext.jsx          # State Autentikasi Admin (RBAC) & Peserta
│   │   └── ExamContext.jsx          # State Soal, Jawaban Auto-Save LocalStorage & Heartbeat
│   ├── hooks/
│   │   ├── useAntiCheat.js          # Deteksi Tab Switch, Fullscreen, Blokir Shortcut
│   │   └── useServerTimer.js        # Timer Terhitung dari Server Start Time
│   ├── pages/
│   │   ├── user/
│   │   │   ├── TokenLoginPage.jsx   # Login Akun Tahap 1 + Konfirmasi Data & Token 1-Menit Tahap 2
│   │   │   ├── ExamRoomPage.jsx     # Ruang Pengerjaan Ujian & Instruksi Pengawas
│   │   │   └── ResultPage.jsx       # Penutup Ujian & Pengumuman Skor PG Langsung
│   │   └── admin/
│   │       ├── AdminLoginPage.jsx   # Login Admin (Username & Password)
│   │       ├── DashboardPage.jsx    # Dashboard Ringkasan Sesi & Statistik
│   │       ├── LiveMonitorPage.jsx  # Pengawasan Real-Time, Progres, Pelanggaran & Aksi Pengawas
│   │       ├── ExamSetupPage.jsx    # Sub-Menu 1: Atur Ujian & Pemetaan Paket ke Kelas
│   │       ├── SessionsPage.jsx     # Sub-Menu 2: Data Mata Ujian / Kegiatan
│   │       ├── QuestionBankPage.jsx # Sub-Menu 3: Data Bank Soal, Paket & Import Excel
│   │       ├── ParticipantsPage.jsx # Data Peserta, Import/Export Excel, Hapus Checklist & Massal
│   │       ├── ResultsPage.jsx      # Rekap Nilai, Analisis B/S, Review Visual, PDF Individu & Excel Massal
│   │       ├── BackupRestorePage.jsx# Backup 5-Sheet, JSON Snapshot, Restore & Perbaikan DB
│   │       └── AdminUsersPage.jsx   # Manajemen Akun Admin & Role RBAC
│   ├── services/
│   │   └── gasApi.js                # Klien API GAS + SWR Cache + Fallback Mode Lokal
│   ├── utils/
│   │   ├── excelTemplate.js         # Parser & Generator Template/Rekap Excel (xlsx)
│   │   └── rotatingToken.js         # Algoritma Token Dinamis Berputar 1 Menit
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
```

---

## 10. Alur Kerja Deployment (Deployment Workflow)

1. **Persiapan Backend (Google Workspace):**
   * Buat spreadsheet baru di Google Sheets dan buka **Extensions > Apps Script**.
   * Salin seluruh isi `gas/Code.gs` ke editor Apps Script.
   * Atur *Script Properties* (`DRIVE_FOLDER_ID`, dan `ADMIN_SECRET_KEY` opsional bila memakai token PIN tambahan).
   * Klik **Deploy > New deployment** (atau *Manage deployments > Edit > New version*) dengan tipe **Web app**, *Execute as:* **Me**, *Who has access:* **Anyone**.
   * Jalankan fungsi `checkAndRepairDatabase` (atau via tombol **Periksa & Perbaiki Database** di menu Admin *Cadangan & Pemulihan*) agar 5 sheet terbentuk otomatis beserta header dan akun default admin.
2. **Pengaturan Repositori & Environment (GitHub):**
   * Pastikan seluruh kode di-commit dan di-push ke branch `main`.
   * Konfigurasikan variabel lingkungan `VITE_GAS_API_URL` dengan URL Web App GAS `/exec` terbaru.
3. **Deployment Otomatis (Cloudflare Pages):**
   * Hubungkan repositori GitHub di **Cloudflare Workers & Pages** dengan build preset **Vite**, *Build command:* `npm run build`, *Output directory:* `dist`, serta masukkan `VITE_GAS_API_URL` di Environment Variables.

---

## 11. Arsitektur Akselerasi 4-Tahap (Performance & Quota Optimization)

Untuk mengatasi batasan latensi dan kuota Google Apps Script pada pelaksanaan ujian massal secara bersamaan:

1. **Tahap 1: Bulk 2D Matrix Import (`setValues()`)**
   * Mengimpor puluhan soal atau ratusan peserta dari Excel dalam **satu panggilan array 2D matrix** ke Google Sheets, memangkas waktu impor dari puluhan detik menjadi **~1,5–2 detik**.
2. **Tahap 2: RAM `CacheService` di GAS & `LockService` Antrean Submisi**
   * Master soal dan sesi di-cache pada RAM Apps Script selama 30 menit agar peserta membuka soal secara instan tanpa membebani pembacaan Google Sheets berulang, serta mengamankan submit serentak menggunakan `LockService.getScriptLock()`.
3. **Tahap 3: Client-Side SWR Cache (Navigasi Admin 0 ms)**
   * Data dashboard admin disimpan sementara di memori browser & `sessionStorage` (TTL 60 detik) dengan *Auto Cache-Invalidation* saat ada perubahan data, membuat perpindahan antar menu admin berjalan instan.
4. **Tahap 4: Backend Single-Spreadsheet Open & Batch Range RPC**
   * Membuka objek spreadsheet satu kali per request (`getSpreadsheet()`) dan membaca range presisi (`getLastRow()`, `getLastColumn()`), menekan jumlah panggilan RPC Google Workspace hingga **~60%** dan mencegah *Service Quota Exceeded*.

---
*Dokumen ini diselaraskan penuh dengan source code aktual ExamPro PAI v2.5.0 (Direktorat PAI Kemenag RI & FITK UIN Syarif Hidayatullah Jakarta).*
