/**
 * Utilitas Generator Template Excel (.xlsx) dan Parser Bank Soal & Data Peserta
 * Menggunakan library SheetJS (XLSX) untuk menghasilkan file Microsoft Excel (.xlsx) asli.
 */
import * as XLSX from 'xlsx';

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
    'Rubrik: Relevansi pedagogis, pemanfaatan alat digital etis, dan penguatan nilai-nilai Islam.',
    3
  ]
];

/**
 * Unduh File Asli Microsoft Excel (.xlsx) untuk Bank Soal
 */
export const downloadExcelTemplate = () => {
  const wb = XLSX.utils.book_new();
  const wsData = [QUESTION_HEADERS, ...SAMPLE_QUESTIONS];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Lebar kolom rapi
  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 14 }, // Paket
    { wch: 16 }, // Jenis_Soal
    { wch: 45 }, // Teks_Soal
    { wch: 25 }, // Gambar_URL
    { wch: 30 }, // Opsi_A
    { wch: 30 }, // Opsi_B
    { wch: 30 }, // Opsi_C
    { wch: 30 }, // Opsi_D
    { wch: 15 }, // Kunci_Jawaban
    { wch: 8 }   // Bobot
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Bank_Soal_PAI');
  XLSX.writeFile(wb, 'Template_Bank_Soal_ExamPro_PAI.xlsx');
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

  // Header detection
  const headerRow = rows[0].map(h => String(h || '').trim().toLowerCase());
  const idxPaket = headerRow.findIndex(h => h.includes('paket'));
  const idxType = headerRow.findIndex(h => h.includes('jenis') || h.includes('tipe'));
  const idxText = headerRow.findIndex(h => h.includes('teks') || h.includes('soal') || h.includes('pertanyaan'));
  const idxImg = headerRow.findIndex(h => h.includes('gambar'));
  const idxA = headerRow.findIndex(h => h.includes('opsi_a') || h === 'a');
  const idxB = headerRow.findIndex(h => h.includes('opsi_b') || h === 'b');
  const idxC = headerRow.findIndex(h => h.includes('opsi_c') || h === 'c');
  const idxD = headerRow.findIndex(h => h.includes('opsi_d') || h === 'd');
  const idxKey = headerRow.findIndex(h => h.includes('kunci'));
  const idxWeight = headerRow.findIndex(h => h.includes('bobot'));

  const parsedQuestions = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const paket = (idxPaket !== -1 ? String(row[idxPaket] || '') : String(row[1] || '')).trim() || 'Pretest';
    const typeRaw = (idxType !== -1 ? String(row[idxType] || '') : String(row[2] || '')).trim().toLowerCase();
    const qText = (idxText !== -1 ? String(row[idxText] || '') : String(row[3] || '')).trim();

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
    const keyAns = (idxKey !== -1 ? String(row[idxKey] || '') : String(row[9] || '')).trim().toUpperCase();
    const weightVal = Number(idxWeight !== -1 ? row[idxWeight] : row[10]) || 1;

    const options = type !== 'essay' ? [
      { id: 'A', text: optA, image: '' },
      { id: 'B', text: optB, image: '' },
      { id: 'C', text: optC, image: '' },
      { id: 'D', text: optD, image: '' }
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
  'Paket'
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
    'Pretest'
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
    'Pretest'
  ],
  [
    3,
    'guru_pai_03',
    'kemenag2026',
    'Muhammad Rasyid, M.Pd.I',
    'Laki-Laki',
    '198807122014021003',
    'Kelas B',
    'SMAN 4 Jakarta Barat',
    'Postest'
  ]
];

/**
 * Unduh File Asli Microsoft Excel (.xlsx) untuk Data Peserta
 */
export const downloadParticipantExcelTemplate = () => {
  const wb = XLSX.utils.book_new();
  const wsData = [PARTICIPANT_HEADERS, ...SAMPLE_PARTICIPANTS];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 18 }, // Username
    { wch: 16 }, // Password
    { wch: 32 }, // Nama_Lengkap
    { wch: 15 }, // Jenis_Kelamin
    { wch: 22 }, // NIP_NIM
    { wch: 14 }, // Kelas
    { wch: 30 }, // Asal_Madrasah_Sekolah
    { wch: 14 }  // Paket
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Data_Peserta');
  XLSX.writeFile(wb, 'Template_Data_Peserta_PAI.xlsx');
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
  const idxGender = headerRow.findIndex(h => h.includes('kelamin') || h.includes('gender'));
  const idxId = headerRow.findIndex(h => h.includes('nip') || h.includes('nim') || h.includes('id'));
  const idxKelas = headerRow.findIndex(h => h.includes('kelas') || h.includes('rombel') || h.includes('group'));
  const idxSchool = headerRow.findIndex(h => h.includes('asal') || h.includes('madrasah') || h.includes('sekolah') || h.includes('instansi'));
  const idxPaket = headerRow.findIndex(h => h.includes('paket'));

  const parsedParticipants = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const username = (idxUser !== -1 ? String(row[idxUser] || '') : String(row[1] || '')).trim();
    const password = (idxPass !== -1 ? String(row[idxPass] || '') : String(row[2] || '')).trim();
    const fullName = (idxName !== -1 ? String(row[idxName] || '') : String(row[3] || '')).trim();
    const gender = (idxGender !== -1 ? String(row[idxGender] || '') : String(row[4] || '')).trim();
    const identifier = (idxId !== -1 ? String(row[idxId] || '') : String(row[5] || '')).trim();
    const kelas = (idxKelas !== -1 ? String(row[idxKelas] || '') : String(row[6] || '')).trim() || 'Kelas A';
    const institution = (idxSchool !== -1 ? String(row[idxSchool] || '') : String(row[7] || '')).trim();
    const paket = (idxPaket !== -1 ? String(row[idxPaket] || '') : String(row[8] || '')).trim() || 'Pretest';

    if (username || fullName) {
      parsedParticipants.push({
        username: username,
        password: password || 'kemenag2026',
        full_name: fullName || username,
        gender: gender || 'Laki-Laki',
        identifier: identifier || username,
        kelas: kelas,
        institution: institution,
        paket: paket
      });
    }
  }

  return parsedParticipants;
};
