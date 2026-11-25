# Product Requirement Document (PRD)
**Nama Proyek:** ExamPro PAI - Sistem CBT Ujian Online (Pretest & Postest)  
**Afiliasi & Penyelenggara:** Direktorat PAI Kemenag RI & FITK UIN Syarif Hidayatullah Jakarta  
**Versi:** 2.5 (Integrasi Visual PAI Kemenag, Alur Konfirmasi Peserta 2-Tahap & Template Excel Bank Soal)  
**Tanggal:** 24 November 2026  
**Status:** Approved Specification  

---

## 1. Ringkasan Eksekutif
ExamPro adalah sistem ujian online modern (*Computer-Based Test / CBT*) berbasis web yang dirancang khusus untuk memfasilitasi pelaksanaan ujian pretest dan postest secara efisien, aman, dan tanpa biaya infrastruktur server (*zero hosting cost*).

Sistem ini mengadopsi arsitektur **Jamstack & Serverless Modern**:
* **Frontend:** Single Page Application (SPA) berbasis React.js (Vite), Tailwind CSS, dan Framer Motion, dihosting di **Cloudflare Pages** melalui integrasi otomatis repositori **GitHub**.
* **Backend:** Serverless API menggunakan **Google Apps Script (GAS)** Web App.
* **Database:** **Google Sheets** sebagai basis data terstruktur (*relational-like spreadsheet*).
* **Media Storage:** **Google Drive** sebagai media penyimpanan aset gambar soal dan opsi jawaban dengan tautan CDN langsung.

Fokus utama arsitektur v2.0 adalah **keamanan integritas ujian** (penilaian di sisi server / *server-side scoring*, anti-kecurangan), **keandalan saat gangguan koneksi** (*auto-save local storage* & sinkronisasi waktu server), serta **kemudahan rekapitulasi data nilai**.

---

## 2. Tujuan & Sasaran
* **Zero Infrastructure Cost:** Memanfaatkan tier gratis Google Workspace (Drive, Sheets, Apps Script) dan Cloudflare Pages tanpa kebutuhan sewa VPS atau database berbayar.
* **Integritas & Anti-Kecurangan Maksimal:** 
  * Kunci jawaban terlindungi 100% di sisi server (peserta tidak bisa membongkar kunci via DevTools / Inspect Element).
  * Deteksi perpindahan tab browser (*Tab Switch / Visibility Change*), mode layar penuh (*Fullscreen*), dan pencegahan copy-paste/klik kanan.
* **Keandalan Tinggi (Fault Tolerance):**
  * Auto-save jawaban real-time ke penyimpanan lokal browser (*localStorage*) untuk mencegah hilangnya jawaban saat baterai habis, laptop mati, atau internet terputus.
  * Sinkronisasi timer berbasis server timestamp agar peserta tidak dapat memanipulasi durasi pengerjaan.
* **Pengalaman Pengguna (UX) Premium:** Antarmuka modern, interaktif, responsif untuk perangkat mobile dan desktop, menggunakan komponen bersudut membulat (`rounded-2xl`) dan animasi mikro yang halus.

---

## 3. Target Pengguna (User Personas)
1. **Admin / Pengajar / Panitia:**
   * Membuat bank soal, mengatur sesi ujian (Pretest / Postest), mengunggah gambar pendukung ke Google Drive.
   * Menentukan token sesi, jadwal, durasi, dan pengaturan tampilan hasil.
   * Memantau kehadiran peserta, menilai soal essay (manual/semi-otomatis), dan menganalisis rekapitulasi nilai yang otomatis tersinkronisasi di Google Sheets.
2. **Peserta Ujian (Siswa / Mahasiswa / Peserta Pelatihan):**
   * Mengakses sistem menggunakan Token Ujian dan mengisi identitas (Nama Lengkap, Nomor Induk/NIM/NIP, Kelas/Instansi).
   * Mengerjakan soal dalam mode aman dengan timer hitung mundur.
   * Melihat hasil langsung setelah submit (jika diizinkan oleh admin).

