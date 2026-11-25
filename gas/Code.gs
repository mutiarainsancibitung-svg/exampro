/**
 * ExamPro Backend - Google Apps Script (GAS)
 * Versi: 2.5 (PAI Kemenag & FITK UIN Jakarta Edition)
 * - Dukungan Konfirmasi Data Peserta: Gender & Tanggal Lahir (Sesuai Gambar 3)
 * - Server-Side Scoring & Google Drive Media Storage
 * - Batch Import Soal dari Excel / CSV
 */

const SHEETS = {
  SESSIONS: 'Sessions',
  QUESTIONS: 'Questions',
  PARTICIPANTS: 'Participants',
  SUBMISSIONS: 'Submissions',
  ADMINS: 'Admins'
};

const HEADERS = {
  Sessions: ['session_id', 'title', 'type', 'token', 'duration_minutes', 'is_active', 'shuffle_questions', 'shuffle_options', 'show_score', 'created_at'],
  Questions: ['question_id', 'session_id', 'paket', 'type', 'question_text', 'image_url', 'options_json', 'key_answer', 'weight'],
  Participants: ['participant_id', 'session_id', 'username', 'password', 'full_name', 'gender', 'identifier', 'kelas', 'institution', 'paket', 'token_used', 'start_time', 'status'],
  Submissions: ['submission_id', 'participant_id', 'session_id', 'answers_json', 'pg_score', 'essay_score', 'total_score', 'tab_switch_count', 'submitted_at'],
  Admins: ['admin_id', 'username', 'password', 'name', 'role', 'is_active', 'created_at']
};

function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action;
    let responseData = {};

    switch (action) {
      case 'ping':
        responseData = { status: 'success', message: 'ExamPro PAI CBT API Active' };
        break;
      case 'setup':
      case 'checkAndRepair':
      case 'repairDatabase':
        responseData = checkAndRepairDatabase();
        break;
      case 'getSession':
        responseData = handleGetSession(params.token);
        break;
      case 'getExamQuestions':
        responseData = handleGetExamQuestions(params.token, params.participantId, params.paket);
        break;
      case 'getAdminDashboard':
        responseData = handleGetAdminDashboard(params.secretKey);
        break;
      case 'getAdminUsers':
        responseData = handleGetAdminUsers(params.secretKey);
        break;
      case 'getLiveProctor':
        responseData = handleGetLiveProctor(params);
        break;
      default:
        responseData = { status: 'error', message: 'Invalid GET action: ' + action };
    }
    return createJsonResponse(responseData);
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

function doPost(e) {
  try {
    let payload = {};
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = e.parameter || {};
      }
    } else {
      payload = e.parameter || {};
    }

    const action = payload.action;
    let responseData = {};

    switch (action) {
      case 'adminLogin':
        responseData = handleAdminLogin(payload);
        break;
      case 'participantLogin':
        responseData = handleParticipantLogin(payload);
        break;
      case 'startExam':
        responseData = handleStartExam(payload);
        break;
      case 'submitExam':
        responseData = handleSubmitExam(payload);
        break;
      case 'saveSession':
        responseData = handleSaveSession(payload);
        break;
      case 'deleteSession':
        responseData = handleDeleteSession(payload);
        break;
      case 'saveQuestion':
        responseData = handleSaveQuestion(payload);
        break;
      case 'batchSaveQuestions':
        responseData = handleBatchSaveQuestions(payload);
        break;
      case 'saveParticipant':
        responseData = handleSaveParticipant(payload);
        break;
      case 'batchSaveParticipants':
        responseData = handleBatchSaveParticipants(payload);
        break;
      case 'deleteParticipant':
        responseData = handleDeleteParticipant(payload);
        break;
      case 'batchDeleteParticipants':
        responseData = handleBatchDeleteParticipants(payload);
        break;
      case 'deleteAllParticipants':
        responseData = handleDeleteAllParticipants(payload);
        break;
      case 'deleteQuestion':
        responseData = handleDeleteQuestion(payload);
        break;
      case 'deleteQuestionsByPaket':
        responseData = handleDeleteQuestionsByPaket(payload);
        break;
      case 'gradeEssay':
        responseData = handleGradeEssay(payload);
        break;
      case 'uploadMedia':
        responseData = handleUploadMedia(payload);
        break;
      case 'saveAdminUser':
        responseData = handleSaveAdminUser(payload);
        break;
      case 'deleteAdminUser':
        responseData = handleDeleteAdminUser(payload);
        break;
      case 'checkAndRepair':
      case 'repairDatabase':
        responseData = checkAndRepairDatabase();
        break;
      case 'exportFullBackup':
        responseData = handleExportFullBackup(payload);
        break;
      case 'restoreFullBackup':
        responseData = handleRestoreFullBackup(payload);
        break;
      case 'updateExamProgress':
        responseData = handleUpdateExamProgress(payload);
        break;
      case 'getLiveProctor':
        responseData = handleGetLiveProctor(payload);
        break;
      case 'proctorAction':
        responseData = handleProctorAction(payload);
        break;
      default:
        responseData = { status: 'error', message: 'Invalid POST action: ' + action };
    }
    return createJsonResponse(responseData);
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function setupDatabaseSheets() {
  return checkAndRepairDatabase();
}

/**
 * Fungsi Cek & Perbaiki Database (Google Sheets)
 * - Memeriksa keberadaan 5 Sheet (Sessions, Questions, Participants, Submissions, Admins)
 * - Memeriksa apakah header kolom di baris 1 sudah ada
 * - Jika baris 1 kosong / hilang: langsung mengisi header standar Kemenag FITK UIN
 * - Jika baris 1 berisi data (tanpa header): menyisipkan baris baru di baris 1 sebagai header tanpa menghilangkan data
 * - Memberikan format visual resmi (Warna Kemenag #0D7A5F, teks putih tebal, baris 1 dibekukan)
 * - Mengisi data default jika sheet masih baru/kosong
 */
function checkAndRepairDatabase() {
  const ss = getSpreadsheet();
  const report = [];

  for (const sheetName in HEADERS) {
    const expectedHeaders = HEADERS[sheetName];
    let sheet = ss.getSheetByName(sheetName);
    let actionTaken = '';

    // 1. Jika sheet belum ada sama sekali
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(expectedHeaders);
      formatHeaderRow(sheet, expectedHeaders.length);
      actionTaken = 'Sheet baru berhasil dibuat beserta header kolom';
    } else {
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();

      // 2. Jika sheet ada tapi 0 baris / 0 kolom
      if (lastRow === 0 || lastCol === 0) {
        sheet.appendRow(expectedHeaders);
        formatHeaderRow(sheet, expectedHeaders.length);
        actionTaken = 'Sheet kosong, header standar berhasil ditambahkan';
      } else {
        // 3. Periksa isi baris 1
        const maxCol = Math.max(lastCol, expectedHeaders.length);
        const row1Values = sheet.getRange(1, 1, 1, maxCol).getValues()[0];
        
        // Cek apakah baris 1 seluruhnya kosong / null
        const isRow1Blank = row1Values.slice(0, expectedHeaders.length).every(function(v) {
          return v === '' || v === null || v === undefined;
        });

        const firstCell = String(row1Values[0] || '').trim().toLowerCase();
        const expectedFirstCell = String(expectedHeaders[0]).trim().toLowerCase();

        if (isRow1Blank) {
          // Baris 1 kosong: langsung isi dengan header
          sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
          formatHeaderRow(sheet, expectedHeaders.length);
          actionTaken = 'Baris 1 yang kosong berhasil diisi header kolom';
        } else if (firstCell === expectedFirstCell) {
          // Baris 1 sudah merupakan header: periksa apakah ada kolom yang kurang / perlu diperbarui
          let needsUpdate = false;
          for (let c = 0; c < expectedHeaders.length; c++) {
            if (String(row1Values[c] || '').trim().toLowerCase() !== String(expectedHeaders[c]).trim().toLowerCase()) {
              needsUpdate = true;
              break;
            }
          }
          if (needsUpdate || lastCol < expectedHeaders.length) {
            sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
            formatHeaderRow(sheet, expectedHeaders.length);
            actionTaken = 'Header kolom disinkronkan ke struktur terbaru';
          } else {
            formatHeaderRow(sheet, expectedHeaders.length);
            actionTaken = 'Header kolom sudah valid dan terformat rapi';
          }
        } else {
          // Baris 1 berisi DATA peserta/soal/dll (bukan header)!
          // Sisipkan baris baru di atas baris 1 agar data pengguna TIDAK hilang
          sheet.insertRowBefore(1);
          sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
          formatHeaderRow(sheet, expectedHeaders.length);
          actionTaken = 'Data terdeteksi tanpa header; baris 1 baru disisipkan sebagai header';
        }
      }
    }

    // 4. Inisialisasi data bawaan jika sheet baru memiliki baris header saja
    if (sheet.getLastRow() <= 1) {
      if (sheetName === SHEETS.ADMINS) {
        const defaultAdmins = [
          ['ADM-001', 'admin', 'admin123', 'Administrator Utama', 'superadmin', true, new Date().toISOString()],
          ['ADM-002', 'dosen_pai', 'guru2026', 'Dosen PAI Pengampu', 'instructor', true, new Date().toISOString()],
          ['ADM-003', 'pengawas01', 'proctor2026', 'Pengawas Ruang Ujian', 'proctor', true, new Date().toISOString()]
        ];
        defaultAdmins.forEach(function(r) { sheet.appendRow(r); });
        actionTaken += ' + Akun bawaan admin ditambahkan';
      } else if (sheetName === SHEETS.SESSIONS) {
        sheet.appendRow([
          'SES-001',
          'Pelatihan Guru PAI - Penguatan Kompetensi 2026',
          'pretest',
          'PAI2026',
          60,
          true,
          true,
          true,
          true,
          new Date().toISOString()
        ]);
        actionTaken += ' + Sesi ujian awal ditambahkan';
      }
    }

    report.push({
      sheet: sheetName,
      status: 'OK',
      action: actionTaken,
      totalRows: sheet.getLastRow(),
      totalCols: sheet.getLastColumn()
    });
  }

  // 5. Bersihkan Sheet1 bawaan Google Sheets jika sheet sistem sudah lengkap
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  // 6. Deduplikasi peserta ganda di sheet Participants (menjaga agar peserta tetap sesuai jumlah asli / 38)
  const dedupResult = deduplicateParticipantsInSheet(ss);
  if (dedupResult && dedupResult.removedCount > 0) {
    report.push({
      sheet: SHEETS.PARTICIPANTS,
      status: 'DEDUPLICATED',
      action: 'Berhasil membersihkan ' + dedupResult.removedCount + ' baris duplikat peserta.',
      totalRows: ss.getSheetByName(SHEETS.PARTICIPANTS).getLastRow()
    });
  }

  // 7. Hitung ulang submisi yang memiliki nilai 0 akibat mismatch ID sesi sebelumnya
  const recalcResult = recalculateZeroSubmissions(ss);
  if (recalcResult && recalcResult.recalculatedCount > 0) {
    report.push({
      sheet: SHEETS.SUBMISSIONS,
      status: 'RECALCULATED',
      action: 'Berhasil menghitung ulang ' + recalcResult.recalculatedCount + ' skor ujian yang bernilai 0.',
      totalRows: ss.getSheetByName(SHEETS.SUBMISSIONS).getLastRow()
    });
  }

  return {
    status: 'success',
    message: 'Pemeriksaan dan perbaikan database Google Sheets selesai.',
    timestamp: new Date().toISOString(),
    report: report
  };
}

