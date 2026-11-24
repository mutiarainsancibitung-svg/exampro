/**
 * Utilitas Generator Template Excel (.csv) dan Parser untuk Bank Soal ExamPro
 * Format kompatibel 100% dengan Microsoft Excel, Google Sheets, dan LibreOffice Calc.
 */

export const EXCEL_TEMPLATE_HEADERS = [
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

export const SAMPLE_QUESTIONS_ROWS = [
  [
    '1',
    'single_choice',
    'Apa kepanjangan dari CBT dalam sistem asesmen pendidikan modern?',
    '',
    'Computer-Based Test',
    'Core Basic Technology',
    'Cloud-Based Tracking',
    'Central Binary Task',
    'A',
    '1'
  ],
  [
    '2',
    'single_choice',
    'Kurikulum Merdeka pada mata pelajaran PAI menekankan pada penguatan karakter melalui profil apa?',
    '',
    'Profil Pelajar Pancasila dan Rahmatan Lil Alamin',
    'Profil Generasi Emas Digital',
    'Profil Santri Berkualitas Global',
    'Profil Guru Profesional Masa Depan',
    'A',
    '1'
  ],
  [
    '3',
    'multiple_choice',
    'Manakah dari komponen berikut yang termasuk dalam pilar arsitektur Serverless Google Workspace yang digunakan ExamPro? (Pilihan Jamak)',
    '',
    'Google Apps Script (GAS)',
    'Google Sheets (Relational Spreadsheet)',
    'Google Drive (Cloud Asset Storage)',
    'Kubernetes Cluster On-Premise',
    'A,B,C',
    '2'
  ],
  [
    '4',
    'essay',
    'Jelaskan bagaimana pendekatan pembelajaran berbasis STREAM dan AI dapat diintegrasikan dalam materi Fikih / Akidah Akhlak!',
    '',
    '',
    '',
    '',
    '',
    'Rubrik: Relevansi pedagogis, pemanfaatan alat digital etis, dan penguatan pemahaman konsep nilai-nilai Islam.',
    '3'
  ]
];

/**
 * Unduh Template Excel (.csv dengan UTF-8 BOM untuk Excel)
 */
export const downloadExcelTemplate = () => {
  const delimiter = ',';
  
  // Header dan Baris Contoh
  const rows = [
    EXCEL_TEMPLATE_HEADERS,
    ...SAMPLE_QUESTIONS_ROWS
  ];

  // Format CSV aman dengan escaping kutip ganda
  const csvContent = rows.map(row => 
    row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(delimiter)
  ).join('\r\n');

  // Tambahkan BOM (Byte Order Mark) agar Microsoft Excel langsung membaca aksen & huruf dengan benar
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Template_Bank_Soal_ExamPro_PAI.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Parse File CSV/Excel yang diunggah oleh admin menjadi array soal
 */
export const parseUploadedQuestionsFile = async (file) => {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length <= 1) {
    throw new Error('File kosong atau hanya berisi baris header.');
  }

  // Helper parser CSV baris sederhana
  const parseLine = (line) => {
    const result = [];
    let insideQuote = false;
    let entry = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuote && line[i + 1] === '"') {
          entry += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        result.push(entry);
        entry = '';
      } else {
        entry += char;
      }
    }
    result.push(entry);
    return result;
  };

  const parsedQuestions = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length >= 3 && cols[2].trim()) {
      const typeRaw = cols[1]?.trim().toLowerCase();
      let type = 'single_choice';
      if (typeRaw.includes('multiple') || typeRaw.includes('jamak') || typeRaw.includes('kompleks')) {
        type = 'multiple_choice';
      } else if (typeRaw.includes('essay') || typeRaw.includes('uraian')) {
        type = 'essay';
      }

      const options = type !== 'essay' ? [
        { id: 'A', text: cols[4]?.trim() || '', image: '' },
        { id: 'B', text: cols[5]?.trim() || '', image: '' },
        { id: 'C', text: cols[6]?.trim() || '', image: '' },
        { id: 'D', text: cols[7]?.trim() || '', image: '' }
      ].filter(o => o.text !== '') : [];

      parsedQuestions.push({
        type: type,
        question_text: cols[2].trim(),
        image_url: cols[3]?.trim() || '',
        options: options,
        key_answer: cols[8]?.trim().toUpperCase() || '',
        weight: Number(cols[9]) || 1
      });
    }
  }

  return parsedQuestions;
};
