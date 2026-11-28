/**
 * Utilitas Generator Template Excel (.xlsx) dan Parser Bank Soal & Data Peserta
 * Menggunakan library SheetJS (XLSX) untuk menghasilkan file Microsoft Excel (.xlsx) asli.
 */
import * as XLSX from 'xlsx';
import { DISABILITY_CATEGORIES, normalizeDisabilityType, getDisabilityMeta } from './disabilityConfig.js';
import { downloadWorkbookWithValidations } from './xlsxDataValidation.js';

const safeTemplateOptions = (arg) => {
  if (!arg || typeof arg !== 'object' || arg.nativeEvent || arg.target) {
    return {};
  }
  return arg;
};

const uniqueCleanList = (items = []) => {
  const seen = new Set();
  const out = [];
  items.forEach((item) => {
    const clean = String(item || '').trim().replace(/,/g, ' ');
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      out.push(clean);
    }
  });
  return out;
};

const buildListValidationConfig = ({ sqref, values, refColLetter, refSheetName = 'Petunjuk_Pilihan', errorStyle = 'warning', promptTitle = '', prompt = '', errorTitle = '', error = '' }) => {
  const cleanVals = uniqueCleanList(values);
  const inlineStr = cleanVals.join(',');
  const base = {
    sqref,
    errorStyle,
    allowBlank: true,
    promptTitle,
    prompt,
    errorTitle,
    error
  };
  if (inlineStr.length <= 220) {
    return { ...base, options: cleanVals };
  }
  return {
    ...base,
    formulaRef: `${refSheetName}!$${refColLetter}$2:$${refColLetter}$${cleanVals.length + 1}`
  };
};

// ==========================================
// 1. BANK SOAL TEMPLATE (.xlsx)
// ==========================================

export const QUESTION_HEADERS = [
  'No',
  'Paket',
  'Jenis_Soal',
  'Teks_Soal',
  'Gambar_URL',
  'Opsi_A',
  'Opsi_B',
  'Opsi_C',
  'Opsi_D',
  'Opsi_E',
  'Kunci_Jawaban',
  'Bobot'
];

export const SAMPLE_QUESTIONS = [
  [
    1,
    'Pretest',
    'single_choice',
    'Apa kepanjangan dari CBT dalam sistem asesmen pendidikan modern pada lingkungan madrasah/sekolah?',
    '',
    'Computer-Based Test',
    'Core Basic Technology',
    'Cloud-Based Tracking',
    'Central Binary Task',
    'Computer-Based Teaching',
    'A',
    1
  ],
  [
    2,
    'Pretest',
    'single_choice',
    'Kurikulum Merdeka pada mata pelajaran PAI menekankan pada penguatan karakter melalui profil apa?',
    '',
    'Profil Pelajar Pancasila dan Rahmatan Lil Alamin',
    'Profil Generasi Emas Digital',
    'Profil Santri Berkualitas Global',
    'Profil Guru Profesional Masa Depan',
    'Profil Cendekiawan Muslim Berkemajuan',
    'A',
    1
  ],
  [
    3,
    'Postest',
    'multiple_choice',
    'Manakah dari komponen berikut yang termasuk dalam pilar arsitektur Serverless Google Workspace yang digunakan ExamPro? (Pilihan Jamak)',
    '',
    'Google Apps Script (GAS)',
    'Google Sheets (Relational Spreadsheet)',
    'Google Drive (Cloud Asset Storage)',
    'Kubernetes Cluster On-Premise',
    'Local Virtual Machine Server',
    'A,B,C',
    2
  ],
  [
    4,
    'Postest',
    'essay',
    'Jelaskan bagaimana pendekatan pembelajaran berbasis STREAM dan AI dapat diintegrasikan dalam materi Fikih / Akidah Akhlak!',
    '',
    '',
    '',
    '',
    '',
    '',
    'Rubrik: Relevansi pedagogis, pemanfaatan alat digital etis, dan penguatan nilai-nilai Islam.',
    3
  ]
];

/**
 * Bangun Workbook Bank Soal + Data Validation Dropdown Tertanam
 */