function formatHeaderRow(sheet, numCols) {
  try {
    sheet.getRange(1, 1, 1, numCols)
      .setFontWeight('bold')
      .setBackground('#0D7A5F')
      .setFontColor('#FFFFFF')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    sheet.setRowHeight(1, 35);
    sheet.setFrozenRows(1);
  } catch (e) {}
}

function getSheetDataAsObjects(sheetName, existingSs) {
  const ss = existingSs || getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    checkAndRepairDatabase();
    sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];

  // Optimal range read: Hanya membaca area cell data yang ada nilainya (Tahap 4)
  const rows = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  if (rows.length <= 1) return [];

  const headers = rows[0];
  const data = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Abaikan baris kosong
    let isBlank = true;
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== '' && row[c] !== null && row[c] !== undefined) {
        isBlank = false;
        break;
      }
    }
    if (isBlank) continue;

    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const h = String(headers[j] || '').trim();
      if (h) {
        obj[h] = row[j];
      }
    }
    obj._rowIndex = i + 1;
    data.push(obj);
  }
  return data;
}

function verifyAdminSecret(secretKey) {
  const scriptProp = PropertiesService.getScriptProperties().getProperty('ADMIN_SECRET_KEY');
  const validKey = scriptProp || 'admin123';
  return secretKey && secretKey.trim() === validKey.trim();
}

function handleAdminLogin(param) {
  // 1. Dukungan jika parameter berupa string Secret Key / PIN langsung
  if (typeof param === 'string') {
    if (verifyAdminSecret(param)) {
      return {
        status: 'success',
        message: 'Otentikasi PIN admin berhasil',
        secretKey: param,
        user: { admin_id: 'ADM-001', username: 'admin', name: 'Administrator Utama', role: 'superadmin' }
      };
    }
    return { status: 'error', message: 'Kredensial atau PIN Admin salah' };
  }

  // 2. Dukungan jika parameter berupa object payload
  const payload = param || {};
  if (payload.secretKey && !payload.username) {
    if (verifyAdminSecret(payload.secretKey)) {
      return {
        status: 'success',
        message: 'Otentikasi PIN admin berhasil',
        secretKey: payload.secretKey,
        user: { admin_id: 'ADM-001', username: 'admin', name: 'Administrator Utama', role: 'superadmin' }
      };
    }
    return { status: 'error', message: 'Kredensial atau PIN Admin salah' };
  }

  const uInput = String(payload.username || '').trim().toLowerCase();
  const pInput = String(payload.password || '').trim();

  if (!uInput || !pInput) {
    return { status: 'error', message: 'Username dan Password wajib diisi!' };
  }

  // Cek pada Sheet Admins
  let admins = getSheetDataAsObjects(SHEETS.ADMINS);
  if (!admins || admins.length === 0) {
    initializeDefaultAdmins();
    admins = getSheetDataAsObjects(SHEETS.ADMINS);
  }

  const matched = admins.find(a =>
    String(a.username).trim().toLowerCase() === uInput &&
    String(a.password).trim() === pInput
  );

  if (matched) {
    if (String(matched.is_active).toUpperCase() === 'FALSE') {
      return { status: 'error', message: 'Akun admin Anda sedang dinonaktifkan oleh Administrator.' };
    }
    return {
      status: 'success',
      secretKey: 'admin123',
      user: {
        admin_id: matched.admin_id,
        username: matched.username,
        name: matched.name,
        role: matched.role || 'instructor'
      },
      message: `Selamat datang, ${matched.name}!`
    };
  }

  // Akun bawaan darurat (fail-safe)
  const defaultAccounts = [
    { admin_id: 'ADM-001', username: 'admin', password: 'admin123', name: 'Administrator Utama', role: 'superadmin' },
    { admin_id: 'ADM-002', username: 'dosen_pai', password: 'guru2026', name: 'Dosen PAI Pengampu', role: 'instructor' },
    { admin_id: 'ADM-003', username: 'pengawas01', password: 'proctor2026', name: 'Pengawas Ruang Ujian', role: 'proctor' }
  ];
  const defMatch = defaultAccounts.find(a => a.username === uInput && a.password === pInput);
  if (defMatch) {
    return {
      status: 'success',
      secretKey: 'admin123',
      user: {
        admin_id: defMatch.admin_id,
        username: defMatch.username,
        name: defMatch.name,
        role: defMatch.role
      },
      message: `Selamat datang, ${defMatch.name}!`
    };
  }

  return { status: 'error', message: 'Username atau Password salah! Periksa kembali akun login Anda.' };
}

function getMinuteRotatingToken(sessionSalt, offsetMinutes) {
  const currentMinuteEpoch = Math.floor(new Date().getTime() / 60000) + (offsetMinutes || 0);
  const seedString = (sessionSalt || 'PAI_TOT') + '_MIN_' + currentMinuteEpoch;
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = ((hash << 5) - hash) + seedString.charCodeAt(i);
    hash |= 0;
  }
  const CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let token = '';
  let pseudoRandom = Math.abs(hash);
  for (let i = 0; i < 6; i++) {
    pseudoRandom = (pseudoRandom * 9301 + 49297) % 233280;
    const index = Math.floor((pseudoRandom / 233280) * CHARSET.length);
    token += CHARSET[index];
  }
  return token;
}

function isRotatingTokenMatch(inputToken, sessionId, staticToken) {
  if (!inputToken) return false;
  const clean = String(inputToken).trim().toUpperCase();
  if (staticToken && clean === String(staticToken).trim().toUpperCase()) return true;
  const t0 = getMinuteRotatingToken(sessionId, 0);
  const t1 = getMinuteRotatingToken(sessionId, -1);
  const td0 = getMinuteRotatingToken('PAI_TOT', 0);
  const td1 = getMinuteRotatingToken('PAI_TOT', -1);
  return clean === t0 || clean === t1 || clean === td0 || clean === td1;
}

/**
 * Invalidation Cache Ujian ketika Admin Mengubah Data (Tahap 2)
 */
