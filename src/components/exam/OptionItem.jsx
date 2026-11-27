import React, { useState } from 'react';
import { ZoomIn, X } from 'lucide-react';

export const OptionItem = ({
  option,
  displayLabel,
  type = 'single_choice',
  isSelected = false,
  fontSizePx = 16,
  onSelect
}) => {
  const [showImgModal, setShowImgModal] = useState(false);
  const badgeLabel = displayLabel || option.label || option.id;
  const resolvedFontSize = typeof fontSizePx === 'number' ? `${fontSizePx}px` : (fontSizePx || '16px');

  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
        isSelected
          ? 'bg-indigo-50/60 border-indigo-500 shadow-sm ring-1 ring-indigo-500'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
      }`}
    >
      {/* Icon Indicator (Radio / Checkbox) */}
      <div className="mt-0.5 shrink-0">
        {type === 'single_choice' ? (
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold text-xs border transition-colors ${
              isSelected
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-slate-300 text-slate-500 group-hover:border-slate-400'
            }`}
          >
            {badgeLabel}
          </div>
        ) : (
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center font-semibold text-xs border transition-colors ${
              isSelected
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-slate-300 text-slate-500 group-hover:border-slate-400'
            }`}
          >
            {badgeLabel}
          </div>
        )}
      </div>

      {/* Option Text & Optional Image (Font ukuran seragam persis dengan teks soal) */}
      <div className="flex-1 space-y-2">
        <span
          style={{ fontSize: resolvedFontSize, lineHeight: '1.65' }}
          className={`font-normal block ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}
        >
          {option.text}
        </span>

        {option.image && (
          <div className="relative inline-block mt-2">
            <img
              src={option.image}
              alt={`Opsi ${option.id}`}
              className="max-h-40 rounded-xl border border-slate-200 object-contain hover:opacity-90"
              onClick={(e) => {
                e.stopPropagation();
                setShowImgModal(true);
              }}
            />
          </div>
        )}
      </div>

      {/* Lightbox Preview */}
      {showImgModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setShowImgModal(false);
          }}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img src={option.image} alt="Preview" className="max-h-[85vh] rounded-2xl object-contain" />
            <button
              onClick={() => setShowImgModal(false)}
              className="absolute -top-3 -right-3 p-1.5 bg-white text-slate-800 rounded-full shadow"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