export const createQuestionBankWorkbookPayload = (rowsData, options = {}) => {
  const { sheetName = 'Bank_Soal_PAI', packages = [] } = safeTemplateOptions(options);
  const wb = XLSX.utils.book_new();
  const wsData = [QUESTION_HEADERS, ...rowsData];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 16 }, // Paket
    { wch: 18 }, // Jenis_Soal
    { wch: 45 }, // Teks_Soal
    { wch: 25 }, // Gambar_URL
    { wch: 30 }, // Opsi_A
    { wch: 30 }, // Opsi_B
    { wch: 30 }, // Opsi_C
    { wch: 30 }, // Opsi_D
    { wch: 30 }, // Opsi_E
    { wch: 16 }, // Kunci_Jawaban
    { wch: 10 }  // Bobot
  ];

  const paketList = uniqueCleanList(['Pretest', 'Postest', 'Paket A', 'Paket B', ...packages]);
  const jenisList = ['single_choice', 'multiple_choice', 'essay'];
  const kunciList = ['A', 'B', 'C', 'D', 'E'];
  const bobotList = ['1', '2', '3', '4', '5', '10', '20', '25'];

  // Sheet Petunjuk & Daftar Referensi Pilihan
  const maxRefRows = Math.max(paketList.length, jenisList.length, kunciList.length, bobotList.length);
  const refRows = [['Daftar_Paket', 'Jenis_Soal', 'Kunci_Jawaban_PG', 'Bobot_Standar', 'Keterangan_Pengisian']];
  for (let i = 0; i < maxRefRows; i++) {
    refRows.push([
      paketList[i] || '',
      jenisList[i] || '',
      kunciList[i] || '',
      bobotList[i] || '',
      i === 0
        ? 'Kolom B, C, K, dan L pada sheet utama sudah dilengkapi dropdown pilihan (baris 2 s.d. 501).'
        : i === 1
          ? 'Untuk multiple_choice, isi Kunci_Jawaban misal A,B,C; untuk essay isi rubrik singkat.'
          : ''
    ]);
  }
  const refWs = XLSX.utils.aoa_to_sheet(refRows);
  refWs['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 60 }];

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.utils.book_append_sheet(wb, refWs, 'Petunjuk_Pilihan');

  const maxRow = Math.max(501, rowsData.length + 100);
  const validationsBySheet = {
    'xl/worksheets/sheet1.xml': [
      buildListValidationConfig({
        sqref: `B2:B${maxRow}`,
        values: paketList,
        refColLetter: 'A',
        errorStyle: 'warning',
        promptTitle: 'Pilih / Ketik Paket Soal',
        prompt: 'Pilih nama paket dari dropdown (atau ketik nama paket baru).'
      }),
      buildListValidationConfig({
        sqref: `C2:C${maxRow}`,
        values: jenisList,
        refColLetter: 'B',
        errorStyle: 'stop',
        promptTitle: 'Pilih Jenis Soal',
        prompt: 'Pilih: single_choice (PG Tunggal), multiple_choice (PG Jamak), atau essay.',
        errorTitle: 'Jenis Soal Tidak Valid',
        error: 'Harap pilih salah satu dari daftar: single_choice, multiple_choice, atau essay.'
      }),
      buildListValidationConfig({
        sqref: `K2:K${maxRow}`,
        values: kunciList,
        refColLetter: 'C',
        errorStyle: 'warning',
        promptTitle: 'Kunci Jawaban',
        prompt: 'Pilih A-E untuk PG tunggal, ketik A,B,C untuk PG jamak, atau ketik rubrik untuk essay.'
      }),
      buildListValidationConfig({
        sqref: `L2:L${maxRow}`,
        values: bobotList,
        refColLetter: 'D',
        errorStyle: 'warning',
        promptTitle: 'Bobot Nilai Soal',
        prompt: 'Pilih bobot standar dari dropdown atau ketik angka bobot soal.'
      })
    ]
  };

  return { wb, validationsBySheet };
};

/**
 * Unduh File Asli Microsoft Excel (.xlsx) untuk Bank Soal (Dengan Dropdown Tertanam)
 */
export const downloadExcelTemplate = (options = {}) => {
  const cleanOpts = safeTemplateOptions(options);
  const { wb, validationsBySheet } = createQuestionBankWorkbookPayload(SAMPLE_QUESTIONS, {
    sheetName: 'Bank_Soal_PAI',
    packages: cleanOpts.packages || []
  });
  return downloadWorkbookWithValidations(wb, 'Template_Bank_Soal_ExamPro_PAI.xlsx', validationsBySheet);
};

/**
 * Unduh File Excel (.xlsx) untuk Backup Butir Soal per Paket (Dengan Dropdown Tertanam)
 */
export const exportQuestionsToExcel = (questions, filename = 'Backup_Soal.xlsx', options = {}) => {
  const cleanOpts = safeTemplateOptions(options);
  const rows = (questions || []).map((q, idx) => {
    let opts = [];
    try {
      opts = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []);
    } catch (e) {
      opts = [];
    }
    const optA = opts.find(o => String(o.id).toUpperCase() === 'A')?.text || '';
    const optB = opts.find(o => String(o.id).toUpperCase() === 'B')?.text || '';
    const optC = opts.find(o => String(o.id).toUpperCase() === 'C')?.text || '';
    const optD = opts.find(o => String(o.id).toUpperCase() === 'D')?.text || '';
    const optE = opts.find(o => String(o.id).toUpperCase() === 'E')?.text || '';

    return [
      idx + 1,
      q.paket || 'Pretest',
      q.type || 'single_choice',
      q.question_text || '',
      q.image_url || '',
      optA,
      optB,
      optC,
      optD,
      optE,
      q.key_answer || 'A',
      Number(q.weight) || 1
    ];
  });

  const paketFromData = (questions || []).map(q => q.paket).filter(Boolean);
  const { wb, validationsBySheet } = createQuestionBankWorkbookPayload(rows, {
    sheetName: 'Bank_Soal',
    packages: [...(cleanOpts.packages || []), ...paketFromData]
  });
  return downloadWorkbookWithValidations(wb, filename, validationsBySheet);
};