function clearExamCache(sessionId) {
  try {
    const cache = CacheService.getScriptCache();
    const commonPakets = ['pretest', 'postest', 'all', 'paket 1', 'paket 2', 'paket a', 'paket b'];
    if (sessionId) {
      commonPakets.forEach(function(p) {
        cache.remove('q_master_' + sessionId + '_' + p);
      });
      cache.remove('sess_id_' + sessionId);
      cache.remove('scoring_keys_' + sessionId);
    }
    cache.remove('all_sessions_cache');
  } catch (e) {}
}

function handleGetSession(token, sessionSalt) {
  if (!token) return { status: 'error', message: 'Token tidak boleh kosong' };
  
  const cleanToken = String(token).trim().toUpperCase();
  const cache = CacheService.getScriptCache();
  const cacheKey = 'sess_token_' + cleanToken;

  // 1. Cek RAM CacheService untuk respons kilat (0 ms Google Sheets)
  const cachedSess = cache.get(cacheKey);
  if (cachedSess) {
    try {
      const parsedSess = JSON.parse(cachedSess);
      return { status: 'success', session: parsedSess, cached: true };
    } catch (e) {}
  }

  // 2. Jika belum ada di cache, baca dari spreadsheet
  const sessions = getSheetDataAsObjects(SHEETS.SESSIONS);
  let session = sessions.find(s => String(s.token).trim().toUpperCase() === cleanToken);

  if (!session) {
    session = sessions.find(s => isRotatingTokenMatch(token, s.session_id, s.token));
  }
  if (!session && sessions.length > 0) {
    if (isRotatingTokenMatch(token, sessionSalt || 'PAI_TOT', sessions[0].token)) {
      session = sessions[0];
    }
  }

  if (!session) {
    return { status: 'error', message: 'Token ujian tidak ditemukan atau sudah kadaluarsa (token berganti setiap 1 menit)' };
  }

  if (String(session.is_active).toUpperCase() !== 'TRUE') {
    return { status: 'error', message: 'Sesi ujian ini sedang nonaktif atau sudah ditutup' };
  }

  const sessionObj = {
    session_id: session.session_id,
    title: session.title,
    type: session.type,
    token: session.token,
    duration_minutes: Number(session.duration_minutes),
    shuffle_questions: String(session.shuffle_questions).toUpperCase() === 'TRUE',
    shuffle_options: String(session.shuffle_options).toUpperCase() === 'TRUE',
    show_score: String(session.show_score).toUpperCase() === 'TRUE'
  };

  // Simpan ke RAM cache selama 30 menit (1800 detik)
  try {
    cache.put(cacheKey, JSON.stringify(sessionObj), 1800);
  } catch (e) {}

  return {
    status: 'success',
    session: sessionObj
  };
}

/**
 * Pengambilan Soal Ujian dengan Akselerasi RAM Caching (Tahap 2)
 * Ribuan request peserta disajikan dari RAM tanpa menyentuh Google Sheets!
 */
function handleGetExamQuestions(token, participantId, paket) {
  const sessionRes = handleGetSession(token);
  if (sessionRes.status !== 'success') return sessionRes;

  const session = sessionRes.session;
  const targetPaket = String(paket || session.type || 'Pretest').trim().toLowerCase();
  const cache = CacheService.getScriptCache();
  const qCacheKey = 'q_master_' + session.session_id + '_' + targetPaket;

  let safeMasterQuestions = null;

  // 1. Cek apakah master soal untuk sesi & paket ini sudah ada di RAM Cache
  const cachedQ = cache.get(qCacheKey);
  if (cachedQ) {
    try {
      safeMasterQuestions = JSON.parse(cachedQ);
    } catch (e) {
      safeMasterQuestions = null;
    }
  }

  // 2. Jika belum ada di RAM Cache, baca dari Google Sheets dan proses sekali saja
  if (!safeMasterQuestions || safeMasterQuestions.length === 0) {
    const allQuestions = getSheetDataAsObjects(SHEETS.QUESTIONS);
    let targetQuestions = allQuestions;
    if (paket) {
      const byPaket = allQuestions.filter(q => String(q.paket || 'Pretest').toLowerCase() === targetPaket);
      if (byPaket.length > 0) targetQuestions = byPaket;
    }

    if (targetQuestions.length === 0) {
      return { status: 'error', message: 'Belum ada soal pada paket ujian ini' };
    }

    // Sensor kunci jawaban & bersihkan struktur opsi
    safeMasterQuestions = targetQuestions.map(function(q) {
      let parsedOptions = [];
      try {
        parsedOptions = typeof q.options_json === 'string' ? JSON.parse(q.options_json) : (q.options_json || []);
      } catch(e) {
        parsedOptions = [];
      }

      return {
        question_id: q.question_id,
        paket: q.paket || 'Pretest',
        type: q.type,
        question_text: q.question_text,
        image_url: q.image_url || '',
        options: parsedOptions,
        weight: Number(q.weight) || 1
      };
    });

    // Simpan ke RAM Cache selama 30 menit (1800 detik)
    try {
      cache.put(qCacheKey, JSON.stringify(safeMasterQuestions), 1800);
    } catch (e) {}
  }

  // 3. Terapkan pengacakan unik per peserta (dari master soal yang diambil dari RAM)
  let participantQuestions = safeMasterQuestions.map(function(q) {
    let opts = q.options ? q.options.slice() : [];
    if (session.shuffle_options && opts.length > 0 && q.type !== 'essay') {
      opts = shuffleArray(opts);
    }
    return {
      question_id: q.question_id,
      paket: q.paket,
      type: q.type,
      question_text: q.question_text,
      image_url: q.image_url,
      options: opts,
      weight: q.weight
    };
  });

  if (session.shuffle_questions) {
    participantQuestions = shuffleArray(participantQuestions);
  }

  return {
    status: 'success',
    session: session,
    questions: participantQuestions,
    paket: paket || 'Pretest',
    cached: !!cachedQ
  };
}

/**
 * Registrasi Peserta (Mendukung Gender & Token Berputar Dinamis)
 */
function handleStartExam(payload) {
  const { token, fullName, identifier, gender, sessionSalt } = payload;
  if (!token || !fullName || !identifier) {
    return { status: 'error', message: 'Data peserta wajib diisi lengkap' };
  }

  const sessionRes = handleGetSession(token, sessionSalt);
  if (sessionRes.status !== 'success') return sessionRes;

  const session = sessionRes.session;
  const ss = getSpreadsheet();
  const partSheet = ss.getSheetByName(SHEETS.PARTICIPANTS);

  const cleanIdentifier = String(identifier).trim();
  const now = new Date().toISOString();

  let existingRow = -1;
  let participantId = null;

  // Cari apakah peserta sudah terdaftar di sheet peserta berdasarkan username / identifier
  if (partSheet && partSheet.getLastRow() > 1) {
    const data = partSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const rowPId = String(data[i][0]).trim();
      const rowUsername = String(data[i][2]).trim().toLowerCase();
      const rowIdent = String(data[i][6]).trim().toLowerCase();

      if (rowUsername === cleanIdentifier.toLowerCase() || rowIdent === cleanIdentifier.toLowerCase() || rowPId === cleanIdentifier) {
        existingRow = i + 1;
        participantId = rowPId;
        break;
      }
    }
  }

  if (existingRow > 0) {
    // Update baris peserta yang sudah ada (status: in_progress, start_time, token_used, session_id)
    const statusCol = HEADERS.Participants.indexOf('status') + 1;
    const startCol = HEADERS.Participants.indexOf('start_time') + 1;
    const tokenCol = HEADERS.Participants.indexOf('token_used') + 1;
    const sessCol = HEADERS.Participants.indexOf('session_id') + 1;

    if (statusCol > 0) partSheet.getRange(existingRow, statusCol).setValue('in_progress');
    if (startCol > 0) partSheet.getRange(existingRow, startCol).setValue(now);
    if (tokenCol > 0) partSheet.getRange(existingRow, tokenCol).setValue(token.trim().toUpperCase());
    if (sessCol > 0) partSheet.getRange(existingRow, sessCol).setValue(session.session_id);
  } else {
    // Jika peserta baru (walk-in), buat baris lengkap 13 kolom
    participantId = 'P-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000);
    partSheet.appendRow([
      participantId,
      session.session_id,
      cleanIdentifier,
      'kemenag2026',
      fullName.trim(),
      gender || '-',
      cleanIdentifier,
      payload.kelas || 'Kelas A',
      payload.institution || '',
      payload.paket || session.type || 'Pretest',
      token.trim().toUpperCase(),
      now,
      'in_progress'
    ]);
  }

  // Update Cache Live Proctor agar peserta langsung muncul di Live Monitor
  const cache = CacheService.getScriptCache();
  const cacheKey = 'proctor_' + session.session_id;
  let proctorData = {};
  const cachedStr = cache.get(cacheKey);
  if (cachedStr) {
    try { proctorData = JSON.parse(cachedStr); } catch (e) {}
  }
  proctorData[participantId] = {
    participantId: participantId,
    sessionId: session.session_id,
    answeredCount: 0,
    totalQuestions: 25,
    violations: 0,
    lastHeartbeat: now,
    status: 'in_progress'
  };
  proctorData[cleanIdentifier.toLowerCase()] = proctorData[participantId];
  try { cache.put(cacheKey, JSON.stringify(proctorData), 10800); } catch (e) {}

  return {
    status: 'success',
    participantId: participantId,
    startTime: now,
    session: session
  };
}

