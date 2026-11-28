/**
 * Konfigurasi Kategori Penyandang Disabilitas & Penyesuaian Aksesibilitas Ujian (WCAG 2.2 AA & UU No. 8 Tahun 2016)
 * - Peserta Non-Disabilitas: Pengawasan anti-kecurangan (deteksi pindah tab/blur) AKTIF penuh.
 * - Peserta Penyandang Disabilitas: Deteksi & peringatan pindah tab/blur DINONAKTIFKAN agar tidak menghambat alat bantu
 *   (screen reader, magnifier, switch control, OS keyboard, transkrip, dsb.) serta mengaktifkan UI/UX adaptif.
 */

export const DISABILITY_CATEGORIES = [
  {
    key: 'none',
    label: 'Non-Disabilitas',
    shortLabel: 'Non-Disabilitas',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    skipAntiCheat: false,
    timeMultiplier: 1.0,
    extraTimeLabel: 'Waktu Standar (100%)',
    defaultFontSizePx: 16,
    maxFontSizePx: 28,
    defaults: {
      ttsEnabled: false,
      themeMode: 'normal', // 'normal' | 'high_contrast' | 'dark' | 'dyslexia_cream'
      dyslexiaSpacing: false,
      largeHitTargets: false,
      calmFocus: false,
      visualAlertsOnly: false,
      keyboardShortcuts: false
    },
    needsSummary: 'Peserta umum tanpa hambatan khusus. Sistem ujian berjalan standar dengan pengawasan anti-kecurangan.',
    accommodations: [
      'Deteksi & peringatan pindah tab / keluar layar (Anti-Cheat) AKTIF',
      'Waktu pengerjaan standar sesuai durasi sesi',
      'Pengaturan ukuran teks standar (14px–28px)'
    ]
  },
  {
    key: 'tunanetra',
    label: 'Tunanetra (Hambatan Penglihatan Total)',
    shortLabel: 'Tunanetra',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    skipAntiCheat: true,
    timeMultiplier: 1.5,
    extraTimeLabel: 'Ekstra Waktu +50%',
    defaultFontSizePx: 18,
    maxFontSizePx: 36,
    defaults: {
      ttsEnabled: true,
      themeMode: 'high_contrast',
      dyslexiaSpacing: false,
      largeHitTargets: true,
      calmFocus: true,
      visualAlertsOnly: false,
      keyboardShortcuts: true
    },
    needsSummary: 'Menggunakan screen reader (NVDA/JAWS/TalkBack/VoiceOver), membutuhkan pembaca suara soal & navigasi penuh keyboard.',
    accommodations: [
      'Peringatan pelanggaran tab/blur DIHILANGKAN (aman untuk screen reader)',
      'Pembaca Suara Soal & Opsi otomatis Bahasa Indonesia (Text-to-Speech, Alt+B)',
      'Navigasi keyboard penuh (Tab, Panah Kiri/Kanan, angka 1–5 untuk pilih jawaban A–E)',
      'Semantic ARIA Live Region & Ekstra Waktu pengerjaan +50%'
    ]
  },
  {
    key: 'low_vision',
    label: 'Low Vision (Penglihatan Terbatas)',
    shortLabel: 'Low Vision',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-300',
    skipAntiCheat: true,
    timeMultiplier: 1.25,
    extraTimeLabel: 'Ekstra Waktu +25%',
    defaultFontSizePx: 22,
    maxFontSizePx: 36,
    defaults: {
      ttsEnabled: true,
      themeMode: 'high_contrast',
      dyslexiaSpacing: true,
      largeHitTargets: true,
      calmFocus: false,
      visualAlertsOnly: false,
      keyboardShortcuts: true
    },
    needsSummary: 'Kesulitan membaca teks kecil atau kontras rendah; sering memakai Windows Magnifier / zoom layar.',
    accommodations: [
      'Peringatan pelanggaran tab/blur DIHILANGKAN (aman untuk zoom/magnifier OS)',
      'Ukuran teks otomatis besar (default 22px, dapat diperbesar hingga 36px)',
      'Pilihan Tema Kontras Tinggi Hitam–Kuning (WCAG AAA) & Mode Gelap',
      'Opsi Pembaca Suara (TTS) & Ekstra Waktu +25%'
    ]
  },
  {
    key: 'tunarungu',
    label: 'Tunarungu / Hambatan Pendengaran & Wicara',
    shortLabel: 'Tunarungu',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    skipAntiCheat: true,
    timeMultiplier: 1.0,
    extraTimeLabel: 'Waktu Standar (100%)',
    defaultFontSizePx: 18,
    maxFontSizePx: 32,
    defaults: {
      ttsEnabled: false,
      themeMode: 'normal',
      dyslexiaSpacing: false,
      largeHitTargets: false,
      calmFocus: false,
      visualAlertsOnly: true,
      keyboardShortcuts: true
    },
    needsSummary: 'Tidak menangkap isyarat suara/alarm audio; membutuhkan petunjuk & notifikasi 100% visual yang jelas.',
    accommodations: [
      'Peringatan pelanggaran tab/blur DIHILANGKAN (aman untuk alat bantu/transkrip)',
      'Seluruh notifikasi waktu & instruksi ujian 100% visual kontras (tanpa mengandalkan audio)',
      'Instruksi soal lugas dengan badge visual jelas pada setiap tipe soal'
    ]
  },
  {
    key: 'tunadaksa',
    label: 'Tunadaksa / Hambatan Motorik Halus',
    shortLabel: 'Tunadaksa / Motorik',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
    skipAntiCheat: true,
    timeMultiplier: 1.25,
    extraTimeLabel: 'Ekstra Waktu +25%',
    defaultFontSizePx: 18,
    maxFontSizePx: 32,
    defaults: {
      ttsEnabled: false,
      themeMode: 'normal',
      dyslexiaSpacing: false,
      largeHitTargets: true,
      calmFocus: false,
      visualAlertsOnly: false,
      keyboardShortcuts: true
    },
    needsSummary: 'Kesulitan mengarahkan kursor mouse pada tombol kecil, tremor tangan, atau memakai keyboard bantu / dikte.',
    accommodations: [
      'Peringatan pelanggaran tab/blur DIHILANGKAN (aman untuk on-screen keyboard/switch)',
      'Target klik besar & jarak spasi lebar pada pilihan A–E dan tombol navigasi',
      'Pintasan keyboard cepat (tombol 1–5 / A–E pilih jawaban, ← / → pindah soal)',
      'Ekstra Waktu pengerjaan +25%'
    ]
  },
  {
    key: 'disleksia',
    label: 'Disleksia / Hambatan Kognitif & Fokus (ADHD/Autisme)',
    shortLabel: 'Disleksia / Fokus',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    skipAntiCheat: true,
    timeMultiplier: 1.25,
    extraTimeLabel: 'Ekstra Waktu +25%',
    defaultFontSizePx: 18,
    maxFontSizePx: 32,
    defaults: {
      ttsEnabled: true,
      themeMode: 'dyslexia_cream',
      dyslexiaSpacing: true,
      largeHitTargets: true,
      calmFocus: true,
      visualAlertsOnly: false,
      keyboardShortcuts: true
    },
    needsSummary: 'Sensitif terhadap silau putih murni, huruf rapat, animasi berkedip, atau stres akibat tampilan waktu/grid ramai.',
    accommodations: [
      'Peringatan pelanggaran tab/blur DIHILANGKAN',
      'Latar Warm Cream anti-silau + spasi huruf, kata, dan baris lebih renggang',
      'Mode Fokus Tenang: nonaktifkan efek animasi & opsi sembunyikan grid/timer berjalan',
      'Dukungan Pembaca Suara (TTS) & Ekstra Waktu +25%'
    ]
  },
  {
    key: 'disabilitas_lainnya',
    label: 'Disabilitas Lainnya / Kondisi Khusus',
    shortLabel: 'Disabilitas Lainnya',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    skipAntiCheat: true,
    timeMultiplier: 1.25,
    extraTimeLabel: 'Ekstra Waktu +25%',
    defaultFontSizePx: 18,
    maxFontSizePx: 36,
    defaults: {
      ttsEnabled: true,
      themeMode: 'normal',
      dyslexiaSpacing: false,
      largeHitTargets: true,
      calmFocus: false,
      visualAlertsOnly: true,
      keyboardShortcuts: true
    },
    needsSummary: 'Disabilitas ganda, kondisi kronis, atau kebutuhan khusus lain dengan kontrol aksesibilitas lengkap.',
    accommodations: [
      'Peringatan pelanggaran tab/blur DIHILANGKAN',
      'Panel Aksesibilitas Lengkap dapat dinyalakan/dimatikan bebas oleh peserta',
      'Ekstra Waktu +25% & ukuran teks hingga 36px'
    ]
  }
];