/**
 * Parse File Excel (.xlsx / .xls / .csv) yang diunggah
 */
export const parseUploadedQuestionsFile = async (file) => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (!rows || rows.length <= 1) {
    throw new Error('File Excel kosong atau tidak memiliki baris data.');
  }

  // Header detection yang akurat (mencegah 'Jenis_Soal' tertukar dengan 'Teks_Soal')
  const headerRow = rows[0].map(h => String(h || '').trim().toLowerCase());
  const idxPaket = headerRow.findIndex(h => h.includes('paket'));
  const idxType = headerRow.findIndex(h => h.includes('jenis') || h.includes('tipe') || h === 'type');
  const idxText = headerRow.findIndex((h, idx) => 
    idx !== idxType && (h.includes('teks') || h.includes('pertanyaan') || (h.includes('soal') && !h.includes('jenis') && !h.includes('tipe')))
  );
  const idxImg = headerRow.findIndex(h => h.includes('gambar') || h.includes('image') || h.includes('foto'));
  const idxA = headerRow.findIndex(h => h.includes('opsi_a') || h === 'a' || h === 'opsi a');
  const idxB = headerRow.findIndex(h => h.includes('opsi_b') || h === 'b' || h === 'opsi b');
  const idxC = headerRow.findIndex(h => h.includes('opsi_c') || h === 'c' || h === 'opsi c');
  const idxD = headerRow.findIndex(h => h.includes('opsi_d') || h === 'd' || h === 'opsi d');
  const idxE = headerRow.findIndex(h => h.includes('opsi_e') || h === 'e' || h === 'opsi e');
  const idxKey = headerRow.findIndex(h => h.includes('kunci') || h.includes('jawaban') || h.includes('key'));
  const idxWeight = headerRow.findIndex(h => h.includes('bobot') || h.includes('score') || h.includes('poin') || h.includes('weight'));

  const parsedQuestions = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const paket = (idxPaket !== -1 ? String(row[idxPaket] || '') : (idxText !== 1 ? String(row[1] || '') : 'Pretest')).trim() || 'Pretest';
    const typeRaw = (idxType !== -1 ? String(row[idxType] || '') : (idxText !== 2 ? String(row[2] || '') : 'single_choice')).trim().toLowerCase();
    
    // Pastikan teks soal diambil dari kolom teks_soal (biasanya index 3), bukan dari kolom jenis_soal
    const targetIdxText = idxText !== -1 ? idxText : 3;
    let qText = String(row[targetIdxText] || '').trim();

    // Pencegahan cerdas: Jika qText tidak sengaja bernilai 'single_choice', 'multiple_choice', atau kosong,
    // pindai kolom lain pada baris ini yang memuat narasi kalimat pertanyaan sesungguhnya
    if (!qText || qText === 'single_choice' || qText === 'multiple_choice' || qText === 'essay') {
      for (let c = 1; c < Math.min(row.length, 6); c++) {
        const candidate = String(row[c] || '').trim();
        if (c !== idxType && c !== idxPaket && candidate.length > 5 &&
            candidate !== 'single_choice' && candidate !== 'multiple_choice' && candidate !== 'essay') {
          qText = candidate;
          break;
        }
      }
    }

    if (!qText) continue;

    let type = 'single_choice';
    if (typeRaw.includes('multiple') || typeRaw.includes('jamak') || typeRaw.includes('kompleks')) {
      type = 'multiple_choice';
    } else if (typeRaw.includes('essay') || typeRaw.includes('uraian')) {
      type = 'essay';
    }

    const imgUrl = (idxImg !== -1 ? String(row[idxImg] || '') : String(row[4] || '')).trim();
    const optA = (idxA !== -1 ? String(row[idxA] || '') : String(row[5] || '')).trim();
    const optB = (idxB !== -1 ? String(row[idxB] || '') : String(row[6] || '')).trim();
    const optC = (idxC !== -1 ? String(row[idxC] || '') : String(row[7] || '')).trim();
    const optD = (idxD !== -1 ? String(row[idxD] || '') : String(row[8] || '')).trim();
    const optE = (idxE !== -1 ? String(row[idxE] || '') : String(row[9] || '')).trim();
    const keyAns = (idxKey !== -1 ? String(row[idxKey] || '') : (row[10] !== undefined ? String(row[10] || '') : String(row[9] || ''))).trim().toUpperCase();
    const weightVal = Number(idxWeight !== -1 ? row[idxWeight] : (row[11] !== undefined ? row[11] : row[10])) || 1;

    const options = type !== 'essay' ? [
      { id: 'A', text: optA, image: '' },
      { id: 'B', text: optB, image: '' },
      { id: 'C', text: optC, image: '' },
      { id: 'D', text: optD, image: '' },
      { id: 'E', text: optE, image: '' }
    ].filter(o => o.text !== '') : [];

    parsedQuestions.push({
      paket: paket,
      type: type,
      question_text: qText,
      image_url: imgUrl,
      options: options,
      key_answer: keyAns,
      weight: weightVal
    });
  }

  return parsedQuestions;
};