function handleSubmitExam(payload) {
  const { participantId, sessionId, answers, violations } = payload;
  if (!participantId || !sessionId) {
    return { status: 'error', message: 'Data submission tidak lengkap' };
  }

  const ss = getSpreadsheet();
  const allQuestions = getSheetDataAsObjects(SHEETS.QUESTIONS, ss);
  const userAnswers = answers || {};
  const answeredKeys = Object.keys(userAnswers);

  // Ambil soal yang relevan: prioritaskan butir soal yang benar-benar dijawab peserta
  let questions = [];
  if (answeredKeys.length > 0) {
    questions = allQuestions.filter(q => answeredKeys.includes(String(q.question_id)));
  }
  if (questions.length === 0) {
    questions = allQuestions.filter(q => String(q.session_id) === String(sessionId));
  }
  if (questions.length === 0) {
    questions = allQuestions;
  }

  let totalPgMaxScore = 0;
  let earnedPgScore = 0;
  let hasEssay = false;

  questions.forEach(q => {
    const qWeight = Number(q.weight) || 1;
    const userAnswer = userAnswers[q.question_id];

    if (q.type === 'single_choice') {
      totalPgMaxScore += qWeight;
      if (userAnswer && String(userAnswer).trim().toUpperCase() === String(q.key_answer).trim().toUpperCase()) {
        earnedPgScore += qWeight;
      }
    } else if (q.type === 'multiple_choice') {
      totalPgMaxScore += qWeight;
      const userArr = Array.isArray(userAnswer)
        ? userAnswer.map(a => String(a).trim().toUpperCase()).sort().join(',')
        : String(userAnswer || '').split(',').map(a => a.trim().toUpperCase()).sort().join(',');
      const keyArr = String(q.key_answer).split(',').map(a => a.trim().toUpperCase()).sort().join(',');
      if (userArr === keyArr && userArr.length > 0) {
        earnedPgScore += qWeight;
      }
    } else if (q.type === 'essay') {
      hasEssay = true;
    }
  });

  const pgScoreCalculated = totalPgMaxScore > 0 ? Math.round((earnedPgScore / totalPgMaxScore) * 100) : 0;
  const initialEssayScore = 0;
  const totalScore = pgScoreCalculated;

  const submissionId = 'SUB-' + new Date().getTime();
  const submittedAt = new Date().toISOString();

  const subSheet = ss.getSheetByName(SHEETS.SUBMISSIONS);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    subSheet.appendRow([
      submissionId,
      participantId,
      sessionId,
      JSON.stringify(userAnswers),
      pgScoreCalculated,
      initialEssayScore,
      totalScore,
      Number(violations) || 0,
      submittedAt
    ]);

    // Update status peserta di sheet participants
    const partSheet = ss.getSheetByName(SHEETS.PARTICIPANTS);
    if (partSheet && partSheet.getLastRow() > 1) {
      const partRows = partSheet.getDataRange().getValues();
      const statusCol = HEADERS.Participants.indexOf('status') + 1;
      const colToUpdate = statusCol > 0 ? statusCol : 13;

      for (let i = 1; i < partRows.length; i++) {
        const rowPId = String(partRows[i][0]).trim();
        const rowUsername = String(partRows[i][2]).trim().toLowerCase();
        if (rowPId === String(participantId).trim() || rowUsername === String(participantId).trim().toLowerCase()) {
          partSheet.getRange(i + 1, colToUpdate).setValue('submitted');
          break;
        }
      }
    }
  } finally {
    lock.releaseLock();
  }

  // Update live proctor cache agar status berubah jadi 'submitted'
  const cache = CacheService.getScriptCache();
  const cacheKey = 'proctor_' + sessionId;
  let proctorData = {};
  const cachedStr = cache.get(cacheKey);
  if (cachedStr) {
    try { proctorData = JSON.parse(cachedStr); } catch (e) {}
  }
  if (proctorData[participantId]) {
    proctorData[participantId].status = 'submitted';
    proctorData[participantId].answeredCount = Object.keys(userAnswers).length;
  }
  try { cache.put(cacheKey, JSON.stringify(proctorData), 10800); } catch (e) {}

  const allSessions = getSheetDataAsObjects(SHEETS.SESSIONS, getSpreadsheet());
  const sessionData = allSessions.find(s => String(s.session_id) === String(sessionId)) || allSessions[0] || {};

  // Sesuai permintaan: Soal PG selalu munculkan skornya secara langsung ke peserta,
  // kecuali jika panitia secara eksplisit mematikan di pengaturan sesi (show_score === false)
  const isExplicitlyHidden = sessionData.show_score === false ||
    String(sessionData.show_score).toLowerCase() === 'false' ||
    String(sessionData.show_score).toLowerCase() === 'tidak';
  const showScore = !isExplicitlyHidden;

  return {
    status: 'success',
    submissionId: submissionId,
    showScore: showScore,
    score: {
      pgScore: pgScoreCalculated,
      hasEssay: hasEssay,
      totalScore: totalScore
    },
    message: 'Ujian berhasil dikirim dan tersimpan dengan aman.'
  };
}

function handleGetAdminDashboard(secretKey) {
  if (!verifyAdminSecret(secretKey)) {
    return { status: 'error', message: 'Akses ditolak: Secret Key salah' };
  }

  const ss = getSpreadsheet(); // 1 kali buka spreadsheet saja (Optimasi Tahap 4)

  const sessions = getSheetDataAsObjects(SHEETS.SESSIONS, ss);
  const questions = getSheetDataAsObjects(SHEETS.QUESTIONS, ss);
  const participants = getSheetDataAsObjects(SHEETS.PARTICIPANTS, ss);
  const submissions = getSheetDataAsObjects(SHEETS.SUBMISSIONS, ss);
  let admins = getSheetDataAsObjects(SHEETS.ADMINS, ss);
  if (!admins || admins.length === 0) {
    initializeDefaultAdmins(ss);
    admins = getSheetDataAsObjects(SHEETS.ADMINS, ss);
  }

  const parsedQuestions = questions.map(function(q) {
    let opts = [];
    try {
      opts = typeof q.options_json === 'string' ? JSON.parse(q.options_json) : (q.options_json || []);
    } catch(e) {
      opts = [];
    }
    return {
      question_id: q.question_id,
      session_id: q.session_id,
      paket: q.paket || 'Pretest',
      type: q.type || 'single_choice',
      question_text: q.question_text || '',
      image_url: q.image_url || '',
      options: opts,
      key_answer: q.key_answer || '',
      weight: Number(q.weight) || 1
    };
  });

  return {
    status: 'success',
    sessions: sessions,
    questions: parsedQuestions,
    participants: participants,
    submissions: submissions,
    admins: admins
  };
}

function initializeDefaultAdmins(existingSs) {
  const ss = existingSs || getSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.ADMINS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.ADMINS);
    sheet.appendRow(HEADERS.Admins);
    formatHeaderRow(sheet, HEADERS.Admins.length);
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    const defaultAdmins = [
      ['ADM-001', 'admin', 'admin123', 'Administrator Utama', 'superadmin', true, new Date().toISOString()],
      ['ADM-002', 'dosen_pai', 'guru2026', 'Dosen PAI Pengampu', 'instructor', true, new Date().toISOString()],
      ['ADM-003', 'pengawas01', 'proctor2026', 'Pengawas Ruang Ujian', 'proctor', true, new Date().toISOString()]
    ];
    defaultAdmins.forEach(function(row) { sheet.appendRow(row); });
  }
}

function handleGetAdminUsers(secretKey) {
  if (!verifyAdminSecret(secretKey)) {
    return { status: 'error', message: 'Akses ditolak: Secret Key salah' };
  }
  const ss = getSpreadsheet();
  let admins = getSheetDataAsObjects(SHEETS.ADMINS, ss);
  if (!admins || admins.length === 0) {
    initializeDefaultAdmins(ss);
    admins = getSheetDataAsObjects(SHEETS.ADMINS, ss);
  }
  return { status: 'success', admins: admins };
}