---

## 4. Arsitektur Sistem & Spesifikasi Deployment

```
+-------------------------------------------------------------------------+
|                              GITHUB REPO                                |
|           (Source Code, Branch Main, CI/CD Cloudflare Hook)             |
+------------------------------------+------------------------------------+
                                     | (Webhook Trigger on Git Push)
                                     v
+-------------------------------------------------------------------------+
|                        CLOUDFLARE PAGES (FRONTEND)                      |
|  - React.js (Vite SPA) + Tailwind CSS + Framer Motion                   |
|  - Global Edge CDN, SSL Terenkripsi                                    |
|  - Routing SPA via public/_redirects (/* /index.html 200)               |
+------------------------------------+------------------------------------+
                                     |
                                     | HTTP REST API Request (doGet/doPost)
                                     | (Payload JSON / Content-Type: text/plain)
                                     v
+-------------------------------------------------------------------------+
|                    GOOGLE APPS SCRIPT (BACKEND SERVERLESS)              |
|  - Web App Deployment (Execute as: Me, Access: Anyone)                 |
|  - Otentikasi Admin via Script Properties (Secret Token/PIN)            |
|  - Server-Side Scoring (Evaluasi PG, pembobotan, masking kunci jawaban) |
|  - Handler Upload Gambar Base64 ke Google Drive                         |
+-------------------+--------------------------------+--------------------+
                    |                                |
                    v                                v
+------------------------------------+ +----------------------------------+
|      GOOGLE SHEETS (DATABASE)      | |   GOOGLE DRIVE (MEDIA STORAGE)   |
| - Sessions (Pengaturan Sesi Ujian) | | - Folder Khusus Aset Ujian       |
| - Questions (Bank Soal & Kunci)    | | - Set Permission: Public View    |
| - Participants (Data Peserta)      | | - Direct CDN Link (lh3 format)   |
| - Submissions (Rekap Jawaban/Skor) | +----------------------------------+
+------------------------------------+
```

### A. Frontend (Cloudflare Pages via GitHub)
* **Kompilasi:** Vite bundler, React 18+ (Strictly JavaScript `.jsx`, No TypeScript).
* **Routing:** React Router DOM v6.
* **Konfigurasi Routing Cloudflare Pages:** Wajib menyediakan file `public/_redirects` berisi `/* /index.html 200` agar saat halaman di-refresh di rute mana pun tidak terjadi error 404.
* **Integrasi CI/CD:** Setiap perubahan kode yang di-*push* ke branch `main` GitHub akan secara otomatis memicu proses build dan rilis di Cloudflare Pages.

### B. Backend (Google Apps Script / GAS)
* **Format API:** GAS Web App Endpoint (`/exec`).
* **Metode:**
  * `doGet(e)`: Mengambil daftar sesi, validasi token, mengambil soal ujian untuk peserta (tanpa data kunci jawaban), dan mengambil data dashboard untuk admin.
  * `doPost(e)`: Registrasi peserta, kalkulasi dan penyimpanan hasil ujian (submit), autentikasi admin, CRUD bank soal, upload gambar ke Google Drive, dan penginputan nilai essay.
* **Penanganan Masalah CORS di GAS:**
  * GAS merespons request lintas domain dengan HTTP 302 Redirect.
  * Seluruh request `POST` dari frontend dikirim menggunakan format `fetch(URL, { method: 'POST', body: JSON.stringify(data) })` tanpa header kustom kompleks untuk menghindari gagalnya *preflight CORS (OPTIONS)*.

### C. Database (Google Sheets)
Struktur spreadsheet terdiri dari 4 sheet utama:

