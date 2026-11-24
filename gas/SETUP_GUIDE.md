# Panduan Setup Backend: Google Apps Script & Google Sheets

Backend ExamPro menggunakan Google Apps Script (GAS) yang terhubung langsung ke Google Sheets (sebagai database) dan Google Drive (sebagai media storage).

---

## Langkah 1: Buat Google Spreadsheet Baru
1. Buka [Google Sheets](https://sheets.new) di browser Anda.
2. Beri nama spreadsheet, contohnya: **Database ExamPro CBT**.

---

## Langkah 2: Buka Apps Script Editor
1. Di dalam Google Sheets, klik menu **Extensions (Ekstensi)** > **Apps Script**.
2. Beri nama proyek Apps Script, misalnya: **ExamPro Backend API**.
3. Hapus seluruh kode bawaan di file `Code.gs`.
4. Salin (*copy*) seluruh isi file [`gas/Code.gs`](./Code.gs) dan tempel (*paste*) ke editor Apps Script.

---

## Langkah 3: Konfigurasi Script Properties (Otentikasi & Keamanan)
1. Di bilah menu sebelah kiri Apps Script, klik ikon **Project Settings (Ikon Gerigi ⚙️)**.
2. Gulir ke bawah hingga bagian **Script Properties (Properti Skrip)**.
3. Klik **Add script property (Tambahkan properti skrip)**:
   * **Property:** `ADMIN_SECRET_KEY`
   * **Value:** Isi dengan PIN atau sandi rahasia admin Anda (misalnya: `AdminTot2026!`).
4. Klik **Save script properties**.

---

## Langkah 4: Inisialisasi Database (Setup 5 Sheet)
1. Kembali ke editor kode (`Code.gs`).
2. Di dropdown fungsi bagian atas (di samping tombol *Debug*), pilih fungsi **`setupDatabaseSheets`**.
3. Klik tombol **Run (Jalankan)**.
4. Google akan meminta izin otorisasi (*Review Permissions*):
   * Pilih akun Google Anda.
   * Klik **Advanced (Lanjutan)** > **Go to ExamPro Backend API (unsafe)**.
   * Klik **Allow (Izinkan)**.
5. Setelah selesai dijalankan, buka kembali tab Google Sheets Anda. Anda akan melihat 5 sheet telah otomatis dibuat dengan header yang rapi:
   - `Sessions`
   - `Questions`
   - `Participants`
   - `Submissions`
   - `Admins` (Untuk manajemen akun Super Admin, Pengajar, dan Pengawas)

---

## Langkah 5: Deploy sebagai Web App (PENTING!)
1. Di pojok kanan atas Apps Script, klik tombol biru **Deploy** > **New deployment**.
2. Klik ikon gerigi ⚙️ di sebelah *Select type*, lalu pilih **Web app**.
3. Isi konfigurasi berikut:
   * **Description:** `ExamPro API v2.5 with RBAC Admins`
   * **Execute as:** `Me (email-anda@gmail.com)` *(Wajib pilih ini)*
   * **Who has access:** `Anyone` *(Wajib pilih ini agar peserta & web app bisa akses tanpa login Google)*
4. Klik **Deploy**.
5. Salin **Web app URL** yang berakhiran `/exec` (misal: `https://script.google.com/macros/s/AKfycbx.../exec`).
6. Simpan URL ini, karena akan dimasukkan ke variabel environment frontend (`VITE_GAS_API_URL`).

---

## Cara Memperbarui Kode (Jika Sebelumnya Sudah Deploy)
Jika Anda sebelumnya sudah pernah men-deploy Google Apps Script dan ingin memperbarui dengan fitur terbaru (Role Admin & Sheet `Admins`):
1. Buka Apps Script Anda di Google Sheets (**Extensions > Apps Script**).
2. Ganti seluruh isi `Code.gs` dengan kode terbaru dari file `gas/Code.gs`.
3. Jalankan fungsi **`initializeDefaultAdmins`** atau **`setupDatabaseSheets`** (pilih di dropdown fungsi lalu klik **Run**) agar sheet `Admins` otomatis terbuat beserta 3 akun default.
4. Klik tombol **Deploy** di pojok kanan atas > pilih **Manage deployments**.
5. Klik ikon **Edit (pensil ✏️)** pada deployment Web App yang aktif.
6. Pada bagian *Version*, ubah menjadi **New version** (Versi baru).
7. Klik **Deploy** dan klik **Done**. URL Web App Anda tetap sama dan tidak perlu diubah di frontend!

---

## Pengujian Koneksi (Health Check)
Untuk memastikan backend sudah aktif, buka Web App URL Anda di tab browser baru dengan menambahkan parameter `?action=ping`:
```
https://script.google.com/macros/s/AKfycbx.../exec?action=ping
```
Jika berhasil, Anda akan menerima respon JSON:
```json
{
  "status": "success",
  "message": "ExamPro API is Active and Running"
}
```