function handleSaveAdminUser(payload) {
  const { secretKey, adminData } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };
  if (!adminData || !adminData.username || !adminData.name) {
    return { status: 'error', message: 'Username dan Nama Admin wajib diisi' };
  }

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.ADMINS);
  if (!sheet) {
    initializeDefaultAdmins();
    sheet = ss.getSheetByName(SHEETS.ADMINS);
  }

  const rows = sheet.getDataRange().getValues();
  const adminId = adminData.admin_id || ('ADM-' + new Date().getTime());
  const cleanUsername = String(adminData.username).trim().toLowerCase();

  let existingRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(adminId) || String(rows[i][1]).toLowerCase() === cleanUsername) {
      existingRow = i + 1;
      break;
    }
  }

  const rowData = [
    adminId,
    cleanUsername,
    adminData.password || (existingRow > 0 ? rows[existingRow - 1][2] : 'admin123'),
    adminData.name,
    adminData.role || 'instructor',
    adminData.is_active !== false && String(adminData.is_active).toUpperCase() !== 'FALSE',
    adminData.created_at || new Date().toISOString()
  ];

  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return { status: 'success', message: 'Data akun admin berhasil disimpan', adminId: adminId };
}

function handleDeleteAdminUser(payload) {
  const { secretKey, adminId } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.ADMINS);
  if (!sheet) return { status: 'error', message: 'Sheet Admins tidak ditemukan' };

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(adminId)) {
      if (String(rows[i][4]) === 'superadmin') {
        const superCount = rows.filter((r, idx) => idx > 0 && String(r[4]) === 'superadmin').length;
        if (superCount <= 1) {
          return { status: 'error', message: 'Tidak dapat menghapus satu-satunya akun Super Admin!' };
        }
      }
      sheet.deleteRow(i + 1);
      return { status: 'success', message: 'Akun admin berhasil dihapus' };
    }
  }
  return { status: 'error', message: 'Pengguna admin tidak ditemukan' };
}

function handleSaveSession(payload) {
  const { secretKey, session } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };
  if (!session || !session.title || !session.token) {
    return { status: 'error', message: 'Judul dan Token sesi wajib diisi' };
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.SESSIONS);
  const rows = sheet.getDataRange().getValues();
  const sessionId = session.session_id || ('SES-' + new Date().getTime());
  
  let existingRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(sessionId)) {
      existingRow = i + 1;
      break;
    }
  }

  const rowData = [
    sessionId,
    session.title,
    session.type || 'pretest',
    String(session.token).trim().toUpperCase(),
    Number(session.duration_minutes) || 60,
    session.is_active !== false,
    session.shuffle_questions !== false,
    session.shuffle_options !== false,
    session.show_score !== false,
    session.created_at || new Date().toISOString()
  ];

  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  clearExamCache(sessionId);
  return { status: 'success', message: 'Sesi ujian berhasil disimpan', sessionId: sessionId };
}

function handleDeleteSession(payload) {
  const { secretKey, sessionId, archiveSubmissions } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };

  const ss = getSpreadsheet();
  const sessionSheet = ss.getSheetByName(SHEETS.SESSIONS);
  if (!sessionSheet) return { status: 'error', message: 'Sheet Sessions tidak ditemukan' };

  const sessionRows = sessionSheet.getDataRange().getValues();
  let sessionFound = false;
  let sessionTitle = '';

  for (let i = 1; i < sessionRows.length; i++) {
    if (String(sessionRows[i][0]) === String(sessionId)) {
      sessionTitle = String(sessionRows[i][1] || '');
      sessionSheet.deleteRow(i + 1);
      sessionFound = true;
      break;
    }
  }

  if (!sessionFound) {
    return { status: 'error', message: 'Sesi tidak ditemukan' };
  }

  // Auto-Arsipkan Submissions / Rekap Nilai jika ada
  let archivedCount = 0;
  const subSheet = ss.getSheetByName(SHEETS.SUBMISSIONS);
  if (subSheet && archiveSubmissions !== false) {
    const subRows = subSheet.getDataRange().getValues();
    const matchedSubs = [];
    for (let r = 1; r < subRows.length; r++) {
      if (String(subRows[r][2]) === String(sessionId)) {
        matchedSubs.push(subRows[r]);
      }
    }

    if (matchedSubs.length > 0) {
      const archiveSheetName = 'Archive_Submissions';
      let arcSheet = ss.getSheetByName(archiveSheetName);
      if (!arcSheet) {
        arcSheet = ss.insertSheet(archiveSheetName);
        const headers = [...HEADERS.Submissions, 'archived_at', 'session_title'];
        arcSheet.appendRow(headers);
        formatHeaderRow(arcSheet, headers.length);
      }

      const now = new Date().toISOString();
      matchedSubs.forEach(function(row) {
        arcSheet.appendRow([...row, now, sessionTitle]);
      });
      archivedCount = matchedSubs.length;
    }
  }

  clearExamCache(sessionId);
  return {
    status: 'success',
    message: `Sesi "${sessionTitle || sessionId}" berhasil dihapus.${archivedCount > 0 ? ` Sebanyak ${archivedCount} riwayat nilai berhasil diarsipkan.` : ''}`,
    archivedCount: archivedCount
  };
}

function handleExportFullBackup(payload) {
  const { secretKey } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };

  const ss = getSpreadsheet();
  return {
    status: 'success',
    exportedAt: new Date().toISOString(),
    sessions: getSheetDataAsObjects(SHEETS.SESSIONS, ss),
    questions: getSheetDataAsObjects(SHEETS.QUESTIONS, ss),
    participants: getSheetDataAsObjects(SHEETS.PARTICIPANTS, ss),
    submissions: getSheetDataAsObjects(SHEETS.SUBMISSIONS, ss),
    admins: getSheetDataAsObjects(SHEETS.ADMINS, ss)
  };
}

function handleRestoreFullBackup(payload) {
  const { secretKey, backupData, mode } = payload; // mode: 'append' | 'overwrite'
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };
  if (!backupData) return { status: 'error', message: 'Data backup kosong' };

  const ss = getSpreadsheet();
  const report = {};

  const sheetKeys = [
    { key: 'sessions', sheetName: SHEETS.SESSIONS, headers: HEADERS.Sessions },
    { key: 'questions', sheetName: SHEETS.QUESTIONS, headers: HEADERS.Questions },
    { key: 'participants', sheetName: SHEETS.PARTICIPANTS, headers: HEADERS.Participants },
    { key: 'submissions', sheetName: SHEETS.SUBMISSIONS, headers: HEADERS.Submissions },
    { key: 'admins', sheetName: SHEETS.ADMINS, headers: HEADERS.Admins }
  ];

  sheetKeys.forEach(function(item) {
    const list = backupData[item.key] || [];
    if (!Array.isArray(list) || list.length === 0) return;

    let sheet = ss.getSheetByName(item.sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(item.sheetName);
      sheet.appendRow(item.headers);
      formatHeaderRow(sheet, item.headers.length);
    }

    if (mode === 'overwrite') {
      sheet.clearContents();
      sheet.appendRow(item.headers);
      formatHeaderRow(sheet, item.headers.length);
    }

    let inserted = 0;
    list.forEach(function(obj) {
      const row = item.headers.map(function(h) {
        const val = obj[h];
        if (typeof val === 'object' && val !== null) {
          return JSON.stringify(val);
        }
        return val !== undefined ? val : '';
      });
      sheet.appendRow(row);
      inserted++;
    });
    report[item.key] = inserted;
  });

  return {
    status: 'success',
    message: 'Data backup berhasil dipulihkan ke Google Sheets.',
    report: report
  };
}

function handleSaveQuestion(payload) {
  const { secretKey, question } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };
  if (!question || !question.question_text) {
    return { status: 'error', message: 'Data soal tidak lengkap: teks pertanyaan wajib diisi' };
  }

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.QUESTIONS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.QUESTIONS);
    sheet.appendRow(HEADERS.Questions);
    formatHeaderRow(sheet, HEADERS.Questions.length);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS.Questions);
    formatHeaderRow(sheet, HEADERS.Questions.length);
  }

  const rows = sheet.getDataRange().getValues();
  const qId = question.question_id || ('Q-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000));
  const sessionId = question.session_id || 'SES-001';

  let existingRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(qId)) {
      existingRow = i + 1;
      break;
    }
  }

  const optionsJson = typeof question.options === 'string' ? question.options : JSON.stringify(question.options || []);

  const rowData = [
    qId,
    sessionId,
    question.paket || 'Pretest',
    question.type || 'single_choice',
    question.question_text,
    question.image_url || '',
    optionsJson,
    String(question.key_answer || '').trim().toUpperCase(),
    Number(question.weight) || 1
  ];

  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  clearExamCache(sessionId);
  return { status: 'success', message: 'Soal berhasil disimpan', questionId: qId };
}

