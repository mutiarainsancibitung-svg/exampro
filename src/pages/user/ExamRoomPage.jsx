import React, { useEffect, useState, useCallback } from 'react';
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
import { getDisabilityMeta } from '../../utils/disabilityConfig';
import {
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle,
  Maximize2,
  Type,
  ArrowDown,
  ArrowUp,
  Lock,
  RotateCw,
  LogOut,
  Accessibility,
  Volume2,
  Square,
  Contrast,
  EyeOff,
  Eye
} from 'lucide-react';

const MIN_FONT_SIZE = 14;
const FONT_STEP = 2;

export const ExamRoomPage = () => {
  const navigate = useNavigate();
  const { participant, sessionData, isParticipantLoggedIn, logoutParticipant } = useAuth();
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
    loadError,
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

  const disabilityMeta = getDisabilityMeta(participant?.disability_type);
  const isDisabilityMode = disabilityMeta.skipAntiCheat;
  const maxFontSize = disabilityMeta.maxFontSizePx || 28;
  const defaultFontSize = disabilityMeta.defaultFontSizePx || 16;

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [fontSizePx, setFontSizePx] = useState(() => {
    const saved = Number(localStorage.getItem('exampro_font_size_px'));
    if (!Number.isNaN(saved) && saved >= MIN_FONT_SIZE && saved <= 36) {
      return Math.max(saved, defaultFontSize);
    }
    return defaultFontSize;
  });

  // Preferensi Aksesibilitas Adaptif (otomatis terisi sesuai jenis disabilitas peserta)
  const [themeMode, setThemeMode] = useState(() => disabilityMeta.defaults.themeMode || 'normal');
  const [dyslexiaSpacing, setDyslexiaSpacing] = useState(() => Boolean(disabilityMeta.defaults.dyslexiaSpacing));
  const [largeHitTargets, setLargeHitTargets] = useState(() => Boolean(disabilityMeta.defaults.largeHitTargets));
  const [calmFocus, setCalmFocus] = useState(() => Boolean(disabilityMeta.defaults.calmFocus));
  const [hideNavSidebar, setHideNavSidebar] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);

  // Sinkronkan preferensi default ketika profil disabilitas peserta dimuat
  useEffect(() => {
    setThemeMode(disabilityMeta.defaults.themeMode || 'normal');
    setDyslexiaSpacing(Boolean(disabilityMeta.defaults.dyslexiaSpacing));
    setLargeHitTargets(Boolean(disabilityMeta.defaults.largeHitTargets));
    setCalmFocus(Boolean(disabilityMeta.defaults.calmFocus));
    setFontSizePx(disabilityMeta.defaultFontSizePx || 16);
  }, [disabilityMeta.key]);

  const updateFontSize = (nextSize) => {
    const clamped = Math.max(MIN_FONT_SIZE, Math.min(maxFontSize, nextSize));
    setFontSizePx(clamped);
    localStorage.setItem('exampro_font_size_px', String(clamped));
  };

  const handleDecreaseFont = () => updateFontSize(fontSizePx - FONT_STEP);
  const handleIncreaseFont = () => updateFontSize(fontSizePx + FONT_STEP);

  // Fungsi Pembaca Suara Soal & Pilihan (Web Speech API Bahasa Indonesia)
  const stopSpeaking = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch (e) {}
    setIsSpeaking(false);
  }, []);

  const speakCurrentQuestion = useCallback(() => {
    if (!currentQuestion || typeof window === 'undefined' || !window.speechSynthesis) {
      alert('Browser Anda tidak mendukung fitur Pembaca Suara otomatis. Anda tetap dapat memakai Screen Reader eksternal.');
      return;
    }
    if (isSpeaking) {
      stopSpeaking();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const optsText = (currentQuestion.options || [])
        .map((opt, idx) => `Pilihan ${String.fromCharCode(65 + idx)}: ${opt.text}.`)
        .join(' ');
      const scriptText = `Soal nomor ${currentIndex + 1}. ${currentQuestion.question_text}. ${optsText}`;
      const utter = new SpeechSynthesisUtterance(scriptText);
      utter.lang = 'id-ID';
      utter.rate = speechRate;
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utter);
    } catch (e) {
      setIsSpeaking(false);
    }
  }, [currentQuestion, currentIndex, isSpeaking, speechRate, stopSpeaking]);

  useEffect(() => {
    stopSpeaking();
    return () => stopSpeaking();
  }, [currentIndex, stopSpeaking]);

  // Auto-exit jika sesi dinonaktifkan pengawas
  useEffect(() => {
    if (sessionTerminatedReason) {
      alert(sessionTerminatedReason);
      clearSessionTerminatedReason();
      navigate('/');
    }
  }, [sessionTerminatedReason, clearSessionTerminatedReason, navigate]);

  // Proteksi rute & muat soal sekali per sesi login peserta
  const participantKey = participant?.participantId || '';
  const sessionKey = sessionData?.session_id || '';
  useEffect(() => {
    if (!isParticipantLoggedIn) {
      navigate('/');
      return;
    }
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isParticipantLoggedIn, participantKey, sessionKey, navigate]);

  // Hook Anti-Cheat: HANYA AKTIF bagi peserta Non-Disabilitas!
  // Peserta penyandang disabilitas dibebaskan dari peringatan tab/blur agar screen reader, magnifier, switch, dll tidak terblokir.
  const {
    violationCount,
    showWarning,
    warningMessage,
    closeWarning,
    requestFullscreen
  } = useAntiCheat({
    onViolation: registerViolation,
    isExamActive: isParticipantLoggedIn && !submitting && !isDisabilityMode
  });

  // Pintasan Keyboard untuk Aksesibilitas (Tunanetra / Tunadaksa / Keyboard-Only)
  useEffect(() => {
    if (!isDisabilityMode && !disabilityMeta.defaults.keyboardShortcuts) return;
    const handleA11yKeyDown = (e) => {
      const tag = String(e.target?.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'input') return;

      if (e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        speakCurrentQuestion();
        return;
      }
      if (e.key === 'ArrowRight' && currentIndex < totalQuestions - 1) {
        e.preventDefault();
        setCurrentIndex(i => i + 1);
        return;
      }
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        setCurrentIndex(i => i - 1);
        return;
      }
      if (currentQuestion && currentQuestion.type !== 'essay' && currentQuestion.options?.length) {
        const numIdx = ['1', '2', '3', '4', '5'].indexOf(e.key);
        const letterIdx = ['a', 'b', 'c', 'd', 'e'].indexOf(e.key.toLowerCase());
        const pickedIdx = numIdx !== -1 ? numIdx : letterIdx;
        if (pickedIdx !== -1 && currentQuestion.options[pickedIdx]) {
          e.preventDefault();
          const optId = currentQuestion.options[pickedIdx].id;
          if (currentQuestion.type === 'single_choice') {
            setAnswer(currentQuestion.question_id, optId);
          } else {
            const curr = Array.isArray(answers[currentQuestion.question_id]) ? [...answers[currentQuestion.question_id]] : [];
            const next = curr.includes(optId) ? curr.filter(x => x !== optId) : [...curr, optId];
            setAnswer(currentQuestion.question_id, next);
          }
        }
      }
    };
    window.addEventListener('keydown', handleA11yKeyDown);
    return () => window.removeEventListener('keydown', handleA11yKeyDown);
  }, [isDisabilityMode, disabilityMeta, currentIndex, totalQuestions, currentQuestion, answers, setAnswer, setCurrentIndex, speakCurrentQuestion]);

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

  // Timer Sinkron Server + Ekstra Waktu otomatis bagi penyandang disabilitas terkait
  const baseDuration = Number(sessionData?.duration_minutes) || 60;
  const effectiveDurationMinutes = Math.round(baseDuration * (disabilityMeta.timeMultiplier || 1));

  const timer = useServerTimer({
    startTime: participant?.startTime,
    durationMinutes: effectiveDurationMinutes,
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

  if (loading) {
    return (
      <LoadingScreen
        fullScreen
        message="Menyiapkan Lembar Ujian Pelatihan Guru PAI..."
        submessage="Sedang mengunduh butir soal, opsi jawaban, dan menyinkronkan pengawas waktu ujian..."
      />
    );
  }

  if (loadError || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mint-grid p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-rose-200 shadow-lg p-7 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-extrabold text-slate-900 text-base">
              Soal Ujian Belum Dapat Ditampilkan
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {loadError || `Butir soal untuk paket "${participant?.paket || '-'}" belum tersedia atau gagal diunduh dari server.`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Button
              variant="primary"
              className="flex-1 justify-center"
              icon={RotateCw}
              onClick={() => loadQuestions()}
            >
              Muat Ulang Soal
            </Button>
            <Button
              variant="outline"
              className="flex-1 justify-center border-slate-200 text-slate-700"
              icon={LogOut}
              onClick={() => {
                logoutParticipant();
                navigate('/');
              }}
            >
              Kembali ke Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const unAnsweredCount = totalQuestions - answeredCount;
  const flaggedCount = Object.values(flagged).filter(Boolean).length;

  const pageBgClass =
    themeMode === 'high_contrast'
      ? 'bg-neutral-950 text-yellow-200'
      : themeMode === 'dark'
        ? 'bg-slate-950 text-slate-100'
        : themeMode === 'dyslexia_cream'
          ? 'bg-[#F8F3E6] text-slate-900'
          : 'bg-mint-grid';

  return (
    <div className={`min-h-screen flex flex-col pb-12 transition-colors ${pageBgClass} ${isDisabilityMode ? '' : 'no-select'}`}>
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
                disabled={fontSizePx >= maxFontSize}
                title="Perbesar ukuran font"
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-xl text-[11px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-kemenag-50 hover:text-kemenag-700 hover:border-kemenag-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ArrowUp className="w-3 h-3" />
                A+
              </button>
            </div>

            {!isDisabilityMode && (
              <button
                onClick={requestFullscreen}
                title="Masuk Mode Layar Penuh"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-kemenag-200 text-xs font-semibold text-kemenag-700 hover:bg-kemenag-50"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Layar Penuh
              </button>
            )}

            <TimerDisplay
              formatTime={timer.formatTime}
              isLowTime={!calmFocus && timer.isLowTime}
              isCriticalTime={!calmFocus && timer.isCriticalTime}
            />
          </div>
        </div>
      </div>

      {/* Bilah Alat Aksesibilitas Khusus Penyandang Disabilitas (Non-Disabilitas tidak melihat ini) */}
      {isDisabilityMode && (
        <div className={`border-b px-4 md:px-8 py-2.5 ${
          themeMode === 'high_contrast'
            ? 'bg-black border-yellow-400 text-yellow-200'
            : themeMode === 'dark'
              ? 'bg-slate-900 border-slate-700 text-slate-100'
              : 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
        }`}>
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-extrabold px-2.5 py-1 rounded-xl bg-indigo-600 text-white">
                <Accessibility className="w-3.5 h-3.5" />
                Mode {disabilityMeta.shortLabel}
              </span>
              <span className="text-[11px] font-semibold opacity-90">
                Peringatan pindah tab dimatikan ({disabilityMeta.extraTimeLabel})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Pembaca Suara TTS */}
              <button
                type="button"
                onClick={speakCurrentQuestion}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold border transition ${
                  isSpeaking ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                }`}
                title="Bacakan soal dan pilihan jawaban (Alt+B)"
              >
                {isSpeaking ? <Square className="w-3 h-3 fill-current" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>{isSpeaking ? 'Stop Suara' : 'Baca Suara (Alt+B)'}</span>
              </button>

              {/* Tema Kontras / Disleksia */}
              <div className="inline-flex items-center gap-1 bg-white border border-indigo-200 rounded-xl p-0.5 text-slate-700">
                <Contrast className="w-3.5 h-3.5 text-indigo-600 ml-1" />
                <select
                  value={themeMode}
                  onChange={(e) => setThemeMode(e.target.value)}
                  className="px-1.5 py-0.5 text-[11px] font-bold bg-transparent focus:outline-none"
                  title="Pilih mode kontras tampilan"
                >
                  <option value="normal">Tema Standar</option>
                  <option value="high_contrast">Kontras AAA (Hitam-Kuning)</option>
                  <option value="dark">Mode Gelap</option>
                  <option value="dyslexia_cream">Krem Disleksia</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setDyslexiaSpacing(v => !v)}
                className={`px-2.5 py-1 rounded-xl font-bold border text-[11px] transition ${
                  dyslexiaSpacing ? 'bg-amber-200 text-amber-950 border-amber-400' : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                Spasi Lega
              </button>

              <button
                type="button"
                onClick={() => setLargeHitTargets(v => !v)}
                className={`px-2.5 py-1 rounded-xl font-bold border text-[11px] transition ${
                  largeHitTargets ? 'bg-teal-200 text-teal-950 border-teal-400' : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                Tombol Besar
              </button>

              <button
                type="button"
                onClick={() => setHideNavSidebar(v => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold border text-[11px] transition ${
                  hideNavSidebar ? 'bg-indigo-200 text-indigo-950 border-indigo-400' : 'bg-white text-slate-700 border-slate-200'
                }`}
                title="Sembunyikan/tampilkan daftar nomor agar fokus membaca soal"
              >
                {hideNavSidebar ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>{hideNavSidebar ? 'Tampilkan Grid' : 'Fokus Tenang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 md:px-8 pt-6 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Kolom Soal (3 Kolom atau Penuh saat Fokus Tenang) */}
          <div className={`${hideNavSidebar ? 'lg:col-span-4' : 'lg:col-span-3'} space-y-6`}>
            <QuestionCard
              questionNumber={currentIndex + 1}
              question={currentQuestion}
              userAnswer={answers[currentQuestion.question_id]}
              onAnswerChange={(val) => setAnswer(currentQuestion.question_id, val)}
              isFlagged={Boolean(flagged[currentQuestion.question_id])}
              onToggleFlag={() => toggleFlag(currentQuestion.question_id)}
              fontSizePx={fontSizePx}
              minFontSize={MIN_FONT_SIZE}
              maxFontSize={maxFontSize}
              onDecreaseFont={handleDecreaseFont}
              onIncreaseFont={handleIncreaseFont}
              themeMode={themeMode}
              dyslexiaSpacing={dyslexiaSpacing}
              largeHitTargets={largeHitTargets}
              showAudioControls={isDisabilityMode}
              isSpeaking={isSpeaking}
              onToggleSpeak={speakCurrentQuestion}
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

          {/* Sidebar Navigasi Grid (1 Kolom, disembunyikan jika Fokus Tenang aktif) */}
          {!hideNavSidebar && (
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
          )}
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
      {!isDisabilityMode && (
        <ViolationModal
          isOpen={showWarning}
          onClose={closeWarning}
          violationCount={violationCount}
          message={warningMessage}
        />
      )}

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
