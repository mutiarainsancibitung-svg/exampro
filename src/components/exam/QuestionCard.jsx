import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { OptionItem } from './OptionItem';
import { Flag, ZoomIn, X } from 'lucide-react';

export const QuestionCard = ({
  questionNumber,
  question,
  userAnswer,
  onAnswerChange,
  isFlagged,
  onToggleFlag
}) => {
  const [showImgModal, setShowImgModal] = useState(false);

  if (!question) return null;

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
    <Card className="p-6 md:p-8 space-y-6 bg-white rounded-3xl border border-kemenag-100 shadow-sm">
      {/* Header Soal */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-9 h-9 rounded-2xl bg-kemenag-600 text-white font-extrabold text-sm shadow-sm shadow-kemenag-200">
            {questionNumber}
          </span>
          <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-kemenag-50 text-kemenag-700 border border-kemenag-200">
            {typeLabels[question.type] || 'Soal'}
          </span>
          <span className="text-xs text-slate-400 font-medium">
            Bobot: {question.weight || 1} poin
          </span>
        </div>

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

      {/* Teks Soal & Media Gambar */}
      <div className="space-y-4">
        <p className="text-slate-800 text-base md:text-lg leading-relaxed font-normal whitespace-pre-line no-select">
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
                  onSelect={() => handleMultipleSelect(opt.id)}
                />
              );
            })}
          </div>
        )}

        {question.type === 'essay' && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-500">
              Ketikkan jawaban uraian Anda pada kotak di bawah:
            </label>
            <textarea
              rows={6}
              value={userAnswer || ''}
              onChange={(e) => onAnswerChange(e.target.value)}
              placeholder="Tulis jawaban lengkap Anda di sini..."
              className="w-full p-4 rounded-2xl border border-slate-200 focus:border-kemenag-600 focus:ring-2 focus:ring-kemenag-100 text-sm text-slate-800 transition resize-y font-medium"
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