/**
 * Normalisasi input string (dari Excel / API / Form) ke key kategori standar
 */
export const normalizeDisabilityType = (raw) => {
  const val = String(raw || '').trim().toLowerCase();
  if (!val || val === '-' || val === 'none' || val === 'tidak' || val === 'umum' || val.includes('non-disabilitas') || val.includes('nondisabilitas')) {
    return 'none';
  }
  if (val.includes('tunanetra') || val.includes('netra total') || val.includes('buta') || val.includes('screen reader')) {
    return 'tunanetra';
  }
  if (val.includes('low') || val.includes('rabun') || val.includes('terbatas')) {
    return 'low_vision';
  }
  if (val.includes('rungu') || val.includes('tuli') || val.includes('pendengaran') || val.includes('wicara')) {
    return 'tunarungu';
  }
  if (val.includes('daksa') || val.includes('motorik') || val.includes('fisik')) {
    return 'tunadaksa';
  }
  if (val.includes('disleksia') || val.includes('adhd') || val.includes('autis') || val.includes('kognitif') || val.includes('fokus') || val.includes('belajar')) {
    return 'disleksia';
  }
  if (val.includes('disabilitas') || val.includes('khusus') || val.includes('lain') || val === 'ya') {
    return 'disabilitas_lainnya';
  }
  return 'disabilitas_lainnya';
};

export const getDisabilityMeta = (rawType) => {
  const key = normalizeDisabilityType(rawType);
  return DISABILITY_CATEGORIES.find(c => c.key === key) || DISABILITY_CATEGORIES[0];
};

export const isDisabilityParticipant = (participant) => {
  if (!participant) return false;
  return normalizeDisabilityType(participant.disability_type) !== 'none';
};
