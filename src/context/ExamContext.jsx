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

  // Tambah counter pelanggaran anti-cheat
  const registerViolation = useCallback(() => {
    setViolations(v => v + 1);
  }, []);

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
        loadQuestions,
        submitExam
      }}
    >
      {children}
    </ExamContext.Provider>
  );
};

export const useExam = () => useContext(ExamContext);
