# Product Requirement Document (PRD)

**Nama Proyek:** ExamPro PAI — Sistem CBT Ujian Online Terpadu (Pretest & Postest)  
**Afiliasi & Penyelenggara:** Direktorat PAI Kemenag RI & FITK UIN Syarif Hidayatullah Jakarta  
**Versi:** 2.6.0 (Production Blueprint — Multi-Role RBAC, Inklusivitas Disabilitas, Live Monitor Ketat, Pop-Up Pemetaan Wizard, Hapus Nilai Terarsip, Sub-Menu Reset, & Native Excel Dropdowns)  
**Tanggal:** 28 November 2026  
**Status:** Implemented, Verified & Production Ready (`origin/main`)  

---

## 1. Ringkasan Eksekutif

**ExamPro PAI** adalah aplikasi ujian berbasis komputer (*Computer-Based Test / CBT*) modern yang dirancang untuk pelaksanaan asesmen Pretest, Postest, dan Evaluasi Pelatihan Guru PAI secara aman, inklusif bagi penyandang disabilitas, terukur, serta bebas biaya sewa infrastruktur (*zero hosting cost*).

Arsitektur **Jamstack & Serverless**:
* **Frontend:** React.js 18 (Vite 6 SPA, strictly `.jsx`), Tailwind CSS, Framer Motion, SheetJS (`xlsx`), dan generator OOXML `<dataValidations>` native (`xlsxDataValidation.js`), dihosting di **Cloudflare Pages** terhubung ke **GitHub**.
* **Backend API:** **Google Apps Script (GAS)** Web App (`gas/Code.gs`) dengan RAM `CacheService` dan `LockService` anti-*race condition*.
* **Database:** **Google Sheets** 5-tabel master (`Sessions`, `Questions`, `Participants`, `Submissions`, `Admins`) + sheet arsip otomatis `Archive_Submissions`.
* **Media Storage:** **Google Drive** sebagai penyimpanan gambar soal/opsi dengan direct CDN link.

---

## 2. Tujuan & Prinsip Desain Sistem

1. **Zero Infrastructure Cost & Reliabilitas Tinggi:** Berjalan penuh di Cloudflare Pages + Google Workspace dengan SWR client-side cache, auto-save `localStorage` per peserta & sesi, server-anchored timer (`start_time` + batas `end_at`), dan fallback mode lokal saat URL GAS belum diisi.
2. **Keamanan & Integritas Evaluasi:**
   * Kunci jawaban disimpan 100% di sisi server (*server-side scoring* + sensor kunci pada payload `getExamQuestions`).
   * **Token Berputar 1 Menit** (*time-windowed rotating token*) dengan *grace period* 60 detik dan dukungan token master sesi; token peserta otomatis dihapus dari database (`token_used = ''`) setelah submit agar tidak dapat dipakai ulang.
   * **Submit Terkunci Saat Belum Lengkap:** Peserta **wajib menjawab seluruh butir soal** untuk mengaktifkan tombol kirim ujian (pengecualian otomatis tetap berlaku saat waktu habis atau instruksi *Kumpulkan Paksa* / *Akhiri Sesi* pengawas).
   * **Anti-Kecurangan Adaptif:** Deteksi pindah tab (`visibilitychange`), window blur, fullscreen prompt, blokir klik kanan dan pintasan DevTools aktif penuh untuk peserta **Non-Disabilitas**, namun **otomatis dimatikan** bagi peserta **Penyandang Disabilitas** agar tidak mengganggu alat bantu aksesibilitas.
3. **Inklusivitas Penyandang Disabilitas (WCAG 2.2 AA & UU No. 8 Tahun 2016):**
   * Klasifikasi 7 kategori kondisi peserta sejak pendaftaran/import Excel hingga pemetaan & ruang ujian, dengan penyesuaian Pembaca Suara TTS (`id-ID`), tema kontras tinggi, spasi disleksia, tombol besar, navigasi keyboard, mode Fokus Tenang, dan ekstra waktu otomatis.