function handleBatchSaveQuestions(payload) {
  const { secretKey, sessionId, questions } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return { status: 'error', message: 'Data soal kosong' };
  }

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.QUESTIONS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.QUESTIONS);
    sheet.appendRow(HEADERS.Questions);
    formatHeaderRow(sheet, HEADERS.Questions.length);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS.Questions);
    formatHeaderRow(sheet, HEADERS.Questions.length);
  }

  const existingData = sheet.getDataRange().getValues();
  const existingMap = {};
  for (let i = 1; i < existingData.length; i++) {
    const rowQId = String(existingData[i][0]).trim();
    if (rowQId) existingMap[rowQId] = i + 1;
  }

  const rowsToAppend = [];
  let updatedCount = 0;
  const nowEpoch = new Date().getTime();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qId = q.question_id || ('Q-' + nowEpoch + '-' + (i + 1) + '-' + Math.floor(Math.random() * 1000));
    const targetSessionId = sessionId || q.session_id || 'SES-001';
    const optionsJson = typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []);

    const rowData = [
      qId,
      targetSessionId,
      q.paket || 'Pretest',
      q.type || 'single_choice',
      q.question_text || '',
      q.image_url || '',
      optionsJson,
      String(q.key_answer || '').trim().toUpperCase(),
      Number(q.weight) || 1
    ];

    if (existingMap[qId]) {
      sheet.getRange(existingMap[qId], 1, 1, rowData.length).setValues([rowData]);
      updatedCount++;
    } else {
      rowsToAppend.push(rowData);
    }
  }

  // Tulis seluruh baris baru SEKALIGUS (Single 2D Matrix Call) - Super Cepat!
  if (rowsToAppend.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rowsToAppend.length, HEADERS.Questions.length).setValues(rowsToAppend);
  }

  clearExamCache(sessionId);
  return {
    status: 'success',
    message: `Berhasil memproses ${questions.length} butir soal (${rowsToAppend.length} baru ditambahkan, ${updatedCount} diperbarui) secara instan.`,
    total: questions.length,
    inserted: rowsToAppend.length,
    updated: updatedCount
  };
}

function handleDeleteQuestion(payload) {
  const { secretKey, questionId } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.QUESTIONS);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(questionId)) {
      sheet.deleteRow(i + 1);
      clearExamCache();
      return { status: 'success', message: 'Soal berhasil dihapus' };
    }
  }
  return { status: 'error', message: 'Soal tidak ditemukan' };
}

/**
 * Hapus Seluruh Butir Soal Berdasarkan Paket (Admin)
 * Iterasi dilakukan mundur dari baris terakhir untuk mencegah pergeseran indeks.
 */
function handleDeleteQuestionsByPaket(payload) {
  const { secretKey, paket, sessionId } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak: Secret Key salah' };
  if (!paket || !String(paket).trim()) {
    return { status: 'error', message: 'Nama paket soal wajib diisi' };
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.QUESTIONS);
  if (!sheet) return { status: 'error', message: 'Sheet Questions tidak ditemukan' };

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { status: 'success', deletedCount: 0, message: 'Tidak ada data soal untuk dihapus.' };
  }

  const rows = sheet.getDataRange().getValues();
  const targetPaket = String(paket).trim().toLowerCase();
  let deletedCount = 0;

  // Lakukan iterasi mundur dari baris terakhir ke baris 2 (index 1)
  for (let i = rows.length - 1; i >= 1; i--) {
    const rowSessionId = String(rows[i][1] || '').trim(); // Kolom B: session_id
    const rowPaket = String(rows[i][2] || 'Pretest').trim().toLowerCase(); // Kolom C: paket

    const matchPaket = (rowPaket === targetPaket);
    const matchSession = !sessionId || (rowSessionId === String(sessionId).trim());

    if (matchPaket && matchSession) {
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }

  clearExamCache(sessionId);
  return {
    status: 'success',
    deletedCount: deletedCount,
    message: `Berhasil menghapus ${deletedCount} butir soal pada paket "${paket}".`
  };
}

function handleGradeEssay(payload) {
  const { secretKey, submissionId, essayScore } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.SUBMISSIONS);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(submissionId)) {
      const pgScore = Number(rows[i][4]) || 0;
      const scoreEssay = Number(essayScore) || 0;
      const totalScore = Math.round((pgScore + scoreEssay) / 2);

      sheet.getRange(i + 1, 6).setValue(scoreEssay);
      sheet.getRange(i + 1, 7).setValue(totalScore);

      return { status: 'success', message: 'Nilai essay berhasil disimpan', totalScore: totalScore };
    }
  }
  return { status: 'error', message: 'Submission tidak ditemukan' };
}

function handleUploadMedia(payload) {
  const { secretKey, base64Data, fileName, mimeType } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };
  if (!base64Data) return { status: 'error', message: 'Data gambar kosong' };

  let folderId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
  let folder;

  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      folder = null;
    }
  }

  if (!folder) {
    const folderName = 'ExamPro_Assets_PAI';
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    PropertiesService.getScriptProperties().setProperty('DRIVE_FOLDER_ID', folder.getId());
  }

  const cleanedBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
  const decodedBytes = Utilities.base64Decode(cleanedBase64);
  const blob = Utilities.newBlob(decodedBytes, mimeType || 'image/jpeg', fileName || ('soal_' + new Date().getTime() + '.jpg'));

  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  const directUrl = 'https://lh3.googleusercontent.com/d/' + fileId;

  return {
    status: 'success',
    fileId: fileId,
    url: directUrl
  };
}

function shuffleArray(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

function handleParticipantLogin(payload) {
  const { username, password } = payload;
  if (!username || !password) {
    return { status: 'error', message: 'Username dan password wajib diisi' };
  }

  const participants = getSheetDataAsObjects(SHEETS.PARTICIPANTS);
  const userClean = String(username).trim().toLowerCase();
  const passClean = String(password).trim();

  const found = participants.find(
    p => String(p.username || '').trim().toLowerCase() === userClean &&
         String(p.password || 'kemenag2026').trim() === passClean
  );

  if (!found) {
    return { status: 'error', message: 'Username atau password salah! Pastikan akun telah didaftarkan oleh Admin.' };
  }

  return {
    status: 'success',
    participant: {
      participant_id: found.participant_id,
      username: found.username,
      full_name: found.full_name,
      gender: found.gender || 'Laki-Laki',
      identifier: found.identifier,
      kelas: found.kelas || 'Kelas A',
      institution: found.institution || '',
      paket: found.paket || 'Pretest',
      status: found.status
    }
  };
}

function handleSaveParticipant(payload) {
  const { secretKey, participant } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };
  if (!participant || (!participant.username && !participant.full_name)) {
    return { status: 'error', message: 'Username atau Nama Lengkap peserta wajib diisi' };
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PARTICIPANTS);
  const rows = sheet.getDataRange().getValues();
  const pId = participant.participant_id || ('P-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000));

  let existingRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(pId) || (participant.username && String(rows[i][2]) === String(participant.username))) {
      existingRow = i + 1;
      break;
    }
  }

    const cleanGender = (participant.gender && String(participant.gender).trim() && String(participant.gender).trim() !== '-')
      ? String(participant.gender).trim()
      : '-';

    const rowData = [
      pId,
      participant.session_id || 'SES-001',
      participant.username || '',
      participant.password || 'kemenag2026',
      participant.full_name || participant.username || '',
      cleanGender,
      participant.identifier || participant.username || '',
      participant.kelas || '-',
      participant.institution || '',
      participant.paket || '-',
      participant.token_used || '',
      participant.start_time || new Date().toISOString(),
      participant.status || 'registered'
    ];

  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return { status: 'success', message: 'Data peserta berhasil disimpan', participantId: pId };
}

function handleBatchSaveParticipants(payload) {
  const { secretKey, sessionId, participants } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };
  if (!participants || !Array.isArray(participants) || participants.length === 0) {
    return { status: 'error', message: 'Data peserta kosong' };
  }

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.PARTICIPANTS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.PARTICIPANTS);
    sheet.appendRow(HEADERS.Participants);
    formatHeaderRow(sheet, HEADERS.Participants.length);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS.Participants);
    formatHeaderRow(sheet, HEADERS.Participants.length);
  }

  const existingData = sheet.getDataRange().getValues();
  const existingMap = {};
  for (let i = 1; i < existingData.length; i++) {
    const rowPId = String(existingData[i][0]).trim();
    const rowUsername = String(existingData[i][2]).trim().toLowerCase();
    if (rowPId) existingMap[rowPId] = i + 1;
    if (rowUsername) existingMap[rowUsername] = i + 1;
  }

  const rowsToAppend = [];
  let updatedCount = 0;
  const now = new Date().toISOString();
  const nowEpoch = new Date().getTime();

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    const pId = p.participant_id || ('P-' + nowEpoch + '-' + (i + 1) + '-' + Math.floor(Math.random() * 1000));
    const targetSessionId = sessionId || p.session_id || 'SES-001';
    const cleanUsername = String(p.username || pId).trim();

    const cleanGender = (p.gender && String(p.gender).trim() && String(p.gender).trim() !== '-')
      ? String(p.gender).trim()
      : '-';

    const rowData = [
      pId,
      targetSessionId,
      cleanUsername,
      p.password || 'kemenag2026',
      p.full_name || cleanUsername,
      cleanGender,
      p.identifier || cleanUsername,
      p.kelas || '-',
      p.institution || '',
      p.paket || '-',
      p.token_used || '',
      p.start_time || now,
      p.status || 'registered'
    ];

    const existingRow = existingMap[pId] || existingMap[cleanUsername.toLowerCase()];
    if (existingRow) {
      sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
      updatedCount++;
    } else {
      rowsToAppend.push(rowData);
    }
  }

  // Tulis seluruh baris baru SEKALIGUS (Single 2D Matrix Call) - Super Cepat!
  if (rowsToAppend.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rowsToAppend.length, HEADERS.Participants.length).setValues(rowsToAppend);
  }

  return {
    status: 'success',
    message: `Berhasil memproses ${participants.length} data peserta (${rowsToAppend.length} baru, ${updatedCount} diperbarui) secara instan.`,
    total: participants.length,
    inserted: rowsToAppend.length,
    updated: updatedCount
  };
}

