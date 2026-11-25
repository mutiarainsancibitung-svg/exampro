/**
 * Service API Client untuk Komunikasi dengan Google Apps Script (GAS)
 * Dilengkapi Mock Data jika URL GAS belum dikonfigurasi (untuk kemudahan demo lokal).
 */

import { validateRotatingToken } from '../utils/rotatingToken';

// Cache Client Dashboard In-Memory & Session Storage (Tahap 3 - SWR Acceleration)
let adminDashboardCache = null;
let adminDashboardCacheTime = 0;
const DASHBOARD_CACHE_MAX_AGE = 60 * 1000; // 60 detik umur cache segar di browser

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

      let questions = matched.map(q => {
        const { key_answer, ...safeQ } = q;
        let opts = safeQ.options ? [...safeQ.options] : [];
        if (sess?.shuffle_options && opts.length > 0 && safeQ.type !== 'essay') {
          // Acak posisi opsi jawaban (opt.id tetap dipertahankan)
          opts = [...opts].sort(() => Math.random() - 0.5);
        }
        return {
          ...safeQ,
          options: opts
        };
      });

      if (sess?.shuffle_questions) {
        questions = [...questions].sort(() => Math.random() - 0.5);
      }

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
    this.clearDashboardCache();
    return data;
  },

  /**
   * Kirim Heartbeat & Progres Ujian Real-Time dari Ruang Ujian Peserta
   */
  async updateExamProgress({ participantId, sessionId, answeredCount, totalQuestions, violations, lastViolationMsg }) {
    if (!participantId || !sessionId) return { status: 'error' };

    if (!this.isConfigured()) {
      const db = getMockDb();
      db.liveProctor = db.liveProctor || {};
      const existing = db.liveProctor[participantId] || {};
      const pendingCommand = existing.pendingCommand || null;

      db.liveProctor[participantId] = {
        participantId,
        sessionId,
        answeredCount: Number(answeredCount) || 0,
        totalQuestions: Number(totalQuestions) || 25,
        violations: Number(violations) || 0,
        lastViolationMsg: lastViolationMsg || '',
        lastHeartbeat: new Date().toISOString(),
        status: 'in_progress',
        pendingCommand: null
      };
      saveMockDb(db);
      return { status: 'success', pendingCommand };
    }

    try {
      const response = await fetch(getGasApiUrl(), {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateExamProgress',
          participantId,
          sessionId,
          answeredCount,
          totalQuestions,
          violations,
          lastViolationMsg
        })
      });
      return await response.json();
    } catch (e) {
      return { status: 'error', message: e.message };
    }
  },

  /**
   * Ambil Data Pengawasan Ujian Real-Time (Live Proctoring Data)
   */
  async getLiveProctor(secretKey, sessionId = '') {
    if (!this.isConfigured()) {
      await new Promise(r => setTimeout(r, 400));
      const db = getMockDb();
      const sess = db.sessions.find(s => !sessionId || s.session_id === sessionId) || db.sessions[0];
      const targetSessionId = sess ? sess.session_id : 'SES-001';
      const proctorData = db.liveProctor || {};
      const nowEpoch = Date.now();

      const participants = (db.participants || []).filter(
        p => !p.session_id || p.session_id === targetSessionId
      );

      const liveList = participants.map(p => {
        const pId = p.participant_id;
        const live = proctorData[pId] || {};
        const sub = (db.submissions || []).find(s => s.participant_id === pId && s.session_id === targetSessionId);
        const isSubmitted = !!sub || p.status === 'submitted';

        let status = isSubmitted ? 'submitted' : (p.status || 'registered');
        let isOnline = false;
        if (live.lastHeartbeat) {
          const diffSec = (nowEpoch - new Date(live.lastHeartbeat).getTime()) / 1000;
          if (diffSec <= 60 && !isSubmitted) {
            isOnline = true;
            status = 'in_progress';
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
          status,
          is_online: isOnline,
          answered_count: live.answeredCount || (sub ? Object.keys(sub.answers || {}).length : 0),
          total_questions: live.totalQuestions || 25,
          violations: Number(sub ? sub.violations : (live.violations || 0)),
          last_violation_msg: live.lastViolationMsg || '',
          last_heartbeat: live.lastHeartbeat || null,
          score: sub ? (sub.total_score || sub.pg_score || 0) : null
        };
      });

      return {
        status: 'success',
        sessionId: targetSessionId,
        session: sess,
        totalRegistered: participants.length,
        activeCount: liveList.filter(l => l.status === 'in_progress').length,
        submittedCount: liveList.filter(l => l.status === 'submitted').length,
        violationCount: liveList.filter(l => l.violations > 0).length,
        participants: liveList,
        serverTime: new Date().toISOString()
      };
    }

    const response = await fetch(`${getGasApiUrl()}?action=getLiveProctor&secretKey=${encodeURIComponent(secretKey)}&sessionId=${encodeURIComponent(sessionId || '')}`);
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal memuat monitor ujian');
    return data;
  },

  /**
   * Kirim Tindakan Pengawas (Teguran, Paksa Kumpul, Buka Kunci)
   */
  async sendProctorAction(secretKey, sessionId, participantId, actionType, message = '') {
    if (!this.isConfigured()) {
      const db = getMockDb();
      db.liveProctor = db.liveProctor || {};
      if (!db.liveProctor[participantId]) {
        db.liveProctor[participantId] = { participantId, sessionId };
      }
      db.liveProctor[participantId].pendingCommand = {
        actionType,
        message,
        issuedAt: new Date().toISOString()
      };
      saveMockDb(db);
      return { status: 'success', message: `Perintah "${actionType}" berhasil dikirimkan.` };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({
        action: 'proctorAction',
        secretKey,
        sessionId,
        participantId,
        actionType,
        message
      })
    });
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal mengirim tindakan pengawas');
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
   * Bersihkan Cache Dashboard Browser (Tahap 3)
   * Dipanggil otomatis setiap kali ada data yang disimpan, diedit, atau dihapus.
   */
  clearDashboardCache() {
    adminDashboardCache = null;
    adminDashboardCacheTime = 0;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem('exampro_admin_dashboard_cache');
        sessionStorage.removeItem('exampro_admin_dashboard_cache_time');
      }
    } catch (e) {}
  },

  /**
   * Ambil Data Admin Dashboard dengan Caching Cerdas Client-Side (Tahap 3 SWR)
   * Navigasi antar-halaman admin menjadi instan (0 ms) tanpa menunggu loading spinner.
   * @param {string} secretKey
   * @param {boolean} forceRefresh - jika true, paksa ambil data baru dari cloud Google Apps Script
   */
  async getAdminDashboard(secretKey, forceRefresh = false) {
    const now = Date.now();

    // 1. Cek memory cache & sessionStorage jika tidak dipaksa refresh (Instan 0 ms!)
    if (!forceRefresh) {
      if (adminDashboardCache && (now - adminDashboardCacheTime < DASHBOARD_CACHE_MAX_AGE)) {
        return adminDashboardCache;
      }
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const storedStr = sessionStorage.getItem('exampro_admin_dashboard_cache');
          const storedTime = Number(sessionStorage.getItem('exampro_admin_dashboard_cache_time') || 0);
          if (storedStr && (now - storedTime < DASHBOARD_CACHE_MAX_AGE)) {
            const parsed = JSON.parse(storedStr);
            adminDashboardCache = parsed;
            adminDashboardCacheTime = storedTime;
            return parsed;
          }
        }
      } catch (e) {}
    }

    if (!this.isConfigured()) {
      await new Promise(r => setTimeout(r, 200));
      const db = getMockDb();
      const res = {
        status: 'success',
        sessions: db.sessions,
        questions: db.questions,
        participants: db.participants,
        submissions: db.submissions,
        admins: db.admins || []
      };
      adminDashboardCache = res;
      adminDashboardCacheTime = Date.now();
      return res;
    }

    const response = await fetch(`${getGasApiUrl()}?action=getAdminDashboard&secretKey=${encodeURIComponent(secretKey)}`);
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal memuat dashboard');

    // Simpan ke memory dan sessionStorage
    adminDashboardCache = data;
    adminDashboardCacheTime = Date.now();
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('exampro_admin_dashboard_cache', JSON.stringify(data));
        sessionStorage.setItem('exampro_admin_dashboard_cache_time', String(adminDashboardCacheTime));
      }
    } catch (e) {}

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
      this.clearDashboardCache();
      return { status: 'success', sessionId: session.session_id };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'saveSession', secretKey, session })
    });
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal menyimpan sesi');
    this.clearDashboardCache();
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
      this.clearDashboardCache();
      return { status: 'success', message: 'Sesi berhasil dihapus (mode lokal)' };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteSession', secretKey, sessionId, archiveSubmissions })
    });
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal menghapus sesi ujian');
    this.clearDashboardCache();
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
      this.clearDashboardCache();
      return { status: 'success', message: 'Backup berhasil dipulihkan (mode lokal)' };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'restoreFullBackup', secretKey, backupData, mode })
    });
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Gagal memulihkan data backup');
    this.clearDashboardCache();
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
      this.clearDashboardCache();
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
    this.clearDashboardCache();
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
      this.clearDashboardCache();
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
    this.clearDashboardCache();
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
      this.clearDashboardCache();
      return { status: 'success' };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteQuestion', secretKey, questionId })
    });
    this.clearDashboardCache();
    return await response.json();
  },

  /**
   * Hapus Seluruh Soal Berdasarkan Paket (Admin)
   */
  async deleteQuestionsByPaket(secretKey, paket, sessionId = null) {
    if (!paket) throw new Error('Nama paket soal wajib diisi');

    if (!this.isConfigured()) {
      const db = getMockDb();
      const pClean = String(paket).trim().toLowerCase();
      const initialCount = db.questions.length;
      db.questions = db.questions.filter(q => {
        const qPaket = String(q.paket || 'Pretest').trim().toLowerCase();
        if (sessionId && q.session_id && String(q.session_id) !== String(sessionId)) {
          return true;
        }
        return qPaket !== pClean;
      });
      const deletedCount = initialCount - db.questions.length;
      saveMockDb(db);
      this.clearDashboardCache();
      return {
        status: 'success',
        deletedCount,
        message: `Berhasil menghapus ${deletedCount} butir soal pada paket "${paket}".`
      };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteQuestionsByPaket', secretKey, paket, sessionId })
    });
    const data = await response.json();
    if (data.status !== 'success') {
      throw new Error(data.message || 'Gagal menghapus soal per paket.');
    }
    this.clearDashboardCache();
    return data;
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
      this.clearDashboardCache();
      return { status: 'success', totalScore: sub?.total_score };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'gradeEssay', secretKey, submissionId, essayScore })
    });
    this.clearDashboardCache();
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
      this.clearDashboardCache();
      return { status: 'success', participantId: participant.participant_id };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'saveParticipant', secretKey, participant })
    });
    this.clearDashboardCache();
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
          gender: (p.gender && p.gender !== '-') ? p.gender : '-',
          identifier: p.identifier || p.username || '',
          kelas: p.kelas || '-',
          institution: p.institution || '',
          paket: p.paket || '-',
          status: 'registered'
        });
      }
      saveMockDb(db);
      this.clearDashboardCache();
      return { status: 'success', message: `Berhasil menambahkan ${participants.length} peserta` };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'batchSaveParticipants', secretKey, participants })
    });
    this.clearDashboardCache();
    return await response.json();
  },

  /**
   * Hapus Data Peserta Tunggal (Admin)
   */
  async deleteParticipant(secretKey, participantId) {
    if (!this.isConfigured()) {
      const db = getMockDb();
      db.participants = db.participants.filter(p => p.participant_id !== participantId);
      saveMockDb(db);
      this.clearDashboardCache();
      return { status: 'success' };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteParticipant', secretKey, participantId })
    });
    this.clearDashboardCache();
    return await response.json();
  },

  /**
   * Hapus Banyak Data Peserta Sekaligus Berdasarkan Pilihan Ceklis (Admin)
   * Dilengkapi Automatic Fallback ke deleteParticipant tunggal jika backend GAS belum di-deploy ke versi terbaru.
   */
  async batchDeleteParticipants(secretKey, participantIds) {
    if (!participantIds || participantIds.length === 0) {
      return { status: 'success', message: 'Tidak ada peserta yang dipilih' };
    }

    if (!this.isConfigured()) {
      const db = getMockDb();
      const idSet = new Set(participantIds.map(id => String(id)));
      const initial = db.participants.length;
      db.participants = db.participants.filter(p => !idSet.has(String(p.participant_id)));
      const deletedCount = initial - db.participants.length;
      saveMockDb(db);
      this.clearDashboardCache();
      return { status: 'success', message: `Berhasil menghapus ${deletedCount} peserta terpilih (mode lokal)`, deletedCount };
    }

    try {
      const response = await fetch(getGasApiUrl(), {
        method: 'POST',
        body: JSON.stringify({ action: 'batchDeleteParticipants', secretKey, participantIds })
      });
      const data = await response.json();

      if (data && data.status === 'success') {
        this.clearDashboardCache();
        return data;
      }

      // Jika GAS belum di-deploy ke versi baru (Invalid POST action), aktifkan fallback cerdas
      if (data && data.status === 'error' && String(data.message).includes('Invalid POST action')) {
        console.warn('Backend GAS belum di-deploy ke versi terbaru. Menjalankan fallback hapus paralel...');
        return await this._fallbackDeleteParticipants(secretKey, participantIds);
      }

      throw new Error(data.message || 'Gagal menghapus batch peserta');
    } catch (err) {
      if (String(err.message).includes('Invalid POST action')) {
        return await this._fallbackDeleteParticipants(secretKey, participantIds);
      }
      throw err;
    }
  },

  /**
   * Helper Fallback: Hapus peserta secara paralel / batch menggunakan deleteParticipant tunggal
   */
  async _fallbackDeleteParticipants(secretKey, participantIds) {
    let successCount = 0;
    const chunkSize = 5; // 5 request paralel per batch
    for (let i = 0; i < participantIds.length; i += chunkSize) {
      const chunk = participantIds.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (id) => {
          try {
            await this.deleteParticipant(secretKey, id);
            successCount++;
          } catch (e) {
            console.error('Fallback delete gagal untuk:', id, e);
          }
        })
      );
    }
    this.clearDashboardCache();
    return {
      status: 'success',
      message: `Berhasil menghapus ${successCount} peserta terpilih.`,
      deletedCount: successCount
    };
  },

  /**
   * Hapus Seluruh Data Peserta Sekaligus (Admin)
   * Mendukung parameter allParticipantIds untuk fallback otomatis jika backend GAS belum versi baru.
   */
  async deleteAllParticipants(secretKey, allParticipantIds = []) {
    if (!this.isConfigured()) {
      const db = getMockDb();
      const deletedCount = db.participants.length;
      db.participants = [];
      saveMockDb(db);
      this.clearDashboardCache();
      return { status: 'success', message: `Berhasil menghapus seluruh data peserta (${deletedCount} orang, mode lokal)` };
    }

    try {
      const response = await fetch(getGasApiUrl(), {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteAllParticipants', secretKey })
      });
      const data = await response.json();

      if (data && data.status === 'success') {
        this.clearDashboardCache();
        return data;
      }

      // Jika GAS belum di-deploy ke versi baru dan ada daftar ID peserta, jalankan fallback
      if (data && data.status === 'error' && String(data.message).includes('Invalid POST action') && allParticipantIds.length > 0) {
        console.warn('Backend GAS belum di-deploy ke versi terbaru. Menjalankan fallback hapus seluruh peserta...');
        return await this._fallbackDeleteParticipants(secretKey, allParticipantIds);
      }

      throw new Error(data.message || 'Gagal menghapus seluruh data peserta');
    } catch (err) {
      if (String(err.message).includes('Invalid POST action') && allParticipantIds.length > 0) {
        return await this._fallbackDeleteParticipants(secretKey, allParticipantIds);
      }
      throw err;
    }
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
      this.clearDashboardCache();
      return { status: 'success', adminId: adminData.admin_id, message: 'Data admin berhasil disimpan.' };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'saveAdminUser', secretKey, adminData })
    });
    this.clearDashboardCache();
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
      this.clearDashboardCache();
      return { status: 'success', message: 'Admin berhasil dihapus.' };
    }

    const response = await fetch(getGasApiUrl(), {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteAdminUser', secretKey, adminId })
    });
    this.clearDashboardCache();
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
