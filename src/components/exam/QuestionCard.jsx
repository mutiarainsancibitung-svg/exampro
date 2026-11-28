import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { OptionItem } from './OptionItem';
import { Flag, ZoomIn, X, Type, ArrowDown, ArrowUp, Volume2, Square } from 'lucide-react';

export const QuestionCard = ({
  questionNumber,
  question,
  userAnswer,
  onAnswerChange,
  isFlagged,
  onToggleFlag,
  fontSizePx = 16,
  minFontSize = 14,
  maxFontSize = 28,
  onDecreaseFont,
  onIncreaseFont,
  themeMode = 'normal',
  dyslexiaSpacing = false,
  largeHitTargets = false,
  showAudioControls = false,
  isSpeaking = false,
  onToggleSpeak
}) => {
  const [showImgModal, setShowImgModal] = useState(false);

  if (!question) return null;

  const resolvedFontSize = `${fontSizePx}px`;
  const isHighContrast = themeMode === 'high_contrast';
  const isDark = themeMode === 'dark';
  const isCream = themeMode === 'dyslexia_cream';

  const cardThemeClass = isHighContrast
    ? 'bg-black border-yellow-400 text-yellow-200'
    : isDark
      ? 'bg-slate-900 border-slate-700 text-slate-100'
      : isCream
        ? 'bg-[#FDFBF4] border-amber-200 text-slate-900'
        : 'bg-white border-kemenag-100';

  const questionTextStyle = {
    fontSize: resolvedFontSize,
    lineHeight: dyslexiaSpacing ? '1.9' : '1.65',
    ...(dyslexiaSpacing ? { letterSpacing: '0.04em', wordSpacing: '0.12em' } : {})
  };

  const questionTextColor = isHighContrast
    ? 'text-yellow-100'
    : isDark
      ? 'text-slate-100'
      : 'text-slate-800';

  const typeLabels = {
    single_choice: 'Pilihan Ganda Tunggal',
    multiple_choice: 'Pilihan Ganda Jamak (Bisa > 1)',
    essay: 'Uraian / Essay'
  };

  const handleSingleSelect = (optId) => {
    onAnswerChange(optId);
  };

  const handleMultipleSelect = (optId) => {
    let current = Array.isArray(userAnswer) ? [...userAnswer] : [];
    if (current.includes(optId)) {
      current = current.filter(id => id !== optId);
    } else {
      current.push(optId);
    }
    onAnswerChange(current);
  };

  return (
    <Card
      className={`p-6 md:p-8 space-y-6 rounded-3xl border shadow-sm transition-colors ${cardThemeClass}`}
      aria-live="polite"
    >
      {/* Header Soal + Pengatur Ukuran Font & Suara */}
      <div className={`flex flex-wrap items-center justify-between gap-3 pb-4 border-b ${
        isHighContrast ? 'border-yellow-400/40' : isDark ? 'border-slate-700' : 'border-slate-100'
      }`}>
        <div className="flex items-center gap-3">
          <span className={`flex items-center justify-center w-9 h-9 rounded-2xl font-extrabold text-sm shadow-sm ${
            isHighContrast
              ? 'bg-yellow-400 text-black'
              : 'bg-kemenag-600 text-white shadow-kemenag-200'
          }`}>
            {questionNumber}
          </span>
          <span className={`text-xs font-semibold px-3 py-1 rounded-xl border ${
            isHighContrast
              ? 'bg-black text-yellow-300 border-yellow-400'
              : isDark
                ? 'bg-slate-800 text-slate-200 border-slate-600'
                : 'bg-kemenag-50 text-kemenag-700 border-kemenag-200'
          }`}>
            {typeLabels[question.type] || 'Soal'}
          </span>
          <span className={`text-xs font-medium ${isHighContrast ? 'text-yellow-300' : 'text-slate-400'}`}>
            Bobot: {question.weight || 1} poin
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {showAudioControls && onToggleSpeak && (
            <button
              type="button"
              onClick={onToggleSpeak}
              title="Bacakan soal dan pilihan jawaban dengan suara (Alt+B)"
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-bold border transition ${
                isSpeaking
                  ? 'bg-rose-600 text-white border-rose-600'
                  : isHighContrast
                    ? 'bg-yellow-400 text-black border-yellow-300'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600'
              }`}
            >
              {isSpeaking ? <Square className="w-3.5 h-3.5 fill-current" /> : <Volume2 className="w-3.5 h-3.5" />}
              {isSpeaking ? 'Hentikan Suara' : 'Bacakan Soal'}
            </button>
          )}
          {(onDecreaseFont || onIncreaseFont) && (
            <div
              className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-2xl px-2 py-1"
              title="Atur ukuran font soal & pilihan jawaban"
            >
              <Type className="w-3.5 h-3.5 text-kemenag-600 mr-0.5" />
              <span className="text-[11px] font-semibold text-slate-600 hidden sm:inline mr-1">Ukuran Font:</span>
              <button
                type="button"
                onClick={onDecreaseFont}
                disabled={fontSizePx <= minFontSize}
                title="Perkecil ukuran font"
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-xl text-[11px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-kemenag-50 hover:text-kemenag-700 hover:border-kemenag-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ArrowDown className="w-3 h-3" />
                A-
              </button>
              <span className="px-2 text-[11px] font-bold text-slate-700 tabular-nums">
                {fontSizePx}px
              </span>
              <button
                type="button"
                onClick={onIncreaseFont}
                disabled={fontSizePx >= maxFontSize}
                title="Perbesar ukuran font"
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-xl text-[11px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-kemenag-50 hover:text-kemenag-700 hover:border-kemenag-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ArrowUp className="w-3 h-3" />
                A+
              </button>
            </div>
          )}

          {/* Tombol Ragu-ragu */}
          <button
            onClick={onToggleFlag}
            type="button"
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-semibold transition ${
              isFlagged
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
            }`}
          >
            <Flag className={`w-3.5 h-3.5 ${isFlagged ? 'fill-amber-600 text-amber-600' : ''}`} />
            {isFlagged ? 'Ragu-ragu' : 'Tandai Ragu'}
          </button>
        </div>
      </div>

      {/* Teks Soal & Media Gambar (Ukuran Font Seragam Persis dengan Pilihan Jawaban) */}
      <div className="space-y-4">
        <p
          style={questionTextStyle}
          className={`${questionTextColor} font-normal whitespace-pre-line ${largeHitTargets || showAudioControls ? '' : 'no-select'}`}
        >
          {question.question_text && !['single_choice', 'multiple_choice', 'essay'].includes(String(question.question_text).trim())
            ? question.question_text
            : (question.options && question.options.length > 0
                ? 'Pilihlah salah satu jawaban yang paling tepat di bawah ini:'
                : `Soal nomor ${questionNumber}`)}
        </p>

        {question.image_url && (
          <div className="relative inline-block my-2">
            <img
              src={question.image_url}
              alt="Ilustrasi Soal"
              className="max-h-72 rounded-2xl border border-slate-200 object-contain hover:shadow cursor-zoom-in"
              onClick={() => setShowImgModal(true)}
            />
            <span className="absolute bottom-2 right-2 p-1.5 bg-black/60 text-white rounded-lg pointer-events-none">
              <ZoomIn className="w-4 h-4" />
            </span>
          </div>
        )}
      </div>

      {/* Render Input Sesuai Tipe Soal */}
      <div className="pt-2">
        {question.type === 'single_choice' && (
          <div className="space-y-3">
            {(question.options || []).map((opt, optIndex) => {
              const displayLabel = String.fromCharCode(65 + optIndex); // Opsi huruf selalu urut A, B, C, D, E
              return (
                <OptionItem
                  key={opt.id || optIndex}
                  option={opt}
                  displayLabel={displayLabel}
                  type="single_choice"
                  isSelected={userAnswer === opt.id}
                  fontSizePx={resolvedFontSize}
                  themeMode={themeMode}
                  dyslexiaSpacing={dyslexiaSpacing}
                  largeHitTargets={largeHitTargets}
                  onSelect={() => handleSingleSelect(opt.id)}
                />
              );
            })}
          </div>
        )}

        {question.type === 'multiple_choice' && (
          <div className="space-y-3">
            {(question.options || []).map((opt, optIndex) => {
              const displayLabel = String.fromCharCode(65 + optIndex); // Opsi huruf selalu urut A, B, C, D, E
              const selectedArr = Array.isArray(userAnswer) ? userAnswer : [];
              const isSelected = selectedArr.includes(opt.id);
              return (
                <OptionItem
                  key={opt.id || optIndex}
                  option={opt}
                  displayLabel={displayLabel}
                  type="multiple_choice"
                  isSelected={isSelected}
                  fontSizePx={resolvedFontSize}
                  themeMode={themeMode}
                  dyslexiaSpacing={dyslexiaSpacing}
                  largeHitTargets={largeHitTargets}
                  onSelect={() => handleMultipleSelect(opt.id)}
                />
              );
            })}
          </div>
        )}

        {question.type === 'essay' && (
          <div className="space-y-2">
            <label className={`block text-xs font-semibold ${isHighContrast ? 'text-yellow-300' : isDark ? 'text-slate-300' : 'text-slate-500'}`}>
              Ketikkan jawaban uraian Anda pada kotak di bawah:
            </label>
            <textarea
              rows={6}
              value={userAnswer || ''}
              onChange={(e) => onAnswerChange(e.target.value)}
              placeholder="Tulis jawaban lengkap Anda di sini..."
              style={questionTextStyle}
              className={`w-full p-4 rounded-2xl border focus:ring-2 transition resize-y font-normal ${
                isHighContrast
                  ? 'bg-black border-yellow-400 text-yellow-200 focus:border-yellow-300'
                  : isDark
                    ? 'bg-slate-800 border-slate-600 text-slate-100 focus:border-indigo-400'
                    : isCream
                      ? 'bg-[#FAF6EC] border-amber-300 text-slate-900 focus:border-amber-600'
                      : 'border-slate-200 focus:border-kemenag-600 focus:ring-kemenag-100 text-slate-800'
              }`}
            />
            <p className="text-right text-xs text-slate-400">
              {(userAnswer || '').length} karakter
            </p>
          </div>
        )}
      </div>

      {/* Image Zoom Lightbox */}
      {showImgModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setShowImgModal(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={question.image_url} alt="Zoom" className="max-h-[85vh] rounded-3xl object-contain shadow-2xl" />
            <button
              onClick={() => setShowImgModal(false)}
              className="absolute -top-3 -right-3 p-2 bg-white text-slate-800 rounded-full shadow hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};