4. **Kemudahan Operator via Excel Dropdown & Manajemen Siklus Data:**
   * Seluruh template Excel Bank Soal dan Data Peserta tertanam dropdown asli Excel (*OOXML Data Validation*).
   * Alur pengaturan 3-langkah sistematis (*1. Data Mata Ujian → 2. Data Bank Soal → 3. Atur Ujian & Pemetaan Pop-Up Wizard*), kontrol **Akhiri Sesi** langsung, penghapusan nilai individu/massal dengan dialog unduh Excel & PDF sebelumnya, serta **Sub-Menu Reset Data** berproteksi konfirmasi.

---

## 3. Target Pengguna & Hak Akses (RBAC)

1. **Super Admin (`superadmin`):**
   * Akses penuh seluruh modul: Dashboard & Sesi, Live Monitor Ujian, Pengaturan Ujian & Soal (3 Langkah), Data Peserta & Excel, Rekap Nilai & Essay, **Cadangan & Pemulihan**, **Sub-Menu Reset Data** (*Reset Semua, Reset Soal, Reset Peserta, Reset Sesi*), dan **Kelola Admin & Role**.
2. **Pengajar / Dosen (`instructor`):**
   * Mengelola Dashboard & Sesi, Live Monitor Ujian, Pengaturan Ujian & Soal (Mata Ujian, Bank Soal, Pemetaan), Data Peserta & Excel, serta Rekap Nilai, Essay, dan Hapus Nilai terarsip.
3. **Pengawas Ujian (`proctor`):**
   * Mengakses Dashboard & Sesi, Live Monitor Ujian Real-Time (*Tegur Layar*, *Kumpulkan Paksa*), dan melihat Data Peserta & Excel.
4. **Peserta Ujian (`participant`):**
   * Autentikasi 2-Tahap: (1) Login Username & Password pada laman awal yang bersih, (2) Konfirmasi data profil, status akomodasi disabilitas, serta input token ujian.

---

## 4. Arsitektur Sistem & Spesifikasi Deployment

```text
+-------------------------------------------------------------------------+
|                              GITHUB REPO                                |
|       (Branch: main, Cloudflare Pages Auto-Build & Deploy Hook)         |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                        CLOUDFLARE PAGES (FRONTEND)                      |
|  - React 18 + Vite 6 SPA (Strict .jsx, No TypeScript)                   |
|  - public/_redirects (/* /index.html 200)                               |
|  - public/_headers (No-Cache HTML agar update langsung aktif di klien)  |
|  - Native OOXML Data Validation Generator + SheetJS Parser              |
+------------------------------------+------------------------------------+
                                     | HTTP GET / POST JSON (No Preflight)
                                     v
+-------------------------------------------------------------------------+
|                    GOOGLE APPS SCRIPT (gas/Code.gs)                     |
|  - doGet & doPost REST Endpoints + Secret Verification                  |
|  - RAM CacheService (Sesi versi dinamis, Soal Master, Proctor Live)     |
|  - LockService Transaction Queue (Submit, Akhiri Sesi, Deduplikasi)     |
+-------------------+--------------------------------+--------------------+
                    |                                |
                    v                                v
+------------------------------------+ +----------------------------------+
|      GOOGLE SHEETS (DATABASE)      | |   GOOGLE DRIVE (MEDIA STORAGE)   |
| 1. Sessions                        | | - Folder ExamPro_Assets_PAI      |
| 2. Questions                       | | - Access: Anyone with Link       |
| 3. Participants (15 Kolom)         | | - Direct CDN URL (lh3 format)    |
| 4. Submissions (+Archive_Submis.)  | +----------------------------------+
| 5. Admins                          |
+------------------------------------+
```

---

## 5. Skema Database (Google Sheets — 5 Master Sheets)

