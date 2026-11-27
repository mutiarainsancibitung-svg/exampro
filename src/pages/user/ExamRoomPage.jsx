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
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { ChevronLeft, ChevronRight, Send, AlertTriangle, Maximize2, Type, ArrowDown, ArrowUp, Lock } from 'lucide-react';

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 16;
const FONT_STEP = 2;

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
    proctorMessage,
    clearProctorMessage,
    sessionTerminatedReason,
    clearSessionTerminatedReason,
    loadQuestions,
    submitExam
  } = useExam();

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [fontSizePx, setFontSizePx] = useState(() => {
    const saved = Number(localStorage.getItem('exampro_font_size_px'));
    if (!Number.isNaN(saved) && saved >= MIN_FONT_SIZE && saved <= MAX_FONT_SIZE) {
      return saved;
    }
    return DEFAULT_FONT_SIZE;
  });

  const updateFontSize = (nextSize) => {
    const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, nextSize));
    setFontSizePx(clamped);
    localStorage.setItem('exampro_font_size_px', String(clamped));
  };

  const handleDecreaseFont = () => updateFontSize(fontSizePx - FONT_STEP);
  const handleIncreaseFont = () => updateFontSize(fontSizePx + FONT_STEP);

  // Proteksi rute & auto-exit jika sesi dinonaktifkan pengawas
  useEffect(() => {
    if (sessionTerminatedReason) {
      alert(sessionTerminatedReason);
      clearSessionTerminatedReason();
      navigate('/');
      return;
    }
    if (!isParticipantLoggedIn) {
      navigate('/');
    } else {
      loadQuestions();
    }
  }, [isParticipantLoggedIn, sessionTerminatedReason, clearSessionTerminatedReason, navigate, loadQuestions]);

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

  // Handler Waktu Habis: langsung simpan otomatis semua jawaban
  const handleTimeUp = async () => {
    try {
      await submitExam({ allowIncomplete: true });
      navigate('/result');
    } catch (err) {
      alert('Waktu ujian telah habis. Lembar jawaban Anda telah tersimpan secara otomatis.');
      navigate('/result');
    }
  };

  // Timer Sinkron Server + Batas Akhir Jadwal Sesi
  const timer = useServerTimer({
    startTime: participant?.startTime,
    durationMinutes: sessionData?.duration_minutes || 60,
    endAt: sessionData?.end_at,
    onTimeUp: handleTimeUp,
    isActive: isParticipantLoggedIn && !submitting
  });

  const handleSubmit = async () => {
    if (answeredCount < totalQuestions) {
      alert(`Masih ada ${totalQuestions - answeredCount} soal yang belum terjawab. Anda wajib menjawab seluruh soal sebelum mengirim ujian.`);
      return;
    }
    try {
      setShowConfirmModal(false);
      await submitExam();
      navigate('/result');
    } catch (err) {
      alert('Gagal mengirimkan ujian: ' + err.message);
    }
  };

  if (submitting) {
    return (
      <LoadingScreen
        fullScreen
        message="Mengirim & Memproses Jawaban Ujian..."
        submessage="Jawaban Anda sedang diverifikasi dan disimpan dengan aman ke database Google Sheets..."
      />
    );
  }

  if (loading || !currentQuestion) {
    return (
      <LoadingScreen
        fullScreen
        message="Menyiapkan Lembar Ujian Pelatihan Guru PAI..."
        submessage="Sedang mengunduh butir soal, opsi jawaban, dan menyinkronkan pengawas waktu ujian..."
      />
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

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {/* Pengatur Ukuran Font Up & Down (Seragam Soal & Pilihan Jawaban) */}
            <div
              className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-2xl p-1"
              title="Naik/turunkan ukuran font soal & pilihan jawaban"
            >
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 px-1.5">
                <Type className="w-3.5 h-3.5 text-kemenag-600" />
                Font:
              </span>
              <button
                type="button"
                onClick={handleDecreaseFont}
                disabled={fontSizePx <= MIN_FONT_SIZE}
                title="Perkecil ukuran font"
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-xl text-[11px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-kemenag-50 hover:text-kemenag-700 hover:border-kemenag-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ArrowDown className="w-3 h-3" />
                A-
              </button>
              <span className="px-1.5 text-[11px] font-bold text-slate-700 tabular-nums">
                {fontSizePx}px
              </span>
              <button
                type="button"
                onClick={handleIncreaseFont}
                disabled={fontSizePx >= MAX_FONT_SIZE}
                title="Perbesar ukuran font"
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-xl text-[11px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-kemenag-50 hover:text-kemenag-700 hover:border-kemenag-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ArrowUp className="w-3 h-3" />
                A+
              </button>
            </div>

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
              fontSizePx={fontSizePx}
              minFontSize={MIN_FONT_SIZE}
              maxFontSize={MAX_FONT_SIZE}
              onDecreaseFont={handleDecreaseFont}
              onIncreaseFont={handleIncreaseFont}
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
                  variant={unAnsweredCount > 0 ? 'secondary' : 'success'}
                  onClick={() => setShowConfirmModal(true)}
                  disabled={unAnsweredCount > 0 || submitting}
                  title={
                    unAnsweredCount > 0
                      ? `Masih ada ${unAnsweredCount} soal belum dijawab. Semua soal harus diisi.`
                      : 'Kumpulkan seluruh lembar jawaban'
                  }
                  icon={unAnsweredCount > 0 ? Lock : Send}
                >
                  {unAnsweredCount > 0
                    ? `Selesai (${answeredCount}/${totalQuestions})`
                    : 'Selesai & Kumpulkan'}
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
              className={`w-full rounded-2xl ${
                unAnsweredCount > 0
                  ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed'
                  : 'border-rose-200 text-rose-600 hover:bg-rose-50'
              }`}
              onClick={() => setShowConfirmModal(true)}
              disabled={unAnsweredCount > 0 || submitting}
              title={
                unAnsweredCount > 0
                  ? `Semua soal (${totalQuestions}) harus dijawab sebelum mengirim ujian`
                  : 'Kumpulkan lembar jawaban'
              }
              icon={unAnsweredCount > 0 ? Lock : Send}
            >
              {unAnsweredCount > 0
                ? `Kumpulkan Ujian (${answeredCount}/${totalQuestions})`
                : 'Kumpulkan Ujian'}
            </Button>

            {unAnsweredCount > 0 && (
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="w-full p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold hover:bg-amber-100 transition text-center"
              >
                Wajib jawab semua soal. Cek {unAnsweredCount} nomor kosong →
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Modal Peringatan / Teguran dari Pengawas Ujian */}
      {proctorMessage && (
        <Modal
          isOpen={!!proctorMessage}
          onClose={clearProctorMessage}
          title="Pesan dari Pengawas Ujian"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-center p-2">
            <div className="w-14 h-14 mx-auto rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <h4 className="text-base font-black text-rose-950">Teguran / Instruksi Pengawas</h4>
              <p className="text-xs text-rose-900 font-semibold mt-2 leading-relaxed bg-rose-50 p-3 rounded-2xl border border-rose-200">
                "{proctorMessage}"
              </p>
            </div>
            <p className="text-[11px] text-slate-500">
              Harap patuhi instruksi pengawas dan tetap fokus pada lembar soal. Pelanggaran berulang dapat mengakibatkan diskualifikasi.
            </p>
            <Button
              variant="primary"
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold"
              onClick={clearProctorMessage}
            >
              Saya Mengerti & Lanjutkan Ujian
            </Button>
          </div>
        </Modal>
      )}
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
            {unAnsweredCount > 0
              ? 'Ujian belum dapat dikirim karena masih terdapat soal yang belum terjawab. Silakan lengkapi seluruh soal terlebih dahulu.'
              : 'Apakah Anda yakin ingin mengumpulkan seluruh lembar jawaban sekarang?'}
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
              <span className={`block text-lg font-bold ${unAnsweredCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                {unAnsweredCount}
              </span>
              <span className="text-[11px] text-slate-500">Belum</span>
            </div>
          </div>

          {unAnsweredCount > 0 && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>Masih ada {unAnsweredCount} butir soal yang belum Anda jawab!</span>
              </div>
              <p className="text-[11px] text-rose-700">
                Klik nomor soal di bawah ini untuk langsung menuju ke soal yang masih kosong:
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
                {questions.map((q, idx) => {
                  const ans = answers[q.question_id];
                  const isAns = Array.isArray(ans)
                    ? ans.length > 0
                    : Boolean(ans !== undefined && ans !== null && String(ans).trim() !== '');
                  if (isAns) return null;
                  return (
                    <button
                      key={q.question_id || idx}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(idx);
                        setShowConfirmModal(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white border border-rose-300 text-rose-700 font-bold text-[11px] hover:bg-rose-100 transition"
                    >
                      No. {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowConfirmModal(false)}
              disabled={submitting}
            >
              {unAnsweredCount > 0 ? 'Kembali ke Soal' : 'Cek Kembali'}
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleSubmit}
              disabled={submitting || unAnsweredCount > 0}
              title={unAnsweredCount > 0 ? 'Semua soal wajib dijawab sebelum mengirim ujian' : 'Kirim seluruh jawaban'}
            >
              {submitting
                ? 'Mengirim...'
                : unAnsweredCount > 0
                  ? `Belum Lengkap (${unAnsweredCount})`
                  : 'Ya, Kumpulkan'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