#### 1. Sheet `Sessions` (Daftar Sesi Ujian)
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `session_id` | String | ID unik sesi (misal: `SES-001`) |
| `title` | String | Judul Ujian (misal: "Pretest Pelatihan TOT Batch 1") |
| `type` | String | `pretest` atau `postest` |
| `token` | String | Kode token masuk (misal: `TOT2026`) |
| `duration_minutes` | Number | Durasi ujian dalam menit (misal: `60`) |
| `is_active` | Boolean | `TRUE` jika sesi dibuka, `FALSE` jika ditutup |
| `shuffle_questions`| Boolean | Acak urutan nomor soal |
| `shuffle_options` | Boolean | Acak opsi jawaban pilihan ganda |
| `show_score` | Boolean | Tampilkan skor langsung ke peserta setelah submit |
| `created_at` | String | Timestamp pembuatan sesi |

#### 2. Sheet `Questions` (Bank Soal)
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `question_id` | String | ID unik soal (misal: `Q-001`) |
| `session_id` | String | Relasi ke `session_id` |
| `type` | String | `single_choice`, `multiple_choice`, atau `essay` |
| `question_text` | String | Teks pertanyaan |
| `image_url` | String | URL gambar soal dari Google Drive (opsional) |
| `options_json` | String | JSON Array opsi jawaban `[{"id":"A","text":"...","image":""}, ...]` |
| `key_answer` | String | Kunci jawaban (`"A"` untuk single, `"A,C"` untuk multiple, rubrik untuk essay) |
| `weight` | Number | Bobot nilai per soal (default: `1` atau sesuai konfigurasi) |

#### 3. Sheet `Participants` (Peserta)
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `participant_id` | String | ID unik peserta (misal: `P-timestamp-random`) |
| `session_id` | String | Relasi ke `session_id` |
| `full_name` | String | Nama lengkap peserta |
| `identifier` | String | NIP / NIM / Email peserta |
| `token_used` | String | Token yang digunakan saat login |
| `start_time` | String | ISO Timestamp waktu mulai pengerjaan |
| `status` | String | `in_progress`, `submitted`, `disqualified` |

#### 4. Sheet `Submissions` (Jawaban & Nilai)
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `submission_id` | String | ID unik submission |
| `participant_id` | String | Relasi ke `participant_id` |
| `session_id` | String | Relasi ke `session_id` |
| `answers_json` | String | JSON jawaban peserta per ID soal |
| `pg_score` | Number | Skor otomatis dari pilihan ganda |
| `essay_score` | Number | Skor manual dari penilaian essay |
| `total_score` | Number | Total akumulasi skor |
| `tab_switch_count`| Number | Total pelanggaran pindah tab |
| `submitted_at` | String | ISO Timestamp submit |

### D. Media Storage (Google Drive)
* Seluruh file gambar soal dan gambar opsi jawaban disimpan di folder khusus di Google Drive admin (`ExamPro_Assets`).
* GAS menerima data gambar dalam bentuk Base64, membuat file di Google Drive, menyetel hak akses file menjadi `Anyone with link can view`.
* URL publik dikonversi menjadi format direct CDN: `https://lh3.googleusercontent.com/d/{FILE_ID}` agar gambar dapat dimuat seketika di tag `<img>` tanpa kendala redirect.

---

## 5. Fitur Fungsional Utama

### A. Modul Admin (Panel Pengajar)
1. **Autentikasi Aman Admin:**
   * Login menggunakan PIN/Secret Key yang tersimpan di *Script Properties* Google Apps Script (bukan hardcoded di frontend).
2. **Manajemen Sesi Ujian:**
   * Pembuatan sesi ujian baru dengan pemilihan kategori: **Pretest** atau **Postest**.
   * Penentuan token ujian, waktu/durasi, status aktif/non-aktif.
   * Switch toggle: "Acak Soal", "Acak Opsi", dan "Tampilkan Skor Setelah Selesai".
3. **Manajemen Bank Soal & Media:**
   * CRUD soal dengan dukungan 3 tipe: Pilihan Ganda Tunggal, Pilihan Ganda Jamak, dan Essay.
   * Form upload gambar langsung ke Google Drive via web interface (menampilkan preview instan).
   * Penentuan kunci jawaban dan bobot skor per soal.