### 1. Sheet `Sessions` (12 Kolom)
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `session_id` | String | ID unik sesi (`SES-001`, `SES-...`) |
| `title` | String | Judul mata ujian / kegiatan |
| `type` | String | `pretest`, `postest`, `ujian_harian`, `simulasi` |
| `token` | String | Token master statis (misal `PAI2026`) |
| `duration_minutes` | Number | Durasi standar dalam menit (default `60`) |
| `is_active` | Boolean | `TRUE` (`Dibuka`) / `FALSE` (`Ditutup`) |
| `shuffle_questions` | Boolean | Acak urutan nomor soal per peserta |
| `shuffle_options` | Boolean | Acak urutan opsi PG (tampilan label UI tetap A–E) |
| `show_score` | Boolean | Tampilkan skor langsung ke peserta setelah selesai (default `TRUE`) |
| `created_at` | String | ISO timestamp pembuatan |
| `start_at` | String | ISO timestamp jadwal buka ujian (opsional) |
| `end_at` | String | ISO timestamp jadwal tutup ujian (opsional) |

### 2. Sheet `Questions` (9 Kolom)
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `question_id` | String | ID unik soal (`Q-...`) |
| `session_id` | String | ID sesi default |
| `paket` | String | Nama paket soal (`Pretest`, `Postest`, `Paket A`, dll.) |
| `type` | String | `single_choice`, `multiple_choice`, atau `essay` |
| `question_text` | String | Teks pertanyaan |
| `image_url` | String | URL gambar ilustrasi soal (opsional) |
| `options_json` | String | JSON array `[{"id":"A","text":"...","image":""}, ...]` |
| `key_answer` | String | Kunci jawaban (`A`, `A,B,C`, atau rubrik essay) |
| `weight` | Number | Bobot poin per soal (misal `2`, skor PG = $\sum$ bobot benar) |

### 3. Sheet `Participants` (15 Kolom — Diperluas untuk Inklusivitas Disabilitas)
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `participant_id` | String | ID unik peserta (`P-...`) |
| `session_id` | String | Relasi sesi aktif yang dipetakan (kosong jika belum diplot/sesi ditutup) |
| `username` | String | Username login peserta |
| `password` | String | Password akun peserta (default `kemenag2026`) |
| `full_name` | String | Nama lengkap peserta |
| `gender` | String | `Laki-Laki`, `Perempuan`, atau `-` |
| `identifier` | String | Nomor Peserta / NIP / NIM |
| `kelas` | String | Kelas / rombel / kelompok |
| `institution` | String | Asal madrasah / sekolah / instansi |
| `paket` | String | Paket soal terpetakan (`-` jika belum diplot) |
| `token_used` | String | Token masuk aktif (otomatis dikosongkan setelah submit/akhiri sesi) |
| `start_time` | String | ISO timestamp mulai pengerjaan (menjaga timer anti-reset saat refresh) |
| `status` | String | `registered`, `in_progress`, `submitted`, atau `disqualified` |
| `disability_type` | String | Kode disabilitas: `none`, `tunanetra`, `low_vision`, `tunarungu`, `tunadaksa`, `disleksia`, `disabilitas_lainnya` |
| `disability_note` | String | Catatan kebutuhan khusus peserta (opsional) |

> **Catatan Upgrade Sheet Eksisting:** Jalankan tombol **"Cek & Perbaiki Database"** di Admin atau panggil endpoint `checkAndRepair` agar sheet `Participants` lama (13 kolom) otomatis memperbarui header menjadi 15 kolom tanpa menghapus data baris peserta yang sudah ada.

