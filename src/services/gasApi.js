/**
 * Service API Client untuk Komunikasi dengan Google Apps Script (GAS)
 * Dilengkapi Mock Data jika URL GAS belum dikonfigurasi (untuk kemudahan demo lokal).
 */

import { validateRotatingToken } from '../utils/rotatingToken';

const GAS_API_URL = import.meta.env.VITE_GAS_API_URL || '';

// Mock database in-memory untuk pengujian lokal jika GAS URL belum diisi
const MOCK_STORAGE_KEY = 'exampro_mock_db';
function getMockDb() {
  const existing = localStorage.getItem(MOCK_STORAGE_KEY);
  if (existing) {
    try { return JSON.parse(existing); } catch(e) {}
  }
  const initial = {
    sessions: [
      {
        session_id: 'SES-001',
        title: 'Pretest Pelatihan TOT: Literasi Digital & Asesmen',
        type: 'pretest',
        token: 'TOT2026',
        duration_minutes: 30,
        is_active: true,
        shuffle_questions: true,
        shuffle_options: true,
        show_score: true,
        created_at: new Date().toISOString()
      }
    ],
    questions: [
      {
        question_id: 'Q-1',
        session_id: 'SES-001',
        type: 'single_choice',
        question_text: 'Apa kepanjangan dari CBT dalam sistem asesmen pendidikan modern?',
        image_url: '',
        options: [
          { id: 'A', text: 'Computer-Based Test' },
          { id: 'B', text: 'Core Basic Technology' },
          { id: 'C', text: 'Cloud-Based Tracking' },
          { id: 'D', text: 'Central Binary Task' }
        ],
        key_answer: 'A',
        weight: 1
      },
      {
        question_id: 'Q-2',
        session_id: 'SES-001',
        type: 'multiple_choice',
        question_text: 'Manakah dari komponen berikut yang termasuk dalam pilar arsitektur Serverless Google Workspace yang digunakan ExamPro? (Pilih semua yang benar)',
        image_url: '',
        options: [
          { id: 'A', text: 'Google Apps Script (GAS)' },
          { id: 'B', text: 'Google Sheets (Relational Spreadsheet)' },
          { id: 'C', text: 'Google Drive (Cloud Asset Storage)' },
          { id: 'D', text: 'Kubernetes Cluster On-Premise' }
        ],
        key_answer: 'A,B,C',
        weight: 1
      },
      {
        question_id: 'Q-3',
        session_id: 'SES-001',
        type: 'essay',
        question_text: 'Jelaskan mengapa pemindahan kalkulasi skor dari sisi client (browser) ke sisi server (Google Apps Script) sangat krusial dalam menjamin integritas ujian online!',
        image_url: '',
        options: [],
        key_answer: 'Rubrik: Keamanan kunci jawaban, pencegahan manipulasi DOM/Network DevTools.',
        weight: 2
      }
    ],
    participants: [],
    submissions: []
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
    return Boolean(GAS_API_URL && GAS_API_URL.startsWith('http') && !GAS_API_URL.includes('AKfycbx'));
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

    const response = await fetch(`${GAS_API_URL}?action=getSession&token=${encodeURIComponent(token)}`);
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal memvalidasi token');
    return data;
  },

  /**
   * Mulai Sesi Ujian (Registrasi Peserta)
   */
  async startExam({ token, fullName, identifier, gender, sessionSalt }) {
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

      const participantId = 'P-' + Date.now();
      const startTime = new Date().toISOString();
      db.participants.push({
        participant_id: participantId,
        session_id: sess.session_id,
        full_name: fullName,
        identifier: identifier,
        gender: gender || 'Laki-Laki',
        token_used: token,
        start_time: startTime,
        status: 'in_progress'
      });
      saveMockDb(db);
      return { status: 'success', participantId, startTime, session: sess };
    }

    const response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'startExam', token, fullName, identifier, gender, sessionSalt })
    });
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal memulai ujian');
    return data;
  },

  /**
   * Ambil Soal Ujian (Kunci Jawaban Disensor)
   */
  async getExamQuestions(token, participantId) {
    if (!this.isConfigured()) {
      await new Promise(r => setTimeout(r, 800));
      const db = getMockDb();
      const sess = db.sessions.find(s => s.token.toUpperCase() === token.trim().toUpperCase());
      if (!sess) throw new Error('Sesi tidak ditemukan');

      const questions = db.questions.filter(q => q.session_id === sess.session_id).map(q => {
        // Sensor kunci jawaban
        const { key_answer, ...safeQ } = q;
        return safeQ;
      });

      return { status: 'success', session: sess, questions };
    }

    const response = await fetch(`${GAS_API_URL}?action=getExamQuestions&token=${encodeURIComponent(token)}&participantId=${encodeURIComponent(participantId)}`);
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

    const response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'submitExam', participantId, sessionId, answers, violations })
    });
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal mengirim jawaban ujian');
    return data;
  },

  /**
   * Otentikasi Login Admin
   */
  async adminLogin(secretKey) {
    if (!this.isConfigured()) {
      await new Promise(r => setTimeout(r, 500));
      if (secretKey === 'admin123' || secretKey.length >= 4) {
        return { status: 'success', message: 'Login Admin Lokal Berhasil' };
      }
      throw new Error('PIN Admin salah (Default demo: admin123)');
    }

    const response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'adminLogin', secretKey })
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
        submissions: db.submissions
      };
    }

    const response = await fetch(`${GAS_API_URL}?action=getAdminDashboard&secretKey=${encodeURIComponent(secretKey)}`);
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

    const response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveSession', secretKey, session })
    });
    return await response.json();
  },

  /**
   * Simpan Soal Ujian (Admin)
   */
  async saveQuestion(secretKey, question) {
    if (!this.isConfigured()) {
      const db = getMockDb();
      const existingIdx = db.questions.findIndex(q => q.question_id === question.question_id);
      if (existingIdx !== -1) {
        db.questions[existingIdx] = { ...question };
      } else {
        question.question_id = 'Q-' + Date.now();
        db.questions.push(question);
      }
      saveMockDb(db);
      return { status: 'success', questionId: question.question_id };
    }

    const response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveQuestion', secretKey, question })
    });
    return await response.json();
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

    const response = await fetch(GAS_API_URL, {
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

    const response = await fetch(GAS_API_URL, {
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

    const response = await fetch(GAS_API_URL, {
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

    const response = await fetch(GAS_API_URL, {
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

    const response = await fetch(GAS_API_URL, {
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

    const response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteParticipant', secretKey, participantId })
    });
    return await response.json();
  }
};