4. **Dashboard Hasil & Penilaian:**
   * Tabel daftar peserta yang sedang mengerjakan dan yang sudah selesai.
   * Indikator pelanggaran peserta (jumlah *tab switch*).
   * Antarmuka khusus untuk koreksi dan input nilai soal Essay per peserta.
   * Ringkasan statistik (Nilai Rata-rata, Tertinggi, Terendah) serta tautan langsung untuk membuka Spreadsheet di Google Sheets.

### B. Modul Peserta Ujian
1. **Halaman Masuk (Login & Identitas):**
   * Input: **Token Ujian**, **Nama Lengkap**, dan **Nomor Induk / NIM / NIP**.
   * Validasi token ke Google Apps Script: memastikan sesi aktif dan mencatat `start_time` peserta di Google Sheets.
2. **Halaman Pengerjaan Ujian (Security & Resilience Mode):**
   * **Sinkronisasi Timer:** Waktu tersisa dihitung dari `start_time` server + durasi sesi.
   * **Auto-Save Local Storage:** Setiap klik pilihan jawaban atau ketikan essay otomatis disimpan di `localStorage` browser. Jika halaman tidak sengaja ditutup atau koneksi putus, peserta dapat langsung melanjutkan tanpa kehilangan jawaban.
   * **Area Soal & Navigasi:**
     * Grid navigasi nomor soal dengan 3 status warna: Belum dijawab (Abu-abu), Sudah dijawab (Indigo), Ragu-ragu (Kuning).
     * Render teks soal dan gambar media pendukung resolusi tinggi.
     * Tombol "Ragu-ragu", "Sebelumnya", "Selanjutnya".
   * **Fitur Anti-Kecurangan (Anti-Cheating Safeguards):**
     * Deteksi perpindahan tab browser (`visibilitychange` / `blur`). Menampilkan modal peringatan dan mencatat penambahan counter pelanggaran.
     * Mode Layar Penuh (*Fullscreen Request*) saat ujian dimulai.
     * Pemblokiran klik kanan (*context menu*), shortcut copy (`Ctrl+C`), paste (`Ctrl+V`), dan pintasan inspeksi elemen (`F12`, `Ctrl+Shift+I`).
3. **Halaman Submit & Penyelesaian:**
   * Modal konfirmasi submit yang merangkum jumlah soal yang sudah dijawab, belum dijawab, dan masih ragu-ragu.
   * Pengiriman data jawaban dan log pelanggaran ke Google Apps Script.
   * **Hasil Ujian:**
     * Jika konfigurasi `show_score = TRUE`: Menampilkan perolehan nilai PG, status evaluasi essay, dan feedback visual.
     * Jika konfigurasi `show_score = FALSE`: Menampilkan ucapan terima kasih dan konfirmasi bahwa jawaban telah tersimpan dengan aman.

---

## 6. Spesifikasi Teknis & Stack Teknologi

| Komponen | Pilihan Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Frontend Framework** | React.js (Vite) | Modern component architecture, build cepat. |
| **Bahasa Frontend** | JavaScript (JSX) | **Strictly No TypeScript**, format file `.jsx`. |
| **Styling & Theme** | Tailwind CSS v3 | Utility-first, mobile-responsive, palet clean & rounded. |
| **Animasi** | Framer Motion | Transisi halaman, modal pop-up, indikator countdown. |
| **Ikon** | Lucide React | Ikon modern, performa ringan. |
| **State Management** | React Context API | Mengelola state sesi ujian, timer, dan jawaban. |
| **Routing** | React Router DOM v6 | Navigasi SPA dengan perlindungan rute (*protected route*). |
| **Hosting Frontend** | Cloudflare Pages | Di-deploy otomatis melalui repository GitHub. |
| **Backend API** | Google Apps Script (GAS) | Serverless endpoint `doGet` dan `doPost`. |
| **Database** | Google Sheets | 4 Master Sheets (Sessions, Questions, Participants, Submissions). |
| **Media Storage** | Google Drive | Penyimpanan publik aset gambar soal & opsi. |

