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
        responseData = setupDatabaseSheets();
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
      case 'deleteQuestion':
        responseData = handleDeleteQuestion(payload);
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
  const ss = getSpreadsheet();
  const createdSheets = [];

  for (const sheetName in HEADERS) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(HEADERS[sheetName]);
      sheet.getRange(1, 1, 1, HEADERS[sheetName].length)
        .setFontWeight('bold')
        .setBackground('#0D7A5F')
        .setFontColor('#FFFFFF');
      createdSheets.push(sheetName);
    }
  }

  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
  }

  return {
    status: 'success',
    message: 'Setup database Pelatihan Guru PAI berhasil',
    created: createdSheets
  };
}

function getSheetDataAsObjects(sheetName) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const headers = rows[0];
  const data = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
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

function handleGetSession(token, sessionSalt) {
  if (!token) return { status: 'error', message: 'Token tidak boleh kosong' };
  
  const sessions = getSheetDataAsObjects(SHEETS.SESSIONS);
  let session = sessions.find(s => String(s.token).trim().toUpperCase() === String(token).trim().toUpperCase());

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

  return {
    status: 'success',
    session: {
      session_id: session.session_id,
      title: session.title,
      type: session.type,
      token: session.token,
      duration_minutes: Number(session.duration_minutes),
      shuffle_questions: String(session.shuffle_questions).toUpperCase() === 'TRUE',
      shuffle_options: String(session.shuffle_options).toUpperCase() === 'TRUE',
      show_score: String(session.show_score).toUpperCase() === 'TRUE'
    }
  };
}

