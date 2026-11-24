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

  const parsedQuestions = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && row[2]) {
      const typeRaw = String(row[1] || '').trim().toLowerCase();
      let type = 'single_choice';
      if (typeRaw.includes('multiple') || typeRaw.includes('jamak') || typeRaw.includes('kompleks')) {
        type = 'multiple_choice';
      } else if (typeRaw.includes('essay') || typeRaw.includes('uraian')) {
        type = 'essay';
      }

      const options = type !== 'essay' ? [
        { id: 'A', text: String(row[4] || '').trim(), image: '' },
        { id: 'B', text: String(row[5] || '').trim(), image: '' },
        { id: 'C', text: String(row[6] || '').trim(), image: '' },
        { id: 'D', text: String(row[7] || '').trim(), image: '' }
      ].filter(o => o.text !== '') : [];

      parsedQuestions.push({
        type: type,
        question_text: String(row[2]).trim(),
        image_url: String(row[3] || '').trim(),
        options: options,
        key_answer: String(row[8] || '').trim().toUpperCase(),
        weight: Number(row[9]) || 1
      });
    }
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
  'Asal_Madrasah_Sekolah'
];

export const SAMPLE_PARTICIPANTS = [
  [
    1,
    'guru_pai_01',
    'kemenag2026',
    'Drs. H. Ahmad Fauzi, M.Pd',
    'Laki-Laki',
    '198501012010121001',
    'MAN 1 Kota Jakarta'
  ],
  [
    2,
    'guru_pai_02',
    'kemenag2026',
    'Hj. Siti Nurhaliza, S.Ag',
    'Perempuan',
    '199002152015032002',
    'MTsN 2 Jakarta Selatan'
  ],
  [
    3,
    'guru_pai_03',
    'kemenag2026',
    'Muhammad Rasyid, M.Pd.I',
    'Laki-Laki',
    '198807122014021003',
    'SMAN 4 Jakarta Barat'
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
    { wch: 30 }  // Asal_Madrasah_Sekolah
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

  const parsedParticipants = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && (row[1] || row[3])) {
      parsedParticipants.push({
        username: String(row[1] || '').trim(),
        password: String(row[2] || 'kemenag2026').trim(),
        full_name: String(row[3] || row[1] || '').trim(),
        gender: String(row[4] || 'Laki-Laki').trim(),
        identifier: String(row[5] || row[1] || '').trim(),
        institution: String(row[6] || '').trim()
      });
    }
  }

  return parsedParticipants;
};