### 4. Sheet `Submissions` (9 Kolom + `Archive_Submissions`)
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `submission_id` | String | ID unik submisi (`SUB-...`) |
| `participant_id` | String | Relasi ke peserta |
| `session_id` | String | Relasi ke sesi |
| `answers_json` | String | JSON pasangan `{ question_id: answer }` sesuai ID template asli |
| `pg_score` | Number | Nilai PG (`Jumlah Bobot Jawaban Benar`) |
| `essay_score` | Number | Nilai manual essay |
| `total_score` | Number | `pg_score + essay_score` |
| `tab_switch_count` | Number | Total pelanggaran pindah tab (otomatis `0` untuk peserta disabilitas) |
| `submitted_at` | String | ISO timestamp pengumpulan |

### 5. Sheet `Admins` (7 Kolom)
`admin_id`, `username`, `password`, `name`, `role` (`superadmin` | `instructor` | `proctor`), `is_active`, `created_at`.

---

## 6. Matriks Akomodasi Peserta Disabilitas (`disabilityConfig.js`)

| Kategori (`disability_type`) | Aturan Anti-Cheat (Pindah Tab/Blur) | Penyesuaian UI/UX & Ekstra Waktu Otomatis |
| :--- | :--- | :--- |
| `none` (**Non-Disabilitas**) | **Aktif Penuh** (`ViolationModal` + catatan pelanggaran) | UI standar, durasi 100%, font `14px–28px` |
| `tunanetra` (**Tunanetra**) | **Dihilangkan** (`skipAntiCheat: true`) | Web Speech TTS (`id-ID`, `Alt+B`), ARIA `radiogroup`/`polite`, navigasi full-keyboard (`1–5`/`A–E`, `←`/`→`), font s.d. `36px`, **Ekstra Waktu +50%** |
| `low_vision` (**Low Vision**) | **Dihilangkan** | Font bawaan besar `22px` (s.d. `36px`), Tema Kontras AAA (Hitam–Kuning) & Mode Gelap, TTS, target klik besar, **Ekstra Waktu +25%** |
| `tunarungu` (**Tunarungu / Wicara**) | **Dihilangkan** | Peringatan & status waktu 100% visual kontras tanpa ketergantungan audio, durasi 100% |
| `tunadaksa` (**Tunadaksa / Motorik**) | **Dihilangkan** | Target klik opsi & tombol besar (`min-height: 68px`), pintasan keyboard cepat, **Ekstra Waktu +25%** |
| `disleksia` (**Disleksia / Fokus ADHD**) | **Dihilangkan** | Latar Warm Cream (`#FDFBF4`), jarak huruf/kata/baris lega (`line-height: 1.9`), Mode Fokus Tenang (sembunyikan kedipan timer & sidebar grid), TTS, **Ekstra Waktu +25%** |
| `disabilitas_lainnya` (**Lainnya**) | **Dihilangkan** | Membuka penuh panel kontrol aksesibilitas (TTS, tema kontras, spasi lega, tombol besar, Fokus Tenang), font s.d. `36px`, **Ekstra Waktu +25%** |

---

## 7. Spesifikasi Fungsional Modul Aktual

### A. Panel Admin
1. **Dashboard & Sesi (`DashboardPage.jsx`):**
   * Statistik ringkas (Sesi, Bank Soal, Peserta, Submisi), tombol **Segarkan**, **Cek & Perbaiki Database**, serta kartu sesi dengan tombol toggle **Dibuka / Ditutup** dan tombol **Akhiri Sesi**.
2. **Live Monitor Ujian Real-Time (`LiveMonitorPage.jsx`):**
   * **Terikat Status Sesi:** Jika sesi berstatus `Ditutup`/nonaktif, polling otomatis berhenti dan halaman menampilkan status **"Sesi Mati (Live Monitor Nonaktif)"**.
   * **Filter Ketat Peserta:** Hanya peserta yang **sudah dipetakan paket soal valid** (`paket ≠ '-'`) pada sesi tersebut yang muncul di monitor.
   * **Indikator Inklusif:** Peserta penyandang disabilitas menampilkan badge biru-indigo *Aksesibilitas (Peringatan tab/blur dimatikan)*; peserta non-disabilitas tetap dipantau pelanggarannya dengan alarm visual/audio + aksi *Tegur Layar* dan *Kumpulkan Paksa*.