// ==========================================
// 2. DATA PESERTA TEMPLATE (.xlsx)
// ==========================================

export const PARTICIPANT_HEADERS = [
  'No',
  'Username',
  'Password',
  'Nama_Lengkap',
  'Jenis_Kelamin',
  'NIP_NIM',
  'Kelas',
  'Asal_Madrasah_Sekolah',
  'Keterangan_Disabilitas',
  'Catatan_Kebutuhan_Khusus'
];

export const SAMPLE_PARTICIPANTS = [
  [
    1,
    'guru_pai_01',
    'kemenag2026',
    'Drs. H. Ahmad Fauzi, M.Pd',
    'Laki-Laki',
    '198501012010121001',
    'Kelas A',
    'MAN 1 Kota Jakarta',
    'Non-Disabilitas',
    ''
  ],
  [
    2,
    'guru_pai_02',
    'kemenag2026',
    'Hj. Siti Nurhaliza, S.Ag',
    'Perempuan',
    '199002152015032002',
    'Kelas A',
    'MTsN 2 Jakarta Selatan',
    'Tunanetra',
    'Menggunakan screen reader NVDA / TTS'
  ],
  [
    3,
    'guru_pai_03',
    'kemenag2026',
    'Muhammad Rasyid, M.Pd.I',
    '-',
    '198807122014021003',
    'Kelas B',
    'SMAN 4 Jakarta Barat',
    'Low Vision',
    'Butuh huruf besar & kontras tinggi'
  ]
];

/**
 * Bangun Workbook Data Peserta + Data Validation Dropdown Tertanam
 */
export const createParticipantWorkbookPayload = (rowsData, options = {}) => {
  const { sheetName = 'Data_Peserta', classes = [] } = safeTemplateOptions(options);
  const wb = XLSX.utils.book_new();
  const wsData = [PARTICIPANT_HEADERS, ...rowsData];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 18 }, // Username
    { wch: 16 }, // Password
    { wch: 32 }, // Nama_Lengkap
    { wch: 15 }, // Jenis_Kelamin
    { wch: 22 }, // NIP_NIM
    { wch: 16 }, // Kelas
    { wch: 30 }, // Asal_Madrasah_Sekolah
    { wch: 24 }, // Keterangan_Disabilitas
    { wch: 32 }  // Catatan_Kebutuhan_Khusus
  ];

  const genderList = ['Laki-Laki', 'Perempuan', '-'];
  const classList = uniqueCleanList(['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', ...classes]);
  const disabilityList = DISABILITY_CATEGORIES.map(c => c.shortLabel);

  const maxRefRows = Math.max(genderList.length, classList.length, disabilityList.length);
  const refRows = [['Jenis_Kelamin', 'Daftar_Kelas', 'Keterangan_Disabilitas', 'Penyesuaian_Otomatis']];
  for (let i = 0; i < maxRefRows; i++) {
    const cat = DISABILITY_CATEGORIES[i];
    refRows.push([
      genderList[i] || '',
      classList[i] || '',
      disabilityList[i] || '',
      cat ? cat.needsSummary : ''
    ]);
  }
  const refWs = XLSX.utils.aoa_to_sheet(refRows);
  refWs['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 68 }];

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.utils.book_append_sheet(wb, refWs, 'Petunjuk_Pilihan');

  const maxRow = Math.max(501, rowsData.length + 100);
  const validationsBySheet = {
    'xl/worksheets/sheet1.xml': [
      buildListValidationConfig({
        sqref: `E2:E${maxRow}`,
        values: genderList,
        refColLetter: 'A',
        errorStyle: 'stop',
        promptTitle: 'Pilih Jenis Kelamin',
        prompt: 'Pilih dari dropdown: Laki-Laki, Perempuan, atau -.',
        errorTitle: 'Input Jenis Kelamin',
        error: 'Harap pilih Laki-Laki, Perempuan, atau -.'
      }),
      buildListValidationConfig({
        sqref: `G2:G${maxRow}`,
        values: classList,
        refColLetter: 'B',
        errorStyle: 'warning',
        promptTitle: 'Pilih / Ketik Kelas',
        prompt: 'Pilih kelas dari dropdown atau ketik nama kelas baru sesuai kebutuhan.'
      }),
      buildListValidationConfig({
        sqref: `I2:I${maxRow}`,
        values: disabilityList,
        refColLetter: 'C',
        errorStyle: 'stop',
        promptTitle: 'Pilih Keterangan Disabilitas',
        prompt: 'Pilih Non-Disabilitas atau kategori disabilitas agar sistem ujian menyesuaikan aturan tab & aksesibilitas.',
        errorTitle: 'Kategori Disabilitas Tidak Valid',
        error: 'Harap pilih salah satu kategori dari daftar dropdown Keterangan Disabilitas.'
      })
    ]
  };

  return { wb, validationsBySheet };
};

