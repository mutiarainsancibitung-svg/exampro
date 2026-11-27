import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { gasApi } from '../services/gasApi';

const ExamContext = createContext();

export const ExamProvider = ({ children }) => {
  const { participant, sessionData, logoutParticipant } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({}); // Soal ragu-ragu: { question_id: boolean }
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [examResult, setExamResult] = useState(null);
  const [violations, setViolations] = useState(0);
  const [proctorMessage, setProctorMessage] = useState(null);
  const [sessionTerminatedReason, setSessionTerminatedReason] = useState(null);

  // Refs untuk mencegah stale closure saat waktu habis / auto-submit / force_submit
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const violationsRef = useRef(violations);
  violationsRef.current = violations;
  const submittingRef = useRef(submitting);
  submittingRef.current = submitting;

  // Storage key spesifik per peserta dan sesi untuk auto-save
  const storageKey = participant && sessionData 
    ? `exam_answers_${sessionData.session_id}_${participant.participantId}` 
    : null;

  const flagStorageKey = participant && sessionData 
    ? `exam_flagged_${sessionData.session_id}_${participant.participantId}` 
    : null;

  // Reset state jika peserta ganti akun / logout
  useEffect(() => {
    if (!participant || !sessionData) {
      setQuestions([]);
      setCurrentIndex(0);
      setAnswers({});
      setFlagged({});
      setViolations(0);
      setProctorMessage(null);
      setSessionTerminatedReason(null);
    }
  }, [participant, sessionData]);

  // Inisialisasi jawaban dari localStorage jika ada
  useEffect(() => {
    if (storageKey) {
      const savedAnswers = localStorage.getItem(storageKey);
      if (savedAnswers) {
        try { setAnswers(JSON.parse(savedAnswers)); } catch(e) {}
      }
      const savedFlags = localStorage.getItem(flagStorageKey);
      if (savedFlags) {
        try { setFlagged(JSON.parse(savedFlags)); } catch(e) {}
      }
    }
  }, [storageKey, flagStorageKey]);

  // Muat daftar soal saat peserta masuk
  const loadQuestions = useCallback(async () => {
    if (!participant || !sessionData) return;
    setLoading(true);
    try {
      const res = await gasApi.getExamQuestions(
        sessionData.token || participant.token,
        participant.participantId,
        participant.paket
      );
      if (res.status === 'success') {
        setQuestions(res.questions || []);
      }
    } catch (err) {
      console.error('Gagal memuat soal:', err);
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('nonaktif') || msg.includes('ditutup') || msg.includes('berakhir')) {
        if (storageKey) localStorage.removeItem(storageKey);
        if (flagStorageKey) localStorage.removeItem(flagStorageKey);
        setSessionTerminatedReason(err.message);
        logoutParticipant();
      }
    } finally {
      setLoading(false);
    }
  }, [participant, sessionData, storageKey, flagStorageKey, logoutParticipant]);

  // Set jawaban per soal & otomatis auto-save ke localStorage
  const setAnswer = (questionId, value) => {
    setAnswers(prev => {
      const updated = { ...prev, [questionId]: value };
      answersRef.current = updated;
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Toggle status ragu-ragu
  const toggleFlag = (questionId) => {
    setFlagged(prev => {
      const updated = { ...prev, [questionId]: !prev[questionId] };
      if (flagStorageKey) {
        localStorage.setItem(flagStorageKey, JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Submit Ujian (selalu membaca jawaban terbaru via ref & fallback localStorage)
  const submitExam = useCallback(async ({ allowIncomplete = false } = {}) => {
    if (!participant || !sessionData || submittingRef.current) return;

    let latestAnswers = answersRef.current || {};
    if (storageKey && Object.keys(latestAnswers).length === 0) {
      try {
        const fromStorage = JSON.parse(localStorage.getItem(storageKey) || '{}');
        if (Object.keys(fromStorage).length > 0) latestAnswers = fromStorage;
      } catch (e) {}
    }

    if (!allowIncomplete && questions.length > 0) {
      const answeredCount = questions.filter((q) => {
        const val = latestAnswers[q.question_id];
        if (Array.isArray(val)) return val.length > 0;
        return val !== undefined && val !== null && String(val).trim() !== '';
      }).length;
      if (answeredCount < questions.length) {
        throw new Error(`Masih ada ${questions.length - answeredCount} soal yang belum terjawab. Semua soal wajib dijawab sebelum mengirim ujian.`);
      }
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await gasApi.submitExam({
        participantId: participant.participantId,
        sessionId: sessionData.session_id,
        answers: latestAnswers,
        violations: violationsRef.current || 0
      });

      // Bersihkan auto-save localStorage setelah submit sukses
      if (storageKey) localStorage.removeItem(storageKey);
      if (flagStorageKey) localStorage.removeItem(flagStorageKey);

      setExamResult(res);
      return res;
    } catch (err) {
      console.error('Gagal submit ujian:', err);
      throw err;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [participant, sessionData, storageKey, flagStorageKey, questions]);

  // Kirim Heartbeat & Auto-Save Jawaban Sementara ke Google Apps Script (RAM Cache)
  const sendHeartbeat = useCallback(async (customViolations, violationMsg) => {
    if (!participant || !sessionData) return;
    const currentAnswers = answersRef.current || {};
    const answeredCount = Object.keys(currentAnswers).filter(k => {
      const val = currentAnswers[k];
      if (Array.isArray(val)) return val.length > 0;
      return val !== undefined && val !== null && String(val).trim() !== '';
    }).length;
    const vCount = customViolations !== undefined ? customViolations : violationsRef.current;

    try {
      const res = await gasApi.updateExamProgress({
        participantId: participant.participantId,
        sessionId: sessionData.session_id,
        answeredCount,
        totalQuestions: questions.length || 25,
        violations: vCount,
        lastViolationMsg: violationMsg || '',
        draftAnswers: currentAnswers
      });

      // Jika sesi dinonaktifkan atau waktu jadwal berakhir, keluarkan peserta dari ruang ujian
      if (res && (res.sessionActive === false || res.forcedLogout)) {
        if (storageKey) localStorage.removeItem(storageKey);
        if (flagStorageKey) localStorage.removeItem(flagStorageKey);
        setSessionTerminatedReason(res.reason || 'Mata ujian telah dinonaktifkan oleh panitia.');
        logoutParticipant();
        return;
      }

      if (res && res.pendingCommand) {
        if (res.pendingCommand.actionType === 'warn') {
          setProctorMessage(res.pendingCommand.message || 'Peringatan dari Pengawas: Harap tetap fokus pada lembar ujian!');
        } else if (res.pendingCommand.actionType === 'force_submit') {
          alert('Ujian Anda telah dihentikan dan dikumpulkan secara otomatis oleh Pengawas Ujian.');
          await submitExam({ allowIncomplete: true });
        }
      }
    } catch (e) {
      // Background heartbeat failures do not interrupt participant
    }
  }, [participant, sessionData, questions.length, storageKey, flagStorageKey, logoutParticipant, submitExam]);

  // Heartbeat & auto-save otomatis setiap 12 detik selama ujian aktif
  useEffect(() => {
    if (!participant || !sessionData || submitting || examResult) return;
    const interval = setInterval(() => {
      sendHeartbeat();
    }, 12000);
    sendHeartbeat();
    return () => clearInterval(interval);
  }, [participant, sessionData, submitting, examResult, sendHeartbeat]);

  // Tambah counter pelanggaran anti-cheat & langsung kirim alert ke pengawas
  const registerViolation = useCallback((msg) => {
    setViolations(v => {
      const nextV = v + 1;
      violationsRef.current = nextV;
      sendHeartbeat(nextV, msg || 'Berpindah tab atau meninggalkan layar');
      return nextV;
    });
  }, [sendHeartbeat]);

  const answeredCount = Object.keys(answers).filter(k => {
    const val = answers[k];
    if (Array.isArray(val)) return val.length > 0;
    return val !== undefined && val !== null && String(val).trim() !== '';
  }).length;

  return (
    <ExamContext.Provider
      value={{
        questions,
        currentIndex,
        setCurrentIndex,
        currentQuestion: questions[currentIndex] || null,
        totalQuestions: questions.length,
        answers,
        setAnswer,
        flagged,
        toggleFlag,
        answeredCount,
        loading,
        submitting,
        examResult,
        violations,
        registerViolation,
        proctorMessage,
        clearProctorMessage: () => setProctorMessage(null),
        sessionTerminatedReason,
        clearSessionTerminatedReason: () => setSessionTerminatedReason(null),
        loadQuestions,
        submitExam
      }}
    >
      {children}
    </ExamContext.Provider>
  );
};

export const useExam = () => useContext(ExamContext);