3. **Pengaturan Ujian & Soal — Urutan 3 Langkah (`AdminLayout.jsx` & `ExamSubNav.jsx`):**
   * **1. Data Mata Ujian / Kegiatan (`/admin/sessions` — `SessionsPage.jsx`):** CRUD sesi, rentang jadwal (`start_at`–`end_at`), tombol status **Dibuka / Ditutup** (menutup sesi otomatis mengeluarkan peserta aktif & membersihkan plotting tanpa menghapus `Submissions`), serta tombol **Akhiri Sesi** (memfinalisasi jawaban sementara peserta yang sedang `in_progress` menjadi submisi permanen, menutup sesi, mengeluarkan peserta, & membersihkan plotting). Hapus sesi otomatis membackup & mengarsipkan nilai.
   * **2. Data Bank Soal & Paket (`/admin/questions` — `QuestionBankPage.jsx`):** CRUD soal, upload gambar ke Drive, import Excel 2D matrix per paket, hapus per paket berproteksi backup, serta download template Excel **berdropdown tertanam**.
   * **3. Atur Ujian & Pemetaan (`/admin/exam-setup` — `ExamSetupPage.jsx`):**
     * Diawali tampilan **Rangkuman Data Mata Ujian** (menampilkan judul, token, status, paket aktif, jumlah peserta terplot, jumlah peserta disabilitas, & submisi).
     * Klik rangkuman atau tombol **"Petakan Ujian Ini"** langsung membuka **Pop-Up Wizard 3 Langkah**:
       1. *Penentuan Paket Soal* (pilih paket beserta jumlah soal & bobotnya),
       2. *Penentuan Peserta* (mode **Pilih Kelas** atau **Pilih Per Orang** lengkap dengan badge disabilitas),
       3. *Konfirmasi & Tetapkan Final* (`Tetapkan Final & Simpan Pemetaan`).
     * Tabel hasil pemetaan di bawah rangkuman dilengkapi filter Kelas, Paket, **Kondisi Disabilitas**, serta tombol **Hapus Plotting**.
4. **Data Peserta & Excel (`ParticipantsPage.jsx`):**
   * CRUD peserta dengan field **Keterangan Disabilitas** + pratinjau penyesuaian & **Catatan Khusus**, filter kondisi disabilitas, modal **Panduan Disabilitas**, hapus ceklis & hapus semua berproteksi backup, serta Template/Backup Excel `.xlsx` dengan dropdown tertanam.
5. **Rekap Nilai & Penilaian Essay (`ResultsPage.jsx`):**
   * Skor PG = $\sum(\text{Benar} \times \text{Bobot})$.
   * Ekspor **Unduh PDF Lengkap (.pdf)** (multi-halaman seluruh peserta), **PDF Individual**, **Detail Review Visual & Input Skor Essay**, serta **Unduh Excel Massal (.xlsx)** sesuai urutan butir template asli.
   * **Hapus Nilai (Individu & Massal):** Tombol hapus per baris maupun massal (terceklis/semua tampil) membuka modal konfirmasi yang **langsung memunculkan tombol Unduh Excel (`.xlsx`) dan Unduh PDF (`.pdf`) khusus peserta/kelompok terkait sebelum dihapus**, beserta opsi auto-download Excel cadangan dan reset status peserta terkait bila tidak ada submisi tersisa.
6. **Cadangan & Pemulihan (`BackupRestorePage.jsx`):** Export Excel 5-sheet, Snapshot JSON, Restore (`append`/`overwrite`), dan Repair Database.
7. **Sub-Menu Reset Data (`ResetDataPage.jsx`, Super Admin Only):**
   * Sub-menu sidebar dengan 4 pilihan: **Reset Semua**, **Reset Soal (Hapus Soal Semua)**, **Reset Peserta (Hapus Peserta Semua)**, dan **Reset Sesi (Hapus Sesi Semua)** — setiap eksekusi dilengkapi tombol backup Excel cepat dan konfirmasi ketik kata kunci (`RESET SEMUA`, `HAPUS SOAL`, `HAPUS PESERTA`, `HAPUS SESI`), serta tetap mempertahankan sheet `Admins`.