---

## 7. Desain UI/UX Guidelines

* **Modern & Rounded Aesthetic:** Seluruh kartu (*card*), field input, tombol navigasi, dan modal dialog wajib menggunakan radius sudut `rounded-2xl` (`border-radius: 1rem`).
* **Design System & Palet Warna:**
  * **Primary:** `Indigo-600` (Hover: `Indigo-700`) - Memberikan kesan akademis, profesional, dan tepercaya.
  * **Background:** `Slate-50` hingga `Slate-100` dengan kontainer konten berwarna `White` berbayang lembut (`shadow-sm` hingga `shadow-md`).
  * **Status & Alert:**
    * Success: `Emerald-500` (Jawaban terjawab, submit sukses).
    * Warning: `Amber-500` (Tanda ragu-ragu, timer tersisa < 5 menit).
    * Danger: `Rose-500` (Peringatan kecurangan, waktu habis, tombol submit akhir).
* **Komponen Kunci yang Dibutuhkan:**
  1. `QuestionCard`: Kontainer soal dengan tipografi nyaman dibaca dan viewer gambar yang dapat diperbesar (*lightbox modal*).
  2. `OptionItem`: Komponen pilihan ganda yang dapat diklik pada seluruh area baris (bukan hanya pada radio/checkbox).
  3. `TimerDisplay`: Header mengambang (*sticky*) dengan progress bar durasi dan peringatan visual saat waktu menipis.
  4. `NavGrid`: Drawer/sidebar navigasi soal dengan nomor interaktif yang responsif di layar ponsel.
  5. `ViolationModal`: Dialog modal interupsi saat peserta terdeteksi meninggalkan layar ujian.

---

## 8. Kontrak API Google Apps Script (REST Endpoints)

Endpoint tunggal Web App: `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`

### A. Endpoint `GET` (`doGet`)
1. **Cek Koneksi / Ping:**
   * Query: `?action=ping`
   * Response: `{ status: "success", message: "ExamPro API Active" }`
2. **Validasi Sesi & Ambil Informasi Ujian:**
   * Query: `?action=getSession&token={TOKEN}`
   * Response: Data judul ujian, tipe (pre/post), durasi, dan konfigurasi (tanpa data soal).
3. **Ambil Daftar Soal Ujian (Untuk Peserta):**
   * Query: `?action=getExamQuestions&token={TOKEN}&participantId={ID}`
   * Response: Array soal dengan opsi yang sudah diacak (jika aktif). **Kunci jawaban dihilangkan dari payload demi keamanan**.
4. **Ambil Data Dashboard Admin:**
   * Query: `?action=getAdminDashboard&secretKey={SECRET_KEY}`
   * Response: Rekapitulasi sesi, jumlah peserta, rekap nilai, dan bank soal lengkap (termasuk kunci jawaban).

### B. Endpoint `POST` (`doPost`)
1. **Registrasi Masuk Peserta (`action: "startExam"`):**
   * Payload: `{ action: "startExam", token, fullName, identifier }`
   * Fungsi: Membuat entri di sheet `Participants` dan mencatat `start_time`.
2. **Submit Ujian & Penilaian Server-Side (`action: "submitExam"`):**
   * Payload: `{ action: "submitExam", participantId, sessionId, answers: { "Q-1": "A", "Q-2": "Essay..." }, violations: 2 }`
   * Logika Server (GAS):
     1. GAS membaca kunci jawaban asli dari sheet `Questions`.
     2. Menghitung skor pilihan ganda secara otomatis.
     3. Menyimpan data jawaban lengkap, skor PG, dan log pelanggaran ke sheet `Submissions`.
     4. Mengembalikan skor ke peserta hanya jika sesi diatur `show_score = true`.