function handleGetExamQuestions(token, participantId, paket) {
  const sessionRes = handleGetSession(token);
  if (sessionRes.status !== 'success') return sessionRes;

  const session = sessionRes.session;
  const allQuestions = getSheetDataAsObjects(SHEETS.QUESTIONS);

  let targetQuestions = allQuestions;
  if (paket) {
    const byPaket = allQuestions.filter(q => String(q.paket || 'Pretest').toLowerCase() === String(paket).toLowerCase());
    if (byPaket.length > 0) targetQuestions = byPaket;
  }

  if (targetQuestions.length === 0) {
    return { status: 'error', message: 'Belum ada soal pada paket ujian ini' };
  }

  // Sensor kunci jawaban!
  let safeQuestions = targetQuestions.map(q => {
    let parsedOptions = [];
    try {
      parsedOptions = typeof q.options_json === 'string' ? JSON.parse(q.options_json) : (q.options_json || []);
    } catch(e) {
      parsedOptions = [];
    }

    if (session.shuffle_options && parsedOptions.length > 0 && q.type !== 'essay') {
      parsedOptions = shuffleArray(parsedOptions);
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

  if (session.shuffle_questions) {
    safeQuestions = shuffleArray(safeQuestions);
  }

  return {
    status: 'success',
    session: session,
    questions: safeQuestions,
    paket: paket || 'Pretest'
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

  const participantId = 'P-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000);
  const startTime = new Date().toISOString();

  partSheet.appendRow([
    participantId,
    session.session_id,
    identifier.trim(),
    'kemenag2026',
    fullName.trim(),
    gender || 'Laki-Laki',
    identifier.trim(),
    payload.institution || '',
    token.trim().toUpperCase(),
    startTime,
    'in_progress'
  ]);

  return {
    status: 'success',
    participantId: participantId,
    startTime: startTime,
    session: session
  };
}

function handleSubmitExam(payload) {
  const { participantId, sessionId, answers, violations } = payload;
  if (!participantId || !sessionId) {
    return { status: 'error', message: 'Data submission tidak lengkap' };
  }

  const ss = getSpreadsheet();
  const questions = getSheetDataAsObjects(SHEETS.QUESTIONS)
    .filter(q => String(q.session_id) === String(sessionId));

  const sessionData = getSheetDataAsObjects(SHEETS.SESSIONS)
    .find(s => String(s.session_id) === String(sessionId));

  const userAnswers = answers || {};

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
      const userArr = Array.isArray(userAnswer) ? userAnswer.map(a => String(a).trim().toUpperCase()).sort().join(',') : String(userAnswer || '').trim().toUpperCase();
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

  const partSheet = ss.getSheetByName(SHEETS.PARTICIPANTS);
  const partRows = partSheet.getDataRange().getValues();
  for (let i = 1; i < partRows.length; i++) {
    if (String(partRows[i][0]) === String(participantId)) {
      partSheet.getRange(i + 1, 9).setValue('submitted');
      break;
    }
  }

  const showScore = sessionData ? (String(sessionData.show_score).toUpperCase() === 'TRUE') : false;

  return {
    status: 'success',
    submissionId: submissionId,
    showScore: showScore,
    score: showScore ? {
      pgScore: pgScoreCalculated,
      hasEssay: hasEssay,
      totalScore: totalScore
    } : null,
    message: 'Ujian berhasil dikirim dan tersimpan dengan aman.'
  };
}

function handleGetAdminDashboard(secretKey) {
  if (!verifyAdminSecret(secretKey)) {
    return { status: 'error', message: 'Akses ditolak: Secret Key salah' };
  }

  const sessions = getSheetDataAsObjects(SHEETS.SESSIONS);
  const questions = getSheetDataAsObjects(SHEETS.QUESTIONS);
  const participants = getSheetDataAsObjects(SHEETS.PARTICIPANTS);
  const submissions = getSheetDataAsObjects(SHEETS.SUBMISSIONS);
  let admins = getSheetDataAsObjects(SHEETS.ADMINS);
  if (!admins || admins.length === 0) {
    initializeDefaultAdmins();
    admins = getSheetDataAsObjects(SHEETS.ADMINS);
  }

  const parsedQuestions = questions.map(q => {
    let opts = [];
    try {
      opts = typeof q.options_json === 'string' ? JSON.parse(q.options_json) : (q.options_json || []);
    } catch(e) {
      opts = [];
    }
    return { ...q, options: opts };
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

function initializeDefaultAdmins() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.ADMINS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.ADMINS);
    sheet.appendRow(HEADERS.Admins);
    sheet.getRange(1, 1, 1, HEADERS.Admins.length)
      .setFontWeight('bold')
      .setBackground('#0D7A5F')
      .setFontColor('#FFFFFF');
  }

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    const defaultAdmins = [
      ['ADM-001', 'admin', 'admin123', 'Administrator Utama', 'superadmin', true, new Date().toISOString()],
      ['ADM-002', 'dosen_pai', 'guru2026', 'Dosen PAI Pengampu', 'instructor', true, new Date().toISOString()],
      ['ADM-003', 'pengawas01', 'proctor2026', 'Pengawas Ruang Ujian', 'proctor', true, new Date().toISOString()]
    ];
    defaultAdmins.forEach(row => sheet.appendRow(row));
  }
}

function handleGetAdminUsers(secretKey) {
  if (!verifyAdminSecret(secretKey)) {
    return { status: 'error', message: 'Akses ditolak: Secret Key salah' };
  }
  let admins = getSheetDataAsObjects(SHEETS.ADMINS);
  if (!admins || admins.length === 0) {
    initializeDefaultAdmins();
    admins = getSheetDataAsObjects(SHEETS.ADMINS);
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

  return { status: 'success', message: 'Sesi ujian berhasil disimpan', sessionId: sessionId };
}

function handleDeleteSession(payload) {
  const { secretKey, sessionId } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.SESSIONS);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(sessionId)) {
      sheet.deleteRow(i + 1);
      return { status: 'success', message: 'Sesi berhasil dihapus' };
    }
  }
  return { status: 'error', message: 'Sesi tidak ditemukan' };
}

function handleSaveQuestion(payload) {
  const { secretKey, question } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };
  if (!question || !question.session_id || !question.question_text) {
    return { status: 'error', message: 'Data soal tidak lengkap' };
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.QUESTIONS);
  const rows = sheet.getDataRange().getValues();
  const qId = question.question_id || ('Q-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000));

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
    question.session_id || 'SES-001',
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

  return { status: 'success', message: 'Soal berhasil disimpan', questionId: qId };
}

function handleBatchSaveQuestions(payload) {
  const { secretKey, sessionId, questions } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };
  if (!questions || !Array.isArray(questions)) return { status: 'error', message: 'Data soal kosong' };

  let count = 0;
  for (let i = 0; i < questions.length; i++) {
    handleSaveQuestion({
      secretKey: secretKey,
      question: {
        ...questions[i],
        session_id: sessionId
      }
    });
    count++;
  }

  return { status: 'success', message: `Berhasil menyimpan ${count} butir soal` };
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
      return { status: 'success', message: 'Soal berhasil dihapus' };
    }
  }
  return { status: 'error', message: 'Soal tidak ditemukan' };
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

  const rowData = [
    pId,
    participant.session_id || 'SES-001',
    participant.username || '',
    participant.password || 'kemenag2026',
    participant.full_name || participant.username || '',
    participant.gender || 'Laki-Laki',
    participant.identifier || participant.username || '',
    participant.kelas || 'Kelas A',
    participant.institution || '',
    participant.paket || 'Pretest',
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
  const { secretKey, participants } = payload;
  if (!verifyAdminSecret(secretKey)) return { status: 'error', message: 'Akses ditolak' };
  if (!participants || !Array.isArray(participants)) return { status: 'error', message: 'Data peserta kosong' };

  let count = 0;
  for (let i = 0; i < participants.length; i++) {
    handleSaveParticipant({
      secretKey: secretKey,
      participant: participants[i]
    });
    count++;
  }

  return { status: 'success', message: `Berhasil menyimpan ${count} data peserta` };
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