function handleDeleteParticipant(payload) {
  const { secretKey, participantId } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PARTICIPANTS);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(participantId)) {
      sheet.deleteRow(i + 1);
      return { status: 'success', message: 'Peserta berhasil dihapus' };
    }
  }
  return { status: 'error', message: 'Peserta tidak ditemukan' };
}

function handleBatchDeleteParticipants(payload) {
  const { secretKey, participantIds } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };
  if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
    return { status: 'error', message: 'Daftar ID peserta kosong' };
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PARTICIPANTS);
  if (!sheet) return { status: 'error', message: 'Sheet peserta tidak ditemukan' };

  const idSet = {};
  participantIds.forEach(id => {
    if (id) idSet[String(id).trim()] = true;
  });

  const rows = sheet.getDataRange().getValues();
  let deletedCount = 0;

  // Hapus dari bawah ke atas agar indeks baris tidak bergeser saat baris dihapus
  for (let i = rows.length - 1; i >= 1; i--) {
    const rowId = String(rows[i][0]).trim();
    if (idSet[rowId]) {
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }

  return {
    status: 'success',
    message: `Berhasil menghapus ${deletedCount} peserta terpilih.`,
    deletedCount: deletedCount
  };
}

function handleDeleteAllParticipants(payload) {
  const { secretKey } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PARTICIPANTS);
  if (!sheet) return { status: 'error', message: 'Sheet peserta tidak ditemukan' };

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { status: 'success', message: 'Data peserta sudah kosong.' };
  }

  // Hapus seluruh baris data dari baris ke-2 hingga baris terakhir
  sheet.deleteRows(2, lastRow - 1);

  return {
    status: 'success',
    message: `Berhasil menghapus seluruh data peserta (${lastRow - 1} baris).`
  };
}

/**
 * Update Progress Ujian Real-Time & Laporan Kecurangan (Heartbeat)
 * Disimpan di CacheService (RAM) untuk performa instan tanpa membebani spreadsheet.
 */
function handleUpdateExamProgress(payload) {
  const { participantId, sessionId, answeredCount, totalQuestions, violations, lastViolationMsg } = payload;
  if (!participantId || !sessionId) {
    return { status: 'error', message: 'Data heartbeat tidak lengkap' };
  }

  const cache = CacheService.getScriptCache();
  const cacheKey = 'proctor_' + sessionId;
  let proctorData = {};
  const cachedStr = cache.get(cacheKey);
  if (cachedStr) {
    try { proctorData = JSON.parse(cachedStr); } catch (e) { proctorData = {}; }
  }

  const existing = proctorData[participantId] || {};
  const now = new Date().toISOString();

  // Ambil proctor commands jika ada (misal peringatan dari pengawas)
  const pendingCommand = existing.pendingCommand || null;

  proctorData[participantId] = {
    participantId: participantId,
    sessionId: sessionId,
    answeredCount: Number(answeredCount) || existing.answeredCount || 0,
    totalQuestions: Number(totalQuestions) || existing.totalQuestions || 25,
    violations: Number(violations) || existing.violations || 0,
    lastViolationMsg: lastViolationMsg || existing.lastViolationMsg || '',
    lastHeartbeat: now,
    status: existing.status || 'in_progress',
    pendingCommand: null // clear once delivered
  };

  // Cache berlaku selama 3 jam (10800 detik)
  cache.put(cacheKey, JSON.stringify(proctorData), 10800);

  return {
    status: 'success',
    pendingCommand: pendingCommand,
    serverTime: now
  };
}

/**
 * Deduplikasi Peserta di Sheet Participants
 * Menggabungkan progres (status, start_time, token_used) ke baris utama dan menghapus baris duplikat
 */
function deduplicateParticipantsInSheet(ss) {
  if (!ss) ss = getSpreadsheet();
  const partSheet = ss.getSheetByName(SHEETS.PARTICIPANTS);
  if (!partSheet || partSheet.getLastRow() <= 1) return { removedCount: 0 };

  const data = partSheet.getDataRange().getValues();
  const headers = data[0];
  const statusColIdx = headers.indexOf('status');
  const startColIdx = headers.indexOf('start_time');
  const tokenColIdx = headers.indexOf('token_used');

  const seen = {};
  const rowsToDelete = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const pId = String(row[0] || '').trim();
    const user = String(row[2] || '').trim().toLowerCase();
    const ident = String(row[6] || '').trim().toLowerCase();
    const status = String(row[statusColIdx] || '').trim().toLowerCase();
    const key = user || ident || pId;

    if (!key) continue;

    if (!seen[key]) {
      seen[key] = { rowIndex: i + 1, rowData: row };
    } else {
      // Ditemukan baris duplikat
      const existing = seen[key];
      const existingStatus = String(existing.rowData[statusColIdx] || '').trim().toLowerCase();

      // Jika baris saat ini lebih maju (submitted / in_progress), pindahkan statusnya ke baris awal
      if ((status === 'submitted' || status === 'in_progress') && existingStatus !== 'submitted') {
        if (statusColIdx >= 0) partSheet.getRange(existing.rowIndex, statusColIdx + 1).setValue(row[statusColIdx]);
        if (startColIdx >= 0 && row[startColIdx]) partSheet.getRange(existing.rowIndex, startColIdx + 1).setValue(row[startColIdx]);
        if (tokenColIdx >= 0 && row[tokenColIdx]) partSheet.getRange(existing.rowIndex, tokenColIdx + 1).setValue(row[tokenColIdx]);
        existing.rowData = row;
      }
      rowsToDelete.push(i + 1);
    }
  }

  // Hapus baris duplikat dari nomor baris terbesar ke terkecil
  rowsToDelete.sort(function(a, b) { return b - a; });
  rowsToDelete.forEach(function(rowIdx) {
    try { partSheet.deleteRow(rowIdx); } catch (e) {}
  });

  return { removedCount: rowsToDelete.length };
}

/**
 * Hitung Ulang Nilai Submisi yang Bernilai 0 Secara Otomatis
 * Memeriksa jawaban di sheet Submissions terhadap kunci jawaban Bank Soal
 */
function recalculateZeroSubmissions(ss) {
  if (!ss) ss = getSpreadsheet();
  const subSheet = ss.getSheetByName(SHEETS.SUBMISSIONS);
  const qSheet = ss.getSheetByName(SHEETS.QUESTIONS);
  if (!subSheet || subSheet.getLastRow() <= 1 || !qSheet || qSheet.getLastRow() <= 1) return { recalculatedCount: 0 };

  const allQuestions = getSheetDataAsObjects(SHEETS.QUESTIONS, ss);
  const subData = subSheet.getDataRange().getValues();
  const headers = subData[0];
  const pgCol = headers.indexOf('pg_score');
  const totalCol = headers.indexOf('total_score');
  const ansCol = headers.indexOf('answers_json');

  if (pgCol === -1 || totalCol === -1 || ansCol === -1) return { recalculatedCount: 0 };

  let recalculatedCount = 0;

  for (let i = 1; i < subData.length; i++) {
    const row = subData[i];
    const currentPg = Number(row[pgCol]) || 0;
    const currentTotal = Number(row[totalCol]) || 0;
    const ansRaw = row[ansCol];

    // Jika skor 0 tapi ada lembar jawaban yang diisi, hitung ulang
    if (currentPg === 0 && currentTotal === 0 && ansRaw) {
      let parsedAnswers = {};
      try {
        parsedAnswers = typeof ansRaw === 'string' ? JSON.parse(ansRaw) : ansRaw;
      } catch (e) {}

      const ansKeys = Object.keys(parsedAnswers);
      if (ansKeys.length > 0) {
        let earned = 0;
        let maxPg = 0;

        ansKeys.forEach(function(qId) {
          const q = allQuestions.find(function(item) { return String(item.question_id) === String(qId); });
          if (q && (q.type === 'single_choice' || q.type === 'multiple_choice')) {
            const w = Number(q.weight) || 1;
            maxPg += w;
            const userAns = parsedAnswers[qId];

            if (q.type === 'single_choice') {
              if (userAns && String(userAns).trim().toUpperCase() === String(q.key_answer).trim().toUpperCase()) {
                earned += w;
              }
            } else if (q.type === 'multiple_choice') {
              const uArr = Array.isArray(userAns)
                ? userAns.map(function(a) { return String(a).trim().toUpperCase(); }).sort().join(',')
                : String(userAns || '').split(',').map(function(a) { return a.trim().toUpperCase(); }).sort().join(',');
              const kArr = String(q.key_answer).split(',').map(function(a) { return a.trim().toUpperCase(); }).sort().join(',');
              if (uArr === kArr && uArr.length > 0) earned += w;
            }
          }
        });

        if (maxPg > 0) {
          const newScore = Math.round((earned / maxPg) * 100);
          subSheet.getRange(i + 1, pgCol + 1).setValue(newScore);
          subSheet.getRange(i + 1, totalCol + 1).setValue(newScore);
          recalculatedCount++;
        }
      }
    }
  }

  return { recalculatedCount: recalculatedCount };
}