3. **Upload Gambar Media (`action: "uploadMedia"`):**
   * Payload: `{ action: "uploadMedia", secretKey, base64Data, fileName, mimeType }`
   * Fungsi: Mengunggah file ke Google Drive, set permission publik, dan mengembalikan direct link gambar.
4. **Simpan / Perbarui Soal (`action: "saveQuestion"`):**
   * Payload: Data soal, opsi, kunci jawaban, dan bobot untuk disimpan ke sheet `Questions`.
5. **Input Nilai Essay (`action: "gradeEssay"`):**
   * Payload: `{ action: "gradeEssay", secretKey, submissionId, essayScore }`
   * Fungsi: Memperbarui nilai total di sheet `Submissions`.

---

## 9. Struktur Folder Proyek yang Diusulkan

```text
Aplikasi Pre Pos/
├── PRD.md                       # Dokumen Spesifikasi Produk (File Ini)
├── README.md                    # Petunjuk Instalasi & Deployment
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── public/
│   ├── _redirects               # Konfigurasi SPA Cloudflare Pages (/* /index.html 200)
│   └── favicon.svg
├── gas/
│   ├── Code.gs                  # Kode Backend Google Apps Script (doGet, doPost, Auth)
│   └── appsscript.json          # Manifest konfigurasi Google Apps Script
├── src/
│   ├── assets/                  # Aset ilustrasi & logo
│   ├── components/
│   │   ├── layout/              # Navbar, Header Ujian, Footer
│   │   ├── exam/                # QuestionCard, OptionItem, TimerDisplay, NavGrid, ViolationModal
│   │   ├── admin/               # QuestionForm, SessionCard, GradingTable, MediaUploader
│   │   └── ui/                  # Button, Card, InputField, Modal, Badge (Lucide Icons)
│   ├── context/
│   │   ├── AuthContext.jsx      # Context state admin & peserta
│   │   └── ExamContext.jsx      # Context state pengerjaan soal & local storage
│   ├── hooks/
│   │   ├── useAntiCheat.js      # Hook deteksi tab switch & fullscreen
│   │   ├── useLocalStorage.js   # Hook auto-save jawaban
│   │   └── useServerTimer.js    # Hook countdown sinkron waktu server
│   ├── pages/
│   │   ├── user/
│   │   │   ├── TokenLoginPage.jsx # Halaman input token & identitas peserta
│   │   │   ├── ExamRoomPage.jsx   # Halaman pengerjaan ujian
│   │   │   └── ResultPage.jsx     # Halaman penutup / pengumuman skor
│   │   └── admin/
│   │       ├── AdminLoginPage.jsx # Login admin via secret PIN
│   │       ├── DashboardPage.jsx  # Ringkasan sesi & peserta
│   │       ├── QuestionBankPage.jsx # CRUD bank soal & upload media
│   │       └── ResultsPage.jsx    # Rekapitulasi nilai & penilaian essay
│   ├── services/
│   │   └── gasApi.js            # Layanan integrasi API ke Google Apps Script
│   ├── utils/
│   │   ├── formatters.js        # Format waktu, tanggal, string
│   │   └── shuffle.js           # Algoritma Fisher-Yates untuk acak soal/opsi
│   ├── App.jsx
│   └── main.jsx
```

---

## 10. Alur Kerja Deployment (Deployment Workflow)

1. **Persiapan Backend (Google Workspace):**
   * Buat spreadsheet baru di Google Sheets dengan 4 sheet sesuai skema di Bab 4.
   * Buka menu *Extensions > Apps Script*.
   * Tempelkan kode dari folder `gas/Code.gs`.
   * Atur *Script Properties* untuk `ADMIN_SECRET_KEY` dan `DRIVE_FOLDER_ID`.
   * Deploy sebagai Web App dengan pengaturan:
     * *Execute as:* **Me**
     * *Who has access:* **Anyone**
   * Salin URL Web App yang dihasilkan.