/**
 * Unduh File Asli Microsoft Excel (.xlsx) untuk Data Peserta (Dengan Dropdown Tertanam)
 */
export const downloadParticipantExcelTemplate = (options = {}) => {
  const cleanOpts = safeTemplateOptions(options);
  const { wb, validationsBySheet } = createParticipantWorkbookPayload(SAMPLE_PARTICIPANTS, {
    sheetName: 'Data_Peserta',
    classes: cleanOpts.classes || []
  });
  return downloadWorkbookWithValidations(wb, 'Template_Data_Peserta_PAI.xlsx', validationsBySheet);
};

/**
 * Unduh File Excel (.xlsx) Seluruh Data Peserta untuk Cadangan (Dengan Dropdown Tertanam)
 */
export const exportParticipantsToExcel = (participants, filename = 'Data_Peserta_ExamPro.xlsx', options = {}) => {
  const cleanOpts = safeTemplateOptions(options);
  const rows = (participants || []).map((p, idx) => [
    idx + 1,
    p.username || '',
    p.password || 'kemenag2026',
    p.full_name || p.username || '',
    (p.gender && p.gender !== '-') ? p.gender : '-',
    p.identifier || '',
    p.kelas || '-',
    p.institution || '',
    getDisabilityMeta(p.disability_type).shortLabel,
    p.disability_note || ''
  ]);

  const classFromData = (participants || []).map(p => p.kelas).filter(c => c && c !== '-');
  const { wb, validationsBySheet } = createParticipantWorkbookPayload(rows, {
    sheetName: 'Peserta',
    classes: [...(cleanOpts.classes || []), ...classFromData]
  });
  return downloadWorkbookWithValidations(wb, filename, validationsBySheet);
};

/**
 * Parse File Excel (.xlsx / .xls / .csv) Data Peserta
 */
export const parseUploadedParticipantFile = async (file) => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (!rows || rows.length <= 1) {
    throw new Error('File Excel data peserta kosong atau tidak memiliki data.');
  }

  const headerRow = rows[0].map(h => String(h || '').trim().toLowerCase());
  const idxUser = headerRow.findIndex(h => h.includes('username') || h.includes('user'));
  const idxPass = headerRow.findIndex(h => h.includes('password') || h.includes('pass'));
  const idxName = headerRow.findIndex(h => h.includes('nama'));
  const idxGender = headerRow.findIndex(h => h.includes('kelamin') || h.includes('gender') || h.includes('jk'));
  const idxId = headerRow.findIndex(h => h.includes('nip') || h.includes('nim') || h.includes('nik') || h.includes('id'));
  const idxKelas = headerRow.findIndex(h => h.includes('kelas') || h.includes('rombel') || h.includes('group'));
  const idxSchool = headerRow.findIndex(h => h.includes('asal') || h.includes('madrasah') || h.includes('sekolah') || h.includes('instansi'));
  const idxDisabilitas = headerRow.findIndex(h => h.includes('disabil') || h.includes('kebutuhan_khusus') || h.includes('difabel'));
  const idxDisabilitasNote = headerRow.findIndex(h => h.includes('catatan') || h.includes('keterangan_khusus'));
  const idxPaket = headerRow.findIndex(h => h.includes('paket'));

  const parsedParticipants = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const username = (idxUser !== -1 ? String(row[idxUser] || '') : String(row[1] || '')).trim();
    const password = (idxPass !== -1 ? String(row[idxPass] || '') : String(row[2] || '')).trim();
    const fullName = (idxName !== -1 ? String(row[idxName] || '') : String(row[3] || '')).trim();
    
    // Gender jika kosong diisi '-'
    const rawGender = (idxGender !== -1 ? String(row[idxGender] || '') : String(row[4] || '')).trim();
    const cleanGender = (rawGender && rawGender !== '-' && rawGender.toLowerCase() !== 'null' && rawGender.toLowerCase() !== 'undefined')
      ? rawGender
      : '-';

    const identifier = (idxId !== -1 ? String(row[idxId] || '') : String(row[5] || '')).trim();
    
    // Penanganan Kelas vs Asal Sekolah agar nama sekolah tidak salah masuk ke kolom kelas
    let kelas = '-';
    if (idxKelas !== -1) {
      kelas = String(row[idxKelas] || '').trim() || '-';
    }

    let institution = '';
    if (idxSchool !== -1) {
      institution = String(row[idxSchool] || '').trim();
    } else if (idxKelas === -1 && row[6] !== undefined) {
      // Jika kolom kelas tidak ada dan ada kolom ke-6, gunakan sebagai nama instansi
      institution = String(row[6] || '').trim();
    } else if (row[7] !== undefined) {
      institution = String(row[7] || '').trim();
    }

    // Paket dari Excel (jika ada kolom paket dibaca, jika tidak ada default '-')
    const paket = idxPaket !== -1 ? (String(row[idxPaket] || '').trim() || '-') : '-';
    const rawDisabilitas = idxDisabilitas !== -1 ? String(row[idxDisabilitas] || '') : (row[8] !== undefined ? String(row[8] || '') : '');
    const disabilityType = normalizeDisabilityType(rawDisabilitas);
    const disabilityNote = idxDisabilitasNote !== -1
      ? String(row[idxDisabilitasNote] || '').trim()
      : (row[9] !== undefined ? String(row[9] || '').trim() : '');

    if (username || fullName) {
      parsedParticipants.push({
        username: username,
        password: password || 'kemenag2026',
        full_name: fullName || username,
        gender: cleanGender,
        identifier: identifier || username,
        kelas: kelas,
        institution: institution,
        paket: paket,
        disability_type: disabilityType,
        disability_note: disabilityNote
      });
    }
  }

  return parsedParticipants;
};

