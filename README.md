# ExamPro CBT - Sistem Manajemen Ujian Online (Pretest & Postest)

Aplikasi web Computer-Based Test (CBT) modern berbasis **Jamstack & Serverless** dengan biaya infrastruktur nol (**100% Free Tier**).

---

## Arsitektur Teknologi

* **Frontend:** React.js (Vite, JSX), Tailwind CSS, Framer Motion, Lucide React.
* **Hosting Frontend:** **Cloudflare Pages** (Auto CI/CD via GitHub).
* **Backend API:** **Google Apps Script (GAS)** Web App Serverless.
* **Database:** **Google Sheets** (Relational-like spreadsheet data).
* **Media Storage:** **Google Drive** (Penyimpanan aset gambar soal dengan tautan CDN langsung).

---

## Panduan Langkah Demi Langkah Deployment

### 1. Setup Backend Google Workspace (Sheets, GAS, Drive)
1. Buka spreadsheet baru di [Google Sheets](https://sheets.new).
2. Klik menu **Extensions (Ekstensi)** > **Apps Script**.
3. Salin seluruh kode dari file [`gas/Code.gs`](./gas/Code.gs) dan gantikan isi editor Apps Script.
4. Di bagian **Project Settings (Ikon ⚙️)** > **Script Properties**, tambahkan:
   * `ADMIN_SECRET_KEY` : (Contoh: `admin123` atau kata sandi pilihan Anda).
5. Kembali ke editor kode, pilih fungsi **`setupDatabaseSheets`** pada dropdown fungsi lalu klik **Run (Jalankan)** untuk menginisialisasi 4 sheet otomatis (`Sessions`, `Questions`, `Participants`, `Submissions`).
6. Klik tombol **Deploy** > **New deployment**:
   * Pilih tipe **Web app**.
   * *Execute as:* **Me**
   * *Who has access:* **Anyone**
7. Klik **Deploy** dan salin **Web app URL** yang berakhiran `/exec`.

*(Panduan lebih lengkap dapat dibaca di [`gas/SETUP_GUIDE.md`](./gas/SETUP_GUIDE.md))*.

---

### 2. Pengaturan Repositori GitHub
1. Inisialisasi Git di folder proyek ini:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit ExamPro CBT v2"
   ```
2. Buat repositori baru di akun [GitHub](https://github.com/new) Anda (misalnya `exampro-cbt`).
3. Hubungkan dan push kode ke GitHub:
   ```bash
   git remote add origin https://github.com/USERNAME/exampro-cbt.git
   git branch -M main
   git push -u origin main
   ```

---

### 3. Deployment ke Cloudflare Pages
1. Masuk ke dashboard [Cloudflare](https://dash.cloudflare.com/).
2. Di bilah samping, buka **Workers & Pages** > **Create Application** > tab **Pages**.
3. Pilih **Connect to Git** dan hubungkan akun GitHub Anda.
4. Pilih repositori `exampro-cbt` yang baru saja Anda buat.
5. Pada bagian **Build Settings**:
   * **Framework preset:** `Vite`
   * **Build command:** `npm run build`
   * **Build output directory:** `dist`
6. Pada bagian **Environment variables (advanced)**, tambahkan variabel:
   * **Variable name:** `VITE_GAS_API_URL`
   * **Value:** *(Tempelkan URL Web App Google Apps Script dari Langkah 1)*
7. Klik **Save and Deploy**.
8. Cloudflare Pages akan memproses build dan memberikan tautan domain gratis berakhiran `.pages.dev`.

---

## Menjalankan di Komputer Lokal (Development)

Jika Anda ingin menjalankan atau menguji aplikasi secara lokal:

```bash
# 1. Install dependencies
npm install

# 2. Salin variabel environment (Opsional jika ingin langsung terhubung ke GAS)
cp .env.example .env
# Edit .env dan isi VITE_GAS_API_URL

# 3. Jalankan server lokal
npm run dev
```

> **Fitur Demo Mandiri (Offline Mock):** Jika `VITE_GAS_API_URL` belum diisi, aplikasi secara cerdas akan beralih ke mode **Mock Storage Lokal**. Anda dapat langsung menguji login dengan Token Demo: **`TOT2026`** dan PIN Admin: **`admin123`**!