8. **Kelola Admin & Role (`AdminUsersPage.jsx`):** CRUD akun & RBAC.

### B. Modul Peserta Ujian
1. **Login 2-Tahap (`TokenLoginPage.jsx`):** Tahap 1 input Username & Password bersih; Tahap 2 konfirmasi biodata, info status akomodasi disabilitas/anti-cheat, serta Token Berputar 1 Menit.
2. **Ruang Ujian (`ExamRoomPage.jsx`, `QuestionCard.jsx`, `OptionItem.jsx`, `NavGrid.jsx`, `ExamContext.jsx`):**
   * Pengambilan soal via `getExamQuestions` dilengkapi fallback `sessionId`, pencegahan infinite render/fetch loop via `useCallback` + guard ref, dan tampilan layar error dengan tombol *Muat Ulang Soal* bila gagal mengunduh.
   * Tombol **Up/Down Ukuran Font (`↓ A-` / `↑ A+`)** dengan ukuran teks identik antara teks soal, pilihan A–E, dan textarea essay.
   * **Penguncian Submit:** Tombol *Selesai & Kumpulkan* dan *Kumpulkan Ujian* dinonaktifkan selama masih ada soal belum terjawab (dengan tombol bantu daftar nomor kosong), serta validasi di `ExamContext.submitExam` (`allowIncomplete` hanya untuk waktu habis & paksa kumpul pengawas).
   * Bilah Aksesibilitas lengkap aktif otomatis khusus bagi penyandang disabilitas.
3. **Hasil Ujian (`ResultPage.jsx`):** Menampilkan skor PG langsung secara default (`show_score = true` kecuali dinonaktifkan admin).

---

## 8. Spesifikasi Dropdown Excel Native OOXML (`xlsxDataValidation.js` & `excelTemplate.js`)

| File Template / Ekspor | Sheet Pendukung | Kolom Terpasang Dropdown (`Baris 2..501+`) | Mode Validasi |
| :--- | :--- | :--- | :--- |
| **Bank Soal** (`Template_Bank_Soal_ExamPro_PAI.xlsx` & Backup Soal) | `Petunjuk_Pilihan` | `B` (`Paket`: Pretest, Postest, Paket A/B, paket eksisting)<br>`C` (`Jenis_Soal`: `single_choice`, `multiple_choice`, `essay`)<br>`K` (`Kunci_Jawaban`: `A`–`E`)<br>`L` (`Bobot`: `1,2,3,4,5,10,20,25`) | `B, K, L`: `warning` (boleh ketik manual)<br>`C`: `stop` (pilihan baku) |
| **Data Peserta** (`Template_Data_Peserta_PAI.xlsx` & Backup Peserta) | `Petunjuk_Pilihan` | `E` (`Jenis_Kelamin`: `Laki-Laki`, `Perempuan`, `-`)<br>`G` (`Kelas`: `Kelas A–D` + kelas eksisting)<br>`I` (`Keterangan_Disabilitas`: 7 kategori sistem) | `E, I`: `stop` (pilihan baku)<br>`G`: `warning` (boleh ketik baru) |

* Catatan teknis OOXML: `<dataValidations>` disisipkan sesuai urutan skema ECMA-376 sebelum `<pageMargins>` / `<ignoredErrors>` dan tanpa atribut `showDropDown="1"` agar panah dropdown selalu tampil di Excel. Parser `parseUploadedParticipantFile` tetap kompatibel terhadap Excel template lama tanpa kolom disabilitas.

---

## 9. Kontrak API Google Apps Script (`gas/Code.gs`)