// ==========================================
// 3. EKSPOR HASIL UJIAN & ANALISIS BUTIR JAWABAN
// ==========================================

/**
 * Ekspor Rekap Nilai Lengkap beserta Analisis Butir Jawaban (Benar / Salah) ke File Excel (.xlsx)
 */
export const exportDetailedResultsToExcel = (submissions, questions, participants, sessions, filename = 'Rekap_Hasil_Ujian_Lengkap.xlsx') => {
  const wb = XLSX.utils.book_new();

  // Helper evaluasi jawaban
  const evaluateAnswer = (q, userAns) => {
    if (q.type === 'essay') {
      return { isEssay: true, text: String(userAns || '').trim() || '(Tidak dijawab)' };
    }
    const key = String(q.key_answer || '').trim().toUpperCase();
    if (!userAns) return { isCorrect: false, text: '(Kosong)', status: 'KOSONG', key };

    if (q.type === 'single_choice') {
      const u = String(userAns).trim().toUpperCase();
      const isCorrect = u === key;
      return { isCorrect, text: u, status: isCorrect ? 'BENAR' : 'SALAH', key };
    }

    if (q.type === 'multiple_choice') {
      const u = Array.isArray(userAns)
        ? userAns.map(a => String(a).trim().toUpperCase()).sort().join(',')
        : String(userAns).split(',').map(a => a.trim().toUpperCase()).sort().join(',');
      const k = key.split(',').map(a => a.trim().toUpperCase()).sort().join(',');
      const isCorrect = u === k && u.length > 0;
      return { isCorrect, text: u, status: isCorrect ? 'BENAR' : 'SALAH', key: k };
    }

    return { isCorrect: false, text: String(userAns), status: '-', key };
  };

  // Ambil daftar pertanyaan unik dari sesi terkait (sesuai urutan template Bank Soal)
  const sessionIds = Array.from(new Set(submissions.map(s => s.session_id)));
  let relevantQuestions = questions.filter(q => sessionIds.includes(q.session_id));
  if (relevantQuestions.length === 0) {
    relevantQuestions = questions;
  }

  // 1. Sheet 1: Rekap_Jawaban_Template (Sesuai Permintaan: Kolom A=No, B=Nomor Peserta, C=Nama, D=Soal 1, E=Soal 2, dst)
  const templateHeaders = [
    'No',
    'Nomor Peserta',
    'Nama',
    'Kelas',
    'Paket',
    ...relevantQuestions.map((q, qIdx) => `Soal ${qIdx + 1}`),
    'Total Benar',
    'Total Salah',
    'Skor PG',
    'Nilai Essay',
    'Nilai Akhir'
  ];

  const templateRows = submissions.map((sub, idx) => {
    const part = participants.find(p => 
      (p.username && (String(p.username).toLowerCase() === String(sub.participant_id).toLowerCase() || String(p.username).toLowerCase() === String(sub.username || '').toLowerCase())) ||
      (p.identifier && String(p.identifier).toLowerCase() === String(sub.participant_id).toLowerCase()) ||
      (p.participant_id && String(p.participant_id).toLowerCase() === String(sub.participant_id).toLowerCase())
    ) || participants.find(p => p.participant_id === sub.participant_id);

    let cleanPaket = part?.paket || 'Pretest';
    if (/^\d{4}-\d{2}-\d{2}T/.test(cleanPaket) || cleanPaket === '-') cleanPaket = 'Pretest';
    const cleanKelas = (part?.kelas && part.kelas !== '-') ? part.kelas : 'PAI';

    let parsedAnswers = {};
    try {
      parsedAnswers = typeof sub.answers_json === 'string' ? JSON.parse(sub.answers_json) : (sub.answers_json || {});
    } catch (e) {}

    let correctCount = 0;
    let wrongCount = 0;
    let earnedPgWeight = 0;

    const answerCols = relevantQuestions.map(q => {
      const qWeight = Number(q.weight) || 1;
      const userAns = parsedAnswers[q.question_id];
      if (q.type === 'essay') {
        return userAns ? String(userAns).replace(/\n/g, ' ') : '-';
      }
      const evalRes = evaluateAnswer(q, userAns);
      if (evalRes.isCorrect) {
        correctCount++;
        earnedPgWeight += qWeight;
      } else {
        wrongCount++;
      }
      return evalRes.text || '-';
    });

    const finalPg = earnedPgWeight > 0 ? earnedPgWeight : (Number(sub.pg_score) || 0);
    const finalEssay = Number(sub.essay_score) || 0;
    const finalTotal = finalPg + finalEssay;

    return [
      idx + 1,
      part?.identifier || part?.username || '-',
      part?.full_name || part?.username || 'Peserta',
      cleanKelas,
      cleanPaket,
      ...answerCols,
      correctCount,
      wrongCount,
      finalPg,
      finalEssay,
      finalTotal
    ];
  });

  const wsTemplate = XLSX.utils.aoa_to_sheet([templateHeaders, ...templateRows]);
  XLSX.utils.book_append_sheet(wb, wsTemplate, 'Rekap_Jawaban_Template');

  // 2. Sheet 2: Analisis_Benar_Salah (Lengkap dengan Status BENAR / SALAH per Butir)
  const detailHeaders = [
    'No',
    'Nomor Peserta',
    'Nama Peserta',
    'Kelas',
    'Paket',
    'Total Nilai',
    'PG Benar',
    'PG Salah',
    ...relevantQuestions.map((q, qIdx) => `Soal ${qIdx + 1} (${q.type === 'essay' ? 'Essay' : 'Kunci: ' + q.key_answer})`)
  ];

  const detailRows = submissions.map((sub, idx) => {
    const part = participants.find(p => 
      (p.username && (String(p.username).toLowerCase() === String(sub.participant_id).toLowerCase() || String(p.username).toLowerCase() === String(sub.username || '').toLowerCase())) ||
      (p.identifier && String(p.identifier).toLowerCase() === String(sub.participant_id).toLowerCase()) ||
      (p.participant_id && String(p.participant_id).toLowerCase() === String(sub.participant_id).toLowerCase())
    ) || participants.find(p => p.participant_id === sub.participant_id);

    let cleanPaket = part?.paket || 'Pretest';
    if (/^\d{4}-\d{2}-\d{2}T/.test(cleanPaket) || cleanPaket === '-') cleanPaket = 'Pretest';
    const cleanKelas = (part?.kelas && part.kelas !== '-') ? part.kelas : 'PAI';

    let parsedAnswers = {};
    try {
      parsedAnswers = typeof sub.answers_json === 'string' ? JSON.parse(sub.answers_json) : (sub.answers_json || {});
    } catch (e) {}

    let correctCount = 0;
    let wrongCount = 0;
    let earnedPgWeight = 0;

    const questionResults = relevantQuestions.map(q => {
      const qWeight = Number(q.weight) || 1;
      const userAns = parsedAnswers[q.question_id];
      if (q.type === 'essay') {
        return userAns ? `"${String(userAns).replace(/\n/g, ' ')}"` : '(Tidak dijawab)';
      }
      const evalRes = evaluateAnswer(q, userAns);
      if (evalRes.isCorrect) {
        correctCount++;
        earnedPgWeight += qWeight;
        return `${evalRes.text} [BENAR]`;
      } else {
        wrongCount++;
        return `${evalRes.text} [SALAH - Kunci: ${evalRes.key}]`;
      }
    });

    const finalPg = earnedPgWeight > 0 ? earnedPgWeight : (Number(sub.pg_score) || 0);
    const finalEssay = Number(sub.essay_score) || 0;
    const finalTotal = finalPg + finalEssay;

    return [
      idx + 1,
      part?.identifier || part?.username || '-',
      part?.full_name || part?.username || 'Peserta',
      cleanKelas,
      cleanPaket,
      finalTotal,
      correctCount,
      wrongCount,
      ...questionResults
    ];
  });

  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Analisis_Benar_Salah');

  // 3. Sheet 3: Rekap_Nilai_Peserta (Informasi Lengkap Administrasi Ujian)
  const rekapHeaders = [
    'No',
    'Nomor Peserta',
    'Nama Lengkap',
    'Username',
    'Kelas',
    'Asal Madrasah / Sekolah',
    'Sesi Ujian',
    'Paket Soal',
    'Skor PG (0-100)',
    'Nilai Essay (0-100)',
    'Nilai Total',
    'Soal PG Benar',
    'Soal PG Salah',
    'Pelanggaran Tab',
    'Waktu Selesai'
  ];

  const rekapRows = submissions.map((sub, idx) => {
    const part = participants.find(p => p.participant_id === sub.participant_id || p.username === sub.participant_id);
    const sess = sessions.find(s => s.session_id === sub.session_id);

    let parsedAnswers = {};
    try {
      parsedAnswers = typeof sub.answers_json === 'string' ? JSON.parse(sub.answers_json) : (sub.answers_json || {});
    } catch (e) {}

    let correctCount = 0;
    let wrongCount = 0;

    relevantQuestions.forEach(q => {
      if (q.type !== 'essay') {
        const evalRes = evaluateAnswer(q, parsedAnswers[q.question_id]);
        if (evalRes.isCorrect) correctCount++;
        else wrongCount++;
      }
    });

    return [
      idx + 1,
      part?.identifier || part?.username || '-',
      part?.full_name || part?.username || 'Peserta',
      part?.username || '-',
      part?.kelas || '-',
      part?.institution || '-',
      sess?.title || sub.session_id,
      part?.paket || '-',
      Number(sub.pg_score) || 0,
      Number(sub.essay_score) || 0,
      Number(sub.total_score) || 0,
      correctCount,
      wrongCount,
      Number(sub.tab_switch_count) || 0,
      sub.submitted_at ? new Date(sub.submitted_at).toLocaleString('id-ID') : '-'
    ];
  });

  const wsRekap = XLSX.utils.aoa_to_sheet([rekapHeaders, ...rekapRows]);
  XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekap_Nilai');

  XLSX.writeFile(wb, filename);
};