2. **Pengaturan Repositori (GitHub):**
   * Inisialisasi Git dan unggah seluruh kode sumber ke repositori GitHub.
   * Simpan URL Web App Google Apps Script sebagai environment variable `VITE_GAS_API_URL` (atau diatur di file `.env`).
3. **Deployment Otomatis (Cloudflare Pages):**
   * Masuk ke dashboard Cloudflare > *Workers & Pages* > *Create Application* > *Pages* > *Connect to Git*.
   * Hubungkan repositori GitHub yang telah dibuat.
   * Pengaturan Build:
     * *Framework preset:* **Vite**
     * *Build command:* `npm run build`
     * *Build output directory:* `dist`
     * *Environment variables:* Tambahkan `VITE_GAS_API_URL` dengan URL Web App GAS.
   * Klik **Save and Deploy**. Cloudflare Pages akan mempublikasikan aplikasi dengan domain kustom atau subdomain `.pages.dev`.

---

## 11. Arsitektur Akselerasi 4-Tahap (4-Stage Performance & Quota Optimization)

Untuk mengatasi keterbatasan latensi bawaan Google Apps Script dan Google Sheets tanpa beralih ke database berbayar, ExamPro v2.5 mengimplementasikan optimasi 4-tahap menyeluruh:

1. **Tahap 1: Bulk 2D Matrix Import (`setValues()`)**
   * Menggantikan perulangan HTTP POST 1-per-1 saat mengimpor puluhan soal atau ratusan peserta dari Excel (.xlsx).
   * Seluruh baris diakumulasikan dan ditulis dalam **satu panggilan array 2D matrix** ke Google Sheets (`sheet.getRange(startRow, 1, rows.length, numCols).setValues(matrix2D)`).
   * Waktu import 50 butir soal terpangkas dari **~50 detik** menjadi **1,5 - 2 detik**.

2. **Tahap 2: RAM CacheService di GAS & LockService Antrean Submisi**
   * Master butir soal dan data sesi ujian disimpan dalam RAM serverless Apps Script (`CacheService.getScriptCache()`) selama 30 menit.
   * Saat 50–100 peserta memasukkan token dan membuka lembar ujian, data soal disajikan instan (**~0,2 detik**) dari RAM tanpa menyentuh Google Sheets.
   * `LockService.getScriptLock()` mengamankan pengiriman jawaban massal saat waktu ujian habis (*timeout*), menjamin tidak ada lembar jawaban peserta yang hilang atau tabrakan baris (*race condition*).

3. **Tahap 3: Client-Side SWR Cache (Navigasi Admin 0 ms)**
   * Data dashboard admin di-cache dalam memori browser dan `sessionStorage` dengan TTL 60 detik.
   * Berpindah antar menu Admin (Dashboard, Bank Soal, Atur Ujian, Data Peserta, Rekap Nilai) berlangsung instan dalam **0 ms** tanpa layar loading berputar.
   * Dilengkapi mekanisme *Auto Cache-Invalidation* (cache otomatis dibersihkan saat admin menyimpan/mengedit/menghapus data) serta tombol manual **"Segarkan Data"**.

4. **Tahap 4: Backend Single-Spreadsheet Open & Batch Range RPC**
   * Membuka spreadsheet hanya **1 kali** (`getSpreadsheet()`) saat query dashboard atau backup, lalu membaca 5 sheet secara terpadu.
   * Membaca range data presisi (`getRange(1, 1, lastRow, lastCol).getValues()`) untuk menghindari pemindaian sel kosong.
   * Mengurangi panggilan Remote Procedure Call (RPC) ke Google hingga **60%**, memangkas waktu eksekusi backend dari ~3,5 detik menjadi **~0,8 detik**, dan melindungi akun Google Workspace dari risiko kehabisan kuota harian eksekusi (*Service Quota Exceeded*).

---
*Dokumen ini merupakan acuan resmi pengembangan ExamPro v2.5 (PAI Kemenag & FITK UIN Jakarta Edition).*
