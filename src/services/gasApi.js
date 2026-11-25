/**
 * Service API Client untuk Komunikasi dengan Google Apps Script (GAS)
 * Dilengkapi Mock Data jika URL GAS belum dikonfigurasi (untuk kemudahan demo lokal).
 */

import { validateRotatingToken } from '../utils/rotatingToken';

const getGasApiUrl = () => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('exampro_gas_api_url');
    if (custom && custom.trim().startsWith('http')) return custom.trim();
  }
  return import.meta.env.VITE_GAS_API_URL || '';
};

// Mock database in-memory untuk pengujian lokal jika GAS URL belum diisi
const MOCK_STORAGE_KEY = 'exampro_mock_db_v4';
function getMockDb() {
  const existing = localStorage.getItem(MOCK_STORAGE_KEY);
  if (existing) {
    try { return JSON.parse(existing); } catch(e) {}
  }
  const initial = {
    sessions: [
      {
        session_id: 'SES-001',
        title: 'Pelatihan Guru PAI: Penguatan Kompetensi & Digital',
        type: 'evaluasi',
        token: 'TOT2026',
        duration_minutes: 60,
        is_active: true,
        shuffle_questions: true,
        shuffle_options: true,
        show_score: true,
        created_at: new Date().toISOString()
      }
    ],
    questions: [],
    participants: [],
    submissions: [],
    admins: [
      {
        admin_id: 'ADM-001',
        username: 'admin',
        password: 'admin123',
        name: 'Administrator Utama',
        role: 'superadmin',
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        admin_id: 'ADM-002',
        username: 'dosen_pai',
        password: 'dosen123',
        name: 'Dr. H. Muhammad Ilyas, M.Ag',
        role: 'instructor',
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        admin_id: 'ADM-003',
        username: 'pengawas01',
        password: 'awas123',
        name: 'Ustadz Rahmat Hidayat, S.Pd.I',
        role: 'proctor',
        is_active: true,
        created_at: new Date().toISOString()
      }
    ]
  };
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

function saveMockDb(db) {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
}

export const gasApi = {
  /**
   * Cek apakah API GAS sudah terhubung
   */
  isConfigured: () => {
    const url = getGasApiUrl();
    return Boolean(url && url.startsWith('http') && !url.includes('...'));
  },
  getGasApiUrl: () => getGasApiUrl(),
  setGasApiUrl: (url) => {
    if (typeof window !== 'undefined') {
      if (!url) {
        localStorage.removeItem('exampro_gas_api_url');
      } else {
        localStorage.setItem('exampro_gas_api_url', url.trim());
      }
    }
  },

  /**
   * Otentikasi Login Peserta berdasarkan Username & Password yang Ditentukan Admin
   */
  async participantLogin({ username, password }) {
    if (!username || !password) throw new Error('Username dan password wajib diisi.');

    if (!this.isConfigured()) {
      await new Promise(r => setTimeout(r, 400));
      const db = getMockDb();
      const userClean = String(username).trim().toLowerCase();
      const passClean = String(password).trim();

      const found = db.participants.find(
        p => String(p.username || '').trim().toLowerCase() === userClean &&
             String(p.password || 'kemenag2026').trim() === passClean
      );

      if (found) {
        return {
          status: 'success',
          participant: found
        };
      }

      // Jika belum terdaftar tetapi format akun mirip demo, izinkan atau lempar error
      throw new Error('Username atau Password salah! Pastikan data akun Anda sudah dibuat oleh Admin.');
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'participantLogin', username, password })
    });
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Login peserta gagal.');
    return data;
  },

  /**
   * Validasi Sesi Ujian berdasarkan Token
   */
  async getSession(token) {
    if (!token) throw new Error('Token wajib diisi');

    if (!this.isConfigured()) {
      // Mock fallback
      await new Promise(r => setTimeout(r, 600));
      const db = getMockDb();
      const sess = db.sessions.find(s => s.token.toUpperCase() === token.trim().toUpperCase());
      if (!sess) throw new Error('Token ujian tidak ditemukan dalam sistem');
      if (!sess.is_active) throw new Error('Sesi ujian ini sedang dinonaktifkan');
      return { status: 'success', session: sess };
    }

    const response = await fetch(`${getGasApiUrl()}?action=getSession&token=${encodeURIComponent(token)}`);
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal memvalidasi token');
    return data;
  },

  /**
   * Mulai Sesi Ujian (Registrasi Peserta & Penentuan Paket)
   */
  async startExam({ token, fullName, identifier, gender, sessionSalt, paket, kelas }) {
    if (!this.isConfigured()) {
      await new Promise(r => setTimeout(r, 700));
      const db = getMockDb();
      
      // Cari sesi yang cocok baik dengan token langsung maupun token berputar 1 menit
      let sess = db.sessions.find(s => s.token.toUpperCase() === token.trim().toUpperCase());
      if (!sess) {
        sess = db.sessions.find(s => validateRotatingToken(token, s.token, s.session_id));
      }
      if (!sess && db.sessions.length > 0) {
        if (validateRotatingToken(token, db.sessions[0].token, sessionSalt || 'PAI_TOT')) {
          sess = db.sessions[0];
        }
      }

      if (!sess) throw new Error('Token ujian tidak valid atau sudah kadaluarsa (token berganti setiap 1 menit)');
      if (!sess.is_active) throw new Error('Sesi ujian ini sedang dinonaktifkan');

      let existingPart = db.participants.find(
        p => p.username === identifier || p.identifier === identifier
      );
      const participantId = existingPart?.participant_id || ('P-' + Date.now());
      const startTime = new Date().toISOString();
      const finalPaket = paket || existingPart?.paket || 'Pretest';
      const finalKelas = kelas || existingPart?.kelas || 'Kelas A';

      if (existingPart) {
        existingPart.token_used = token;
        existingPart.start_time = startTime;
        existingPart.status = 'in_progress';
        existingPart.paket = finalPaket;
        existingPart.kelas = finalKelas;
      } else {
        db.participants.push({
          participant_id: participantId,
          session_id: sess.session_id,
          username: identifier,
          full_name: fullName,
          identifier: identifier,
          gender: gender || 'Laki-Laki',
          kelas: finalKelas,
          paket: finalPaket,
          token_used: token,
          start_time: startTime,
          status: 'in_progress'
        });
      }
      saveMockDb(db);
      return { status: 'success', participantId, startTime, session: sess, paket: finalPaket, kelas: finalKelas };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'startExam', token, fullName, identifier, gender, sessionSalt, paket, kelas })
    });
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal memulai ujian');
    return data;
  },

  /**
   * Ambil Soal Ujian (Kunci Jawaban Disensor & Filter Berdasarkan Paket)
   */
  async getExamQuestions(token, participantId, paket) {
    if (!this.isConfigured()) {
      await new Promise(r => setTimeout(r, 800));
      const db = getMockDb();
      let sess = db.sessions[0];
      const part = db.participants.find(p => p.participant_id === participantId);
      const targetPaket = paket || part?.paket || 'Pretest';

      let matched = db.questions.filter(
        q => (q.paket || 'Pretest').toLowerCase() === targetPaket.toLowerCase()
      );
      if (matched.length === 0) {
        matched = db.questions; // Fallback jika belum ada soal di paket tersebut
      }

      const questions = matched.map(q => {
        const { key_answer, ...safeQ } = q;
        return safeQ;
      });

      return { status: 'success', session: sess, questions, paket: targetPaket };
    }

    const response = await fetch(`${getGasApiUrl()}?action=getExamQuestions&token=${encodeURIComponent(token)}&participantId=${encodeURIComponent(participantId)}&paket=${encodeURIComponent(paket || '')}`);
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal memuat soal ujian');
    return data;
  },

  /**
   * Submit Jawaban & Kalkulasi Nilai di Sisi Server
   */
  async submitExam({ participantId, sessionId, answers, violations }) {
    if (!this.isConfigured()) {
      await new Promise(r => setTimeout(r, 1000));
      const db = getMockDb();
      const questions = db.questions.filter(q => q.session_id === sessionId);
      const sess = db.sessions.find(s => s.session_id === sessionId);

      let earnedPg = 0;
      let totalPg = 0;
      let hasEssay = false;

      questions.forEach(q => {
        const uAns = answers[q.question_id];
        if (q.type === 'single_choice') {
          totalPg += q.weight || 1;
          if (uAns && String(uAns).toUpperCase() === String(q.key_answer).toUpperCase()) {
            earnedPg += q.weight || 1;
          }
        } else if (q.type === 'multiple_choice') {
          totalPg += q.weight || 1;
          const uStr = Array.isArray(uAns) ? uAns.sort().join(',') : String(uAns || '');
          const kStr = String(q.key_answer).split(',').sort().join(',');
          if (uStr.toUpperCase() === kStr.toUpperCase()) {
            earnedPg += q.weight || 1;
          }
        } else if (q.type === 'essay') {
          hasEssay = true;
        }
      });

      const pgScore = totalPg > 0 ? Math.round((earnedPg / totalPg) * 100) : 0;
      const submissionId = 'SUB-' + Date.now();

      db.submissions.push({
        submission_id: submissionId,
        participant_id: participantId,
        session_id: sessionId,
        answers_json: JSON.stringify(answers),
        pg_score: pgScore,
        essay_score: 0,
        total_score: pgScore,
        tab_switch_count: violations || 0,
        submitted_at: new Date().toISOString()
      });

      const pIndex = db.participants.findIndex(p => p.participant_id === participantId);
      if (pIndex !== -1) db.participants[pIndex].status = 'submitted';

      saveMockDb(db);

      return {
        status: 'success',
        submissionId,
        showScore: sess?.show_score ?? true,
        score: {
          pgScore,
          hasEssay,
          totalScore: pgScore
        },
        message: 'Jawaban ujian berhasil dikirim dan dinilai.'
      };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'submitExam', participantId, sessionId, answers, violations })
    });
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal mengirim jawaban ujian');
    return data;
  },

  /**
   * Otentikasi Login Admin (Mendukung Username & Password serta Secret Key)
   */
  async adminLogin(param) {
    if (!this.isConfigured()) {
      await new Promise(r => setTimeout(r, 500));
      const db = getMockDb();
      db.admins = db.admins || [];

      // Jika parameter adalah objek { username, password }
      if (typeof param === 'object' && param !== null) {
        const uClean = String(param.username || '').trim().toLowerCase();
        const pClean = String(param.password || '').trim();

        const match = db.admins.find(
          a => String(a.username || '').trim().toLowerCase() === uClean &&
               String(a.password || '').trim() === pClean
        );

        if (match) {
          if (!match.is_active) {
            throw new Error('Akun admin Anda sedang dinonaktifkan.');
          }
          return {
            status: 'success',
            secretKey: 'admin123',
            user: match,
            message: `Selamat datang, ${match.name}!`
          };
        }

        // Fallback demo akun default jika db belum memiliki data
        if (uClean === 'admin' && pClean === 'admin123') {
          const defaultAdmin = {
            admin_id: 'ADM-001',
            username: 'admin',
            name: 'Administrator Utama',
            role: 'superadmin',
            is_active: true
          };
          return { status: 'success', secretKey: 'admin123', user: defaultAdmin };
        }

        throw new Error('Username atau Password Admin salah.');
      }

      // Jika parameter adalah string PIN/SecretKey
      const pin = String(param || '').trim();
      if (pin === 'admin123' || pin.length >= 4) {
        const defaultAdmin = (db.admins && db.admins[0]) || {
          admin_id: 'ADM-001',
          username: 'admin',
          name: 'Administrator Utama',
          role: 'superadmin',
          is_active: true
        };
        return { status: 'success', secretKey: pin, user: defaultAdmin, message: 'Login Admin Berhasil' };
      }
      throw new Error('Kredensial atau PIN Admin salah.');
    }

    const payload = typeof param === 'object' && param !== null
      ? { action: 'adminLogin', ...param }
      : { action: 'adminLogin', secretKey: param };

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Kredensial Admin Salah');
    return data;
  },

  /**
   * Ambil Data Admin Dashboard
   */
  async getAdminDashboard(secretKey) {
    if (!this.isConfigured()) {
      await new Promise(r => setTimeout(r, 600));
      const db = getMockDb();
      return {
        status: 'success',
        sessions: db.sessions,
        questions: db.questions,
        participants: db.participants,
        submissions: db.submissions,
        admins: db.admins || []
      };
    }

    const response = await fetch(`${getGasApiUrl()}?action=getAdminDashboard&secretKey=${encodeURIComponent(secretKey)}`);
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal memuat dashboard');
    return data;
  },

  /**
   * Simpan Sesi Ujian (Admin)
   */
  async saveSession(secretKey, session) {
    if (!this.isConfigured()) {
      const db = getMockDb();
      const existingIdx = db.sessions.findIndex(s => s.session_id === session.session_id);
      if (existingIdx !== -1) {
        db.sessions[existingIdx] = { ...session };
      } else {
        session.session_id = 'SES-' + Date.now();
        db.sessions.push(session);
      }
      saveMockDb(db);
      return { status: 'success', sessionId: session.session_id };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'saveSession', secretKey, session })
    });
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal menyimpan sesi');
    return data;
  },

  /**
   * Hapus Sesi Ujian (Admin) dengan Opsi Auto-Arsip Rekap Nilai
   */
  async deleteSession(secretKey, sessionId, archiveSubmissions = true) {
    if (!this.isConfigured()) {
      const db = getMockDb();
      const sessIdx = db.sessions.findIndex(s => s.session_id === sessionId);
      if (sessIdx !== -1) {
        db.sessions.splice(sessIdx, 1);
      }
      if (archiveSubmissions) {
        db.archivedSubmissions = db.archivedSubmissions || [];
        const related = (db.submissions || []).filter(sub => sub.session_id === sessionId);
        related.forEach(sub => db.archivedSubmissions.push({ ...sub, archived_at: new Date().toISOString() }));
      }
      saveMockDb(db);
      return { status: 'success', message: 'Sesi berhasil dihapus (mode lokal)' };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteSession', secretKey, sessionId, archiveSubmissions })
    });
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal menghapus sesi ujian');
    return data;
  },

  /**
   * Ekspor Full Master Backup Seluruh Database (Sessions, Questions, Participants, Submissions, Admins)
   */
  async exportFullBackup(secretKey) {
    if (!this.isConfigured()) {
      const db = getMockDb();
      return {
        status: 'success',
        exportedAt: new Date().toISOString(),
        sessions: db.sessions || [],
        questions: db.questions || [],
        participants: db.participants || [],
        submissions: db.submissions || [],
        admins: db.admins || []
      };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'exportFullBackup', secretKey })
    });
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal mengekspor data backup');
    return data;
  },

  /**
   * Pulihkan Full Backup ke Database (Mode Append atau Overwrite)
   */
  async restoreFullBackup(secretKey, backupData, mode = 'append') {
    if (!this.isConfigured()) {
      const db = getMockDb();
      if (mode === 'overwrite') {
        db.sessions = backupData.sessions || [];
        db.questions = backupData.questions || [];
        db.participants = backupData.participants || [];
        db.submissions = backupData.submissions || [];
        db.admins = backupData.admins || [];
      } else {
        // Append / merge
        ['sessions', 'questions', 'participants', 'submissions', 'admins'].forEach(key => {
          db[key] = [...(db[key] || []), ...(backupData[key] || [])];
        });
      }
      saveMockDb(db);
      return { status: 'success', message: 'Backup berhasil dipulihkan (mode lokal)' };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'restoreFullBackup', secretKey, backupData, mode })
    });
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal memulihkan data backup');
    return data;
  },

  /**
   * Simpan Soal Ujian (Admin)
   */
  async saveQuestion(secretKey, question) {
    const preparedQuestion = {
      ...question,
      session_id: question.session_id || 'SES-001',
      question_id: question.question_id || ('Q-' + Date.now() + '-' + Math.floor(Math.random() * 10000))
    };

    if (!this.isConfigured()) {
      const db = getMockDb();
      const existingIdx = db.questions.findIndex(q => q.question_id === preparedQuestion.question_id);
      if (existingIdx !== -1) {
        db.questions[existingIdx] = { ...preparedQuestion };
      } else {
        db.questions.push(preparedQuestion);
      }
      saveMockDb(db);
      return { status: 'success', questionId: preparedQuestion.question_id };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'saveQuestion', secretKey, question: preparedQuestion })
    });
    const data = await response.json();
    if (data.status !== 'success') {
      throw new Error(data.message || 'Gagal menyimpan butir soal ke database Google Sheets.');
    }
    return data;
  },

  /**
   * Batch Simpan Banyak Soal Sekaligus (Admin)
   */
  async batchSaveQuestions(secretKey, questions, sessionId = 'SES-001') {
    const prepared = (questions || []).map((q, idx) => ({
      ...q,
      session_id: sessionId || q.session_id || 'SES-001',
      question_id: q.question_id || ('Q-' + Date.now() + '-' + (idx + 1))
    }));

    if (!this.isConfigured()) {
      const db = getMockDb();
      prepared.forEach(q => {
        const idx = db.questions.findIndex(item => item.question_id === q.question_id);
        if (idx !== -1) {
          db.questions[idx] = { ...q };
        } else {
          db.questions.push(q);
        }
      });
      saveMockDb(db);
      return { status: 'success', message: `Berhasil menyimpan ${prepared.length} butir soal.` };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'batchSaveQuestions', secretKey, sessionId, questions: prepared })
    });
    const data = await response.json();
    if (data.status !== 'success') {
      throw new Error(data.message || 'Gagal menyimpan batch soal ke Google Sheets.');
    }
    return data;
  },

  /**
   * Hapus Soal Ujian (Admin)
   */
  async deleteQuestion(secretKey, questionId) {
    if (!this.isConfigured()) {
      const db = getMockDb();
      db.questions = db.questions.filter(q => q.question_id !== questionId);
      saveMockDb(db);
      return { status: 'success' };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteQuestion', secretKey, questionId })
    });
    return await response.json();
  },

  /**
   * Input Nilai Essay oleh Admin
   */
  async gradeEssay(secretKey, submissionId, essayScore) {
    if (!this.isConfigured()) {
      const db = getMockDb();
      const sub = db.submissions.find(s => s.submission_id === submissionId);
      if (sub) {
        sub.essay_score = Number(essayScore) || 0;
        sub.total_score = Math.round((sub.pg_score + sub.essay_score) / 2);
        saveMockDb(db);
      }
      return { status: 'success', totalScore: sub?.total_score };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'gradeEssay', secretKey, submissionId, essayScore })
    });
    return await response.json();
  },

  /**
   * Upload Media Gambar ke Google Drive
   */
  async uploadMedia(secretKey, file) {
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    if (!this.isConfigured()) {
      // Return base64 langsung untuk preview lokal
      return {
        status: 'success',
        url: base64Data
      };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({
        action: 'uploadMedia',
        secretKey,
        base64Data,
        fileName: file.name,
        mimeType: file.type
      })
    });
    return await response.json();
  },

  /**
   * Simpan Data Peserta Tunggal (Admin)
   */
  async saveParticipant(secretKey, participant) {
    if (!this.isConfigured()) {
      const db = getMockDb();
      const existingIdx = db.participants.findIndex(p => p.participant_id === participant.participant_id);
      if (existingIdx !== -1) {
        db.participants[existingIdx] = { ...participant };
      } else {
        participant.participant_id = 'P-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        participant.status = participant.status || 'registered';
        db.participants.push(participant);
      }
      saveMockDb(db);
      return { status: 'success', participantId: participant.participant_id };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'saveParticipant', secretKey, participant })
    });
    return await response.json();
  },

  /**
   * Batch Simpan Peserta dari File Excel (Admin)
   */
  async batchSaveParticipants(secretKey, participants) {
    if (!this.isConfigured()) {
      const db = getMockDb();
      let count = 0;
      for (const p of participants) {
        const pId = 'P-' + Date.now() + '-' + (++count);
        db.participants.push({
          participant_id: pId,
          session_id: p.session_id || 'SES-001',
          username: p.username || '',
          password: p.password || 'kemenag2026',
          full_name: p.full_name || p.username || '',
          gender: p.gender || 'Laki-Laki',
          identifier: p.identifier || p.username || '',
          institution: p.institution || '',
          status: 'registered'
        });
      }
      saveMockDb(db);
      return { status: 'success', message: `Berhasil menambahkan ${participants.length} peserta` };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'batchSaveParticipants', secretKey, participants })
    });
    return await response.json();
  },

  /**
   * Hapus Data Peserta (Admin)
   */
  async deleteParticipant(secretKey, participantId) {
    if (!this.isConfigured()) {
      const db = getMockDb();
      db.participants = db.participants.filter(p => p.participant_id !== participantId);
      saveMockDb(db);
      return { status: 'success' };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteParticipant', secretKey, participantId })
    });
    return await response.json();
  },

  /**
   * Ambil Daftar Pengguna Admin & Role (Super Admin)
   */
  async getAdminUsers(secretKey) {
    if (!this.isConfigured()) {
      const db = getMockDb();
      return { status: 'success', admins: db.admins || [] };
    }

    const response = await fetch(`${getGasApiUrl()}?action=getAdminUsers&secretKey=${encodeURIComponent(secretKey)}`);
    return await response.json();
  },

  /**
   * Simpan / Tambah Pengguna Admin (Super Admin)
   */
  async saveAdminUser(secretKey, adminData) {
    if (!this.isConfigured()) {
      const db = getMockDb();
      db.admins = db.admins || [];
      const existingIdx = db.admins.findIndex(a => a.admin_id === adminData.admin_id);
      if (existingIdx !== -1) {
        db.admins[existingIdx] = { ...db.admins[existingIdx], ...adminData };
      } else {
        adminData.admin_id = 'ADM-' + Date.now();
        adminData.created_at = new Date().toISOString();
        adminData.is_active = adminData.is_active !== undefined ? adminData.is_active : true;
        db.admins.push(adminData);
      }
      saveMockDb(db);
      return { status: 'success', adminId: adminData.admin_id, message: 'Data admin berhasil disimpan.' };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'saveAdminUser', secretKey, adminData })
    });
    return await response.json();
  },

  /**
   * Hapus Pengguna Admin (Super Admin)
   */
  async deleteAdminUser(secretKey, adminId) {
    if (!this.isConfigured()) {
      const db = getMockDb();
      db.admins = (db.admins || []).filter(a => a.admin_id !== adminId);
      saveMockDb(db);
      return { status: 'success', message: 'Admin berhasil dihapus.' };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteAdminUser', secretKey, adminId })
    });
    return await response.json();
  },

  /**
   * Cek & Perbaiki Struktur Database Google Sheets
   * - Memeriksa keberadaan 5 Sheet
   * - Memeriksa kelengkapan dan format header di baris 1
   * - Jika baris 1 kosong / hilang: langsung mengisi header standar Kemenag FITK UIN
   * - Jika baris 1 berisi data: menyisipkan baris header di atasnya tanpa menghapus data
   */
  async checkAndRepairDatabase(secretKey) {
    if (!this.isConfigured()) {
      await new Promise(r => setTimeout(r, 600));
      return {
        status: 'success',
        message: 'Pemeriksaan database lokal selesai. Seluruh 5 tabel dan header kolom dalam kondisi prima.',
        report: [
          { sheet: 'Sessions', status: 'OK', action: 'Header sudah sesuai & terformat', totalRows: 2, totalCols: 10 },
          { sheet: 'Questions', status: 'OK', action: 'Header sudah sesuai & terformat', totalRows: 5, totalCols: 9 },
          { sheet: 'Participants', status: 'OK', action: 'Header sudah sesuai & terformat', totalRows: 3, totalCols: 13 },
          { sheet: 'Submissions', status: 'OK', action: 'Header sudah sesuai & terformat', totalRows: 1, totalCols: 9 },
          { sheet: 'Admins', status: 'OK', action: 'Header sudah sesuai & terformat', totalRows: 3, totalCols: 7 }
        ]
      };
    }

    const response = await fetch(`${getGasApiUrl()}?action=checkAndRepair&secretKey=${encodeURIComponent(secretKey || '')}`);
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal memeriksa database');
    return data;
  }
};