/**
 * Ekspor Lembar Hasil Jawaban Perorangan Peserta ke File Excel (.xlsx)
 */
export const exportSingleParticipantResultToExcel = (sub, questions, participant, session, filename) => {
  const wb = XLSX.utils.book_new();

  let parsedAnswers = {};
  try {
    parsedAnswers = typeof sub.answers_json === 'string' ? JSON.parse(sub.answers_json) : (sub.answers_json || {});
  } catch (e) {}

  const sessQuestions = questions.filter(q => q.session_id === sub.session_id);

  const infoRows = [
    ['LEMBAR HASIL JAWABAN PESERTA UJIAN CBT'],
    ['Nama Peserta', participant?.full_name || participant?.username || '-'],
    ['Username', participant?.username || '-'],
    ['NIP / NIM', participant?.identifier || '-'],
    ['Kelas', participant?.kelas || '-'],
    ['Asal Sekolah / Instansi', participant?.institution || '-'],
    ['Mata Ujian / Sesi', session?.title || sub.session_id],
    ['Paket Soal', participant?.paket || '-'],
    ['Skor Pilihan Ganda (PG)', Number(sub.pg_score) || 0],
    ['Nilai Essay', Number(sub.essay_score) || 0],
    ['Total Nilai Akhir', Number(sub.total_score) || 0],
    ['Pelanggaran Tab', `${Number(sub.tab_switch_count) || 0} kali`],
    ['Waktu Pengumpulan', sub.submitted_at ? new Date(sub.submitted_at).toLocaleString('id-ID') : '-'],
    []
  ];

  const tableHeaders = [
    'No',
    'Tipe Soal',
    'Teks Soal',
    'Jawaban Peserta',
    'Kunci Jawaban',
    'Status Hasil',
    'Bobot Poin'
  ];

  const tableRows = sessQuestions.map((q, idx) => {
    const userAns = parsedAnswers[q.question_id];
    let statusHasil = '-';
    let userAnsText = String(userAns || '(Kosong)');
    let keyAnsText = String(q.key_answer || '-');

    if (q.type === 'single_choice') {
      const isCorrect = userAns && String(userAns).trim().toUpperCase() === keyAnsText.trim().toUpperCase();
      statusHasil = isCorrect ? 'BETUL (BENAR)' : 'SALAH';
    } else if (q.type === 'multiple_choice') {
      const u = Array.isArray(userAns)
        ? userAns.map(a => String(a).trim().toUpperCase()).sort().join(',')
        : String(userAns || '').split(',').map(a => a.trim().toUpperCase()).sort().join(',');
      const k = keyAnsText.split(',').map(a => a.trim().toUpperCase()).sort().join(',');
      const isCorrect = u === k && u.length > 0;
      statusHasil = isCorrect ? 'BETUL (BENAR)' : 'SALAH';
    } else if (q.type === 'essay') {
      statusHasil = `Dinilai Essay (Skor: ${sub.essay_score || 0})`;
      keyAnsText = `Rubrik: ${q.key_answer || '-'}`;
    }

    return [
      idx + 1,
      q.type === 'single_choice' ? 'Pilihan Ganda' : q.type === 'multiple_choice' ? 'Pilihan Jamak' : 'Essay',
      q.question_text || '',
      userAnsText,
      keyAnsText,
      statusHasil,
      Number(q.weight) || 1
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([...infoRows, tableHeaders, ...tableRows]);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 50 },
    { wch: 25 },
    { wch: 25 },
    { wch: 20 },
    { wch: 12 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Lembar_Jawaban');
  XLSX.writeFile(wb, filename || `Hasil_${participant?.username || 'Peserta'}.xlsx`);
};