### `GET` (`doGet`)
* `ping`, `setup` / `checkAndRepair` / `repairDatabase`
* `getSession` (`token`, `sessionSalt`)
* `getExamQuestions` (`token`, `participantId`, `paket`, `sessionId` fallback)
* `getAdminDashboard` (`secretKey`)
* `getAdminUsers` (`secretKey`)
* `getLiveProctor` (`secretKey`, `sessionId`)

### `POST` (`doPost`)
* Autentikasi: `adminLogin`, `participantLogin`
* Ujian Peserta: `startExam`, `submitExam`, `updateExamProgress`
* Pengawasan: `getLiveProctor`, `proctorAction` (`warn`, `force_submit`, `reset`)
* Sesi & Pemetaan: `saveSession`, `endSession` (*Akhiri Sesi* langsung), `deleteSession`
* Bank Soal: `saveQuestion`, `batchSaveQuestions`, `deleteQuestion`, `deleteQuestionsByPaket`
* Peserta: `saveParticipant`, `batchSaveParticipants`, `deleteParticipant`, `batchDeleteParticipants`, `deleteAllParticipants`
* Nilai & Media: `gradeEssay`, `deleteSubmissions` (*Hapus Nilai Individu/Massal*), `uploadMedia`
* Admin, Backup & Reset: `saveAdminUser`, `deleteAdminUser`, `checkAndRepair` / `repairDatabase`, `exportFullBackup`, `restoreFullBackup`, `resetSystemData` (`all`, `questions`, `participants`, `sessions`)

---

## 10. Struktur Proyek Aktual (`origin/main`)

```text
Aplikasi Pre Pos/
├── PRD.md                           # Dokumen Spesifikasi Produk v2.6.0
├── README.md
├── package.json                     # React 18.3, Vite 6.0, Tailwind 3.4, xlsx 0.18.5
├── vite.config.js                   # Port dev server 3000
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── .env.example
├── public/
│   ├── _headers                     # Cache-Control no-cache untuk / dan /index.html
│   ├── _redirects                   # SPA fallback (/* /index.html 200)
│   ├── Logo_Kemenag.png
│   ├── Logo_UIN.png
│   └── favicon.svg
├── gas/
│   ├── Code.gs                      # Backend Google Apps Script Lengkap (15-col Participants + End/Delete/Reset)
│   ├── SETUP_GUIDE.md
│   └── appsscript.json
└── src/
    ├── assets/
    ├── components/
    │   ├── exam/
    │   │   ├── NavGrid.jsx
    │   │   ├── OptionItem.jsx       # Opsi adaptif (Kontras AAA/Gelap/Cream, spasi disleksia, target klik besar)
    │   │   ├── QuestionCard.jsx     # Soal + font Up/Down seragam + kontrol TTS + ARIA
    │   │   ├── TimerDisplay.jsx
    │   │   └── ViolationModal.jsx
    │   ├── layout/
    │   │   ├── AdminLayout.jsx      # Sidebar 3-Langkah + Sub-Menu Reset Data
    │   │   ├── ExamSubNav.jsx       # Tab 1. Mata Ujian -> 2. Bank Soal -> 3. Atur Ujian & Pemetaan
    │   │   └── HeaderBar.jsx
    │   └── ui/
    │       ├── Button.jsx
    │       ├── Card.jsx
    │       ├── LoadingScreen.jsx
    │       └── Modal.jsx
    ├── context/
    │   ├── AuthContext.jsx          # Memoized participant & RBAC auth state
    │   └── ExamContext.jsx          # Soal, answers localStorage, submit lock, heartbeat, error handling
    ├── hooks/
    │   ├── useAntiCheat.js          # Tab/blur/fullscreen/shortcut safeguards (bypassed untuk disabilitas)
    │   └── useServerTimer.js        # Drift-free server timer + end_at schedule + extra disability time
    ├── pages/
    │   ├── admin/
    │   │   ├── AdminLoginPage.jsx
    │   │   ├── AdminUsersPage.jsx
    │   │   ├── BackupRestorePage.jsx
    │   │   ├── DashboardPage.jsx
    │   │   ├── ExamSetupPage.jsx    # Rangkuman Mata Ujian + Pop-Up Wizard 3 Langkah + Disabilitas
    │   │   ├── LiveMonitorPage.jsx  # Live Monitor mati saat sesi tutup + filter paket + lencana disabilitas
    │   │   ├── ParticipantsPage.jsx # Kelola Peserta + Disabilitas + Panduan + Excel Dropdown
    │   │   ├── QuestionBankPage.jsx # Bank Soal + Excel Dropdown
    │   │   ├── ResetDataPage.jsx    # Pusat Sub-Menu Reset (Semua, Soal, Peserta, Sesi)
    │   │   ├── ResultsPage.jsx      # Rekap Nilai, PDF Lengkap/Individu, Excel Massal, Hapus Nilai + Backup
    │   │   └── SessionsPage.jsx     # Data Mata Ujian (Dibuka/Ditutup & Akhiri Sesi)
    │   └── user/
    │       ├── ExamRoomPage.jsx     # Ruang ujian adaptif & penguncian submit
    │       ├── ResultPage.jsx
    │       └── TokenLoginPage.jsx   # Login tahap 1 bersih + Konfirmasi & Token 1-Menit tahap 2
    ├── services/
    │   └── gasApi.js                # GAS REST client + SWR cache + local mock DB
    ├── utils/
    │   ├── disabilityConfig.js      # Konfigurasi 7 kategori disabilitas & akomodasi
    │   ├── excelTemplate.js         # Parser & builder template/ekspor Excel dengan dropdown
    │   ├── rotatingToken.js         # Generator token berputar setiap 1 menit
    │   └── xlsxDataValidation.js    # Injector OOXML <dataValidations> ke arsip .xlsx
    ├── App.jsx
    ├── index.css
    └── main.jsx
```

