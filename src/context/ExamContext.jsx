import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { gasApi } from '../services/gasApi';

const ExamContext = createContext();

export const ExamProvider = ({ children }) => {
  const { participant, sessionData } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({}); // Soal ragu-ragu: { question_id: boolean }
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [examResult, setExamResult] = useState(null);
  const [violations, setViolations] = useState(0);
  const [proctorMessage, setProctorMessage] = useState(null);

  // Storage key spesifik per peserta dan sesi untuk auto-save
  const storageKey = participant && sessionData 
    ? `exam_answers_${sessionData.session_id}_${participant.participantId}` 
    : null;

  const flagStorageKey = participant && sessionData 
    ? `exam_flagged_${sessionData.session_id}_${participant.participantId}` 
    : null;

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
    } finally {
      setLoading(false);
    }
  }, [participant, sessionData]);

  // Set jawaban per soal & otomatis auto-save ke localStorage
  const setAnswer = (questionId, value) => {
    setAnswers(prev => {
      const updated = { ...prev, [questionId]: value };
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

  // Kirim Heartbeat & Progres Ujian Real-Time ke Google Apps Script (RAM Cache)
  const sendHeartbeat = useCallback(async (customViolations, violationMsg) => {
    if (!participant || !sessionData) return;
    const answeredCount = Object.keys(answers).length;
    const vCount = customViolations !== undefined ? customViolations : violations;

    try {
      const res = await gasApi.updateExamProgress({
        participantId: participant.participantId,
        sessionId: sessionData.session_id,
        answeredCount,
        totalQuestions: questions.length || 25,
        violations: vCount,
        lastViolationMsg: violationMsg || ''
      });

      if (res && res.pendingCommand) {
        if (res.pendingCommand.actionType === 'warn') {
          setProctorMessage(res.pendingCommand.message || 'Peringatan dari Pengawas: Harap tetap fokus pada lembar ujian!');
        } else if (res.pendingCommand.actionType === 'force_submit') {
          alert('Ujian Anda telah dihentikan dan dikumpulkan secara otomatis oleh Pengawas Ujian.');
          submitExam();
        }
      }
    } catch (e) {
      // Background heartbeat failures do not interrupt participant
    }
  }, [participant, sessionData, answers, violations, questions.length]);

  // Heartbeat otomatis setiap 20 detik selama ujian aktif
  useEffect(() => {
    if (!participant || !sessionData || submitting || examResult) return;
    const interval = setInterval(() => {
      sendHeartbeat();
    }, 20000);
    sendHeartbeat();
    return () => clearInterval(interval);
  }, [participant, sessionData, submitting, examResult, sendHeartbeat]);

  // Tambah counter pelanggaran anti-cheat & langsung kirim alert ke pengawas
  const registerViolation = useCallback((msg) => {
    setViolations(v => {
      const nextV = v + 1;
      sendHeartbeat(nextV, msg || 'Berpindah tab atau meninggalkan layar');
      return nextV;
    });
  }, [sendHeartbeat]);

  // Submit Ujian
  const submitExam = async () => {
    if (!participant || !sessionData || submitting) return;
    setSubmitting(true);
    try {
      const res = await gasApi.submitExam({
        participantId: participant.participantId,
        sessionId: sessionData.session_id,
        answers: answers,
        violations: violations
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
      setSubmitting(false);
    }
  };

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
        loadQuestions,
        submitExam
      }}
    >
      {children}
    </ExamContext.Provider>
  );
};

export const useExam = () => useContext(ExamContext);