/**
 * Ambil Data Pengawasan Real-Time (Live Proctoring Data)
 * Menggabungkan data dari CacheService (RAM real-time) dan data spreadsheet (Peserta & Submissions)
 */
function handleGetLiveProctor(payload) {
  const { secretKey, sessionId } = payload;
  if (!verifyAdminSecret(secretKey)) {
    return { status: 'error', message: 'Akses ditolak: Secret Key salah' };
  }

  const ss = getSpreadsheet();

  // Deduplikasi sheet dan perbaikan otomatis skor jika ada
  try { deduplicateParticipantsInSheet(ss); } catch (e) {}
  try { recalculateZeroSubmissions(ss); } catch (e) {}

  const participants = getSheetDataAsObjects(SHEETS.PARTICIPANTS, ss);
  const submissions = getSheetDataAsObjects(SHEETS.SUBMISSIONS, ss);
  const sessions = getSheetDataAsObjects(SHEETS.SESSIONS, ss);
  const allQuestions = getSheetDataAsObjects(SHEETS.QUESTIONS, ss);

  const activeSession = sessions.find(s => !sessionId || String(s.session_id) === String(sessionId)) || sessions[0];
  const targetSessionId = activeSession ? activeSession.session_id : (sessionId || 'SES-001');

  // Ambil cache live proctor
  const cache = CacheService.getScriptCache();
  const cacheKey = 'proctor_' + targetSessionId;
  let proctorData = {};
  const cachedStr = cache.get(cacheKey);
  if (cachedStr) {
    try { proctorData = JSON.parse(cachedStr); } catch (e) {}
  }

  // Filter peserta untuk sesi ini
  const rawTargetParts = participants.filter(p => !p.session_id || String(p.session_id) === String(targetSessionId));

  // Deduplikasi peserta unik berdasarkan username / identifier / ID agar total tetap sesuai jumlah asli (38)
  const uniquePartsMap = {};
  rawTargetParts.forEach(function(p) {
    const key = String(p.username || p.identifier || p.participant_id || '').trim().toLowerCase();
    if (!key) return;
    if (!uniquePartsMap[key]) {
      uniquePartsMap[key] = p;
    } else {
      const existing = uniquePartsMap[key];
      const pStatus = String(p.status || '').toLowerCase();
      const existStatus = String(existing.status || '').toLowerCase();
      if (pStatus === 'submitted' || (pStatus === 'in_progress' && existStatus !== 'submitted')) {
        uniquePartsMap[key] = Object.assign({}, existing, p);
      }
    }
  });
  const targetParts = Object.values(uniquePartsMap);

  const targetSubs = submissions.filter(s => String(s.session_id) === String(targetSessionId));
  const subMap = {};
  targetSubs.forEach(function(s) {
    if (s.participant_id) subMap[String(s.participant_id).trim()] = s;
  });

  const nowEpoch = new Date().getTime();

  const liveList = targetParts.map(function(p) {
    const pId = String(p.participant_id || '').trim();
    const pUser = String(p.username || '').trim().toLowerCase();
    const pIdent = String(p.identifier || '').trim().toLowerCase();

    const live = proctorData[pId] || proctorData[pUser] || {};
    const sub = subMap[pId] || subMap[pUser] || targetSubs.find(function(s) {
      const sId = String(s.participant_id || '').trim().toLowerCase();
      return sId === pId.toLowerCase() || sId === pUser || (pIdent && sId === pIdent);
    });

    const isSubmitted = !!sub || String(p.status).toLowerCase() === 'submitted';
    let status = isSubmitted ? 'submitted' : (p.status || 'registered');

    // Cek apakah peserta aktif (heartbeat dalam 60 detik terakhir)
    let isOnline = false;
    if (live.lastHeartbeat) {
      const hbDiffSec = (nowEpoch - new Date(live.lastHeartbeat).getTime()) / 1000;
      if (hbDiffSec <= 60 && !isSubmitted) {
        isOnline = true;
        status = 'in_progress';
      }
    }

    let calculatedScore = null;
    if (sub) {
      calculatedScore = Number(sub.total_score) || Number(sub.pg_score) || 0;
      // Jika skor submission masih 0 tapi ada lembar jawaban, hitung skor dinamis secara instan
      if (calculatedScore === 0 && sub.answers_json) {
        let pAns = {};
        try { pAns = typeof sub.answers_json === 'string' ? JSON.parse(sub.answers_json) : sub.answers_json; } catch(e) {}
        const pKeys = Object.keys(pAns);
        if (pKeys.length > 0 && allQuestions && allQuestions.length > 0) {
          let earned = 0, maxScore = 0;
          pKeys.forEach(function(qid) {
            const q = allQuestions.find(function(item) { return String(item.question_id) === String(qid); });
            if (q && (q.type === 'single_choice' || q.type === 'multiple_choice')) {
              const w = Number(q.weight) || 1;
              maxScore += w;
              const uAns = pAns[qid];
              if (q.type === 'single_choice') {
                if (uAns && String(uAns).trim().toUpperCase() === String(q.key_answer).trim().toUpperCase()) earned += w;
              } else if (q.type === 'multiple_choice') {
                const uA = Array.isArray(uAns) ? uAns.map(function(a) { return String(a).trim().toUpperCase(); }).sort().join(',') : String(uAns || '').split(',').map(function(a) { return a.trim().toUpperCase(); }).sort().join(',');
                const kA = String(q.key_answer).split(',').map(function(a) { return a.trim().toUpperCase(); }).sort().join(',');
                if (uA === kA && uA.length > 0) earned += w;
              }
            }
          });
          if (maxScore > 0) calculatedScore = Math.round((earned / maxScore) * 100);
        }
      }
    }

    return {
      participant_id: pId,
      session_id: targetSessionId,
      username: p.username,
      full_name: p.full_name,
      gender: p.gender || 'Laki-Laki',
      kelas: p.kelas || 'Kelas A',
      institution: p.institution || '',
      paket: p.paket || 'Pretest',
      start_time: p.start_time,
      status: status,
      is_online: isOnline,
      answered_count: live.answeredCount || (sub ? Object.keys(JSON.parse(sub.answers_json || '{}')).length : 0),
      total_questions: live.totalQuestions || 25,
      violations: Number(sub ? sub.tab_switch_count : (live.violations || 0)),
      last_violation_msg: live.lastViolationMsg || '',
      last_heartbeat: live.lastHeartbeat || null,
      score: calculatedScore
    };
  });

  return {
    status: 'success',
    sessionId: targetSessionId,
    session: activeSession,
    totalRegistered: targetParts.length,
    activeCount: liveList.filter(l => l.status === 'in_progress').length,
    submittedCount: liveList.filter(l => l.status === 'submitted').length,
    violationCount: liveList.filter(l => l.violations > 0).length,
    participants: liveList,
    serverTime: new Date().toISOString()
  };
}

/**
 * Aksi Pengawas Ujian (Teguran, Paksa Kumpul, Buka Kunci)
 */
function handleProctorAction(payload) {
  const { secretKey, sessionId, participantId, actionType, message } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };

  const cache = CacheService.getScriptCache();
  const cacheKey = 'proctor_' + sessionId;
  let proctorData = {};
  const cachedStr = cache.get(cacheKey);
  if (cachedStr) {
    try { proctorData = JSON.parse(cachedStr); } catch (e) {}
  }

  if (!proctorData[participantId]) {
    proctorData[participantId] = { participantId: participantId, sessionId: sessionId };
  }

  proctorData[participantId].pendingCommand = {
    actionType: actionType, // 'warn' | 'force_submit' | 'reset'
    message: message || 'Peringatan dari pengawas ujian',
    issuedAt: new Date().toISOString()
  };

  cache.put(cacheKey, JSON.stringify(proctorData), 10800);

  return {
    status: 'success',
    message: `Aksi pengawas "${actionType}" berhasil dikirimkan ke peserta.`
  };
}