---

## 11. Runbook Operasional & Replikasi untuk Aplikasi Berikutnya

Untuk menjalankan, mereplikasi, atau membangun aplikasi turunan dari blueprint PRD ini:

1. **Setup Backend Google Workspace:**
   * Buat Google Spreadsheet baru → **Extensions > Apps Script** → salin penuh [gas/Code.gs](file:///d:/UIN%20JAKARTA/FITK%20UIN%20JAKARTA/PELATIHAN%20TOT/Aplikasi%20Pre%20Pos/gas/Code.gs) → Deploy Web App (*Execute as: Me*, *Who has access: Anyone*).
   * Jika mengupgrade dari versi lama, selalu deploy **New Version** lalu jalankan **"Cek & Perbaiki Database"** di Dashboard Admin agar sheet `Participants` bertambah ke 15 kolom secara aman.
2. **Konfigurasi Environment & Build Frontend:**
   * Set environment variable `VITE_GAS_API_URL` ke URL `/exec` GAS di Cloudflare Pages atau `.env` lokal.
   * Perintah lokal:
     * Dev preview: `npm run dev` (berjalan di `http://localhost:3000`)
     * Verifikasi build produksi: `npm run build` (harus menghasilkan `dist/` dengan exit code `0`, strict `.jsx` tanpa TypeScript).
3. **Checklist Verifikasi Sebelum Rilis/Pelatihan:**
   * Pastikan setiap butir baru tetap mempertahankan aturan `Submissions` (**Skor PG = Benar × Bobot**), penguncian kirim sebelum semua terjawab, aturan anti-cheat khusus non-disabilitas, penutupan sesi bersih (`Ditutup` / `Akhiri Sesi`), serta validasi `<dataValidations>` Excel template (`npm run build` exit 0).

---
*Dokumen PRD v2.6.0 diselaraskan penuh dengan source code aktual ExamPro PAI (`origin/main`).*
