import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useExam } from '../../context/ExamContext';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import { useServerTimer } from '../../hooks/useServerTimer';
import { HeaderBar } from '../../components/layout/HeaderBar';
import { QuestionCard } from '../../components/exam/QuestionCard';
import { NavGrid } from '../../components/exam/NavGrid';
import { TimerDisplay } from '../../components/exam/TimerDisplay';
import { ViolationModal } from '../../components/exam/ViolationModal';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { ChevronLeft, ChevronRight, Send, AlertTriangle, Maximize2 } from 'lucide-react';

export const ExamRoomPage = () => {
  const navigate = useNavigate();
  const { participant, sessionData, isParticipantLoggedIn } = useAuth();
  const {
    questions,
    currentIndex,
    setCurrentIndex,
    currentQuestion,
    totalQuestions,
    answers,
    setAnswer,
    flagged,
    toggleFlag,
    answeredCount,
    loading,
    submitting,
    violations,
    registerViolation,
    loadQuestions,
    submitExam
  } = useExam();

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Proteksi rute
  useEffect(() => {
    if (!isParticipantLoggedIn) {
      navigate('/');
    } else {
      loadQuestions();
    }
  }, [isParticipantLoggedIn, navigate, loadQuestions]);

  // Hook Anti-Cheat
  const {
    violationCount,
    showWarning,
    warningMessage,
    closeWarning,
    requestFullscreen
  } = useAntiCheat({
    onViolation: registerViolation,
    isExamActive: isParticipantLoggedIn && !submitting
  });

  // Handler Waktu Habis
  const handleTimeUp = async () => {
    try {
      await submitExam();
      navigate('/result');
    } catch (err) {
      alert('Waktu ujian telah habis. Lembar jawaban Anda telah tersimpan secara otomatis.');
      navigate('/result');
    }
  };

  // Timer Sinkron Server
  const timer = useServerTimer({
    startTime: participant?.startTime,
    durationMinutes: sessionData?.duration_minutes || 60,
    onTimeUp: handleTimeUp,
    isActive: isParticipantLoggedIn && !submitting
  });

  const handleSubmit = async () => {
    try {
      setShowConfirmModal(false);
      await submitExam();
      navigate('/result');
    } catch (err) {
      alert('Gagal mengirimkan ujian: ' + err.message);
    }
  };

  if (loading || !currentQuestion) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-mint-grid">
        <div className="w-12 h-12 border-4 border-kemenag-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-kemenag-800">Menyiapkan Lembar Ujian Pelatihan Guru PAI...</p>
      </div>
    );
  }

  const unAnsweredCount = totalQuestions - answeredCount;
  const flaggedCount = Object.values(flagged).filter(Boolean).length;

  return (
    <div className="min-h-screen flex flex-col bg-mint-grid no-select pb-12">
      {/* Header Bar dengan Branding Gambar 2 */}
      <HeaderBar
        participantInfo={{
          username: participant?.identifier,
          fullName: participant?.fullName
        }}
      />

      {/* Sub-Header Timer & Action */}
      <div className="bg-white/90 backdrop-blur border-b border-kemenag-100 px-4 md:px-8 py-2.5 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="text-xs font-bold text-kemenag-800 uppercase tracking-wide">
              {sessionData?.title || 'Pretest Pelatihan Guru PAI'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={requestFullscreen}
              title="Masuk Mode Layar Penuh"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-kemenag-200 text-xs font-semibold text-kemenag-700 hover:bg-kemenag-50"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Layar Penuh
            </button>

            <TimerDisplay
              formatTime={timer.formatTime}
              isLowTime={timer.isLowTime}
              isCriticalTime={timer.isCriticalTime}
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 md:px-8 pt-6 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Kolom Soal (3 Kolom) */}
          <div className="lg:col-span-3 space-y-6">
            <QuestionCard
              questionNumber={currentIndex + 1}
              question={currentQuestion}
              userAnswer={answers[currentQuestion.question_id]}
              onAnswerChange={(val) => setAnswer(currentQuestion.question_id, val)}
              isFlagged={Boolean(flagged[currentQuestion.question_id])}
              onToggleFlag={() => toggleFlag(currentQuestion.question_id)}
            />

            {/* Navigasi Bawah Soal */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <Button
                variant="secondary"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(i => i - 1)}
                icon={ChevronLeft}
              >
                Sebelumnya
              </Button>

              {currentIndex < totalQuestions - 1 ? (
                <Button
                  variant="primary"
                  onClick={() => setCurrentIndex(i => i + 1)}
                >
                  Selanjutnya
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  variant="success"
                  onClick={() => setShowConfirmModal(true)}
                  icon={Send}
                >
                  Selesai & Kumpulkan
                </Button>
              )}
            </div>
          </div>

          {/* Sidebar Navigasi Grid (1 Kolom) */}
          <div className="lg:col-span-1 space-y-4">
            <NavGrid
              questions={questions}
              currentIndex={currentIndex}
              onSelectIndex={setCurrentIndex}
              answers={answers}
              flagged={flagged}
            />

            <Button
              variant="outline"
              className="w-full border-rose-200 text-rose-600 hover:bg-rose-50 rounded-2xl"
              onClick={() => setShowConfirmModal(true)}
              icon={Send}
            >
              Kumpulkan Ujian
            </Button>
          </div>
        </div>
      </main>

      {/* Modal Peringatan Anti-Cheat */}
      <ViolationModal
        isOpen={showWarning}
        onClose={closeWarning}
        violationCount={violationCount}
        message={warningMessage}
      />

      {/* Modal Konfirmasi Submit */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Konfirmasi Pengumpulan Ujian"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Apakah Anda yakin ingin mengumpulkan seluruh lembar jawaban sekarang?
          </p>

          <div className="grid grid-cols-3 gap-2 p-3 bg-kemenag-50 rounded-2xl border border-kemenag-100 text-center">
            <div className="p-2">
              <span className="block text-lg font-bold text-kemenag-700">{answeredCount}</span>
              <span className="text-[11px] text-slate-500">Terjawab</span>
            </div>
            <div className="p-2">
              <span className="block text-lg font-bold text-amber-600">{flaggedCount}</span>
              <span className="text-[11px] text-slate-500">Ragu-ragu</span>
            </div>
            <div className="p-2">
              <span className="block text-lg font-bold text-slate-400">{unAnsweredCount}</span>
              <span className="text-[11px] text-slate-500">Belum</span>
            </div>
          </div>

          {unAnsweredCount > 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 text-amber-800 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Masih ada {unAnsweredCount} butir soal yang belum Anda jawab!</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowConfirmModal(false)}
              disabled={submitting}
            >
              Cek Kembali
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Mengirim...' : 'Ya, Kumpulkan'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
