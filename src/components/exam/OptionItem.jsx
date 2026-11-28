import React, { useState } from 'react';
import { ZoomIn, X } from 'lucide-react';

export const OptionItem = ({
  option,
  displayLabel,
  type = 'single_choice',
  isSelected = false,
  fontSizePx = 16,
  themeMode = 'normal',
  dyslexiaSpacing = false,
  largeHitTargets = false,
  onSelect
}) => {
  const [showImgModal, setShowImgModal] = useState(false);
  const badgeLabel = displayLabel || option.label || option.id;
  const resolvedFontSize = typeof fontSizePx === 'number' ? `${fontSizePx}px` : (fontSizePx || '16px');

  const isHighContrast = themeMode === 'high_contrast';
  const isDark = themeMode === 'dark';
  const isCream = themeMode === 'dyslexia_cream';

  const containerThemeClass = isHighContrast
    ? isSelected
      ? 'bg-yellow-400 border-yellow-300 text-black ring-2 ring-yellow-300'
      : 'bg-black border-yellow-400/70 text-yellow-200 hover:border-yellow-300'
    : isDark
      ? isSelected
        ? 'bg-indigo-950 border-indigo-400 ring-2 ring-indigo-400 text-white'
        : 'bg-slate-800 border-slate-600 text-slate-100 hover:border-slate-400'
      : isCream
        ? isSelected
          ? 'bg-amber-100/90 border-amber-600 ring-1 ring-amber-600 text-slate-900'
          : 'bg-[#FAF6EC] border-amber-200 text-slate-900 hover:border-amber-400'
        : isSelected
          ? 'bg-indigo-50/60 border-indigo-500 shadow-sm ring-1 ring-indigo-500'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80';

  const badgeThemeClass = isHighContrast
    ? isSelected
      ? 'bg-black border-black text-yellow-300'
      : 'bg-black border-yellow-300 text-yellow-300'
    : isSelected
      ? 'bg-indigo-600 border-indigo-600 text-white'
      : isDark
        ? 'border-slate-400 text-slate-200'
        : 'border-slate-300 text-slate-500 group-hover:border-slate-400';

  const textThemeClass = isHighContrast
    ? isSelected
      ? 'text-black font-semibold'
      : 'text-yellow-200'
    : isDark
      ? 'text-slate-100'
      : isSelected
        ? 'text-indigo-950'
        : 'text-slate-800';

  const textSpacingStyle = {
    fontSize: resolvedFontSize,
    lineHeight: dyslexiaSpacing ? '1.9' : '1.65',
    ...(dyslexiaSpacing ? { letterSpacing: '0.04em', wordSpacing: '0.12em' } : {})
  };

  return (
    <div
      role={type === 'single_choice' ? 'radio' : 'checkbox'}
      aria-checked={isSelected}
      aria-label={`Pilihan ${badgeLabel}: ${option.text}`}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group relative flex items-start gap-4 rounded-2xl border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
        largeHitTargets ? 'p-5 min-h-[68px]' : 'p-4'
      } ${containerThemeClass}`}
    >
      {/* Icon Indicator (Radio / Checkbox) */}
      <div className="mt-0.5 shrink-0">
        <div
          className={`${largeHitTargets ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-xs'} ${
            type === 'single_choice' ? 'rounded-full' : 'rounded-lg'
          } flex items-center justify-center font-bold border transition-colors ${badgeThemeClass}`}
        >
          {badgeLabel}
        </div>
      </div>

      {/* Option Text & Optional Image (Font ukuran seragam persis dengan teks soal) */}
      <div className="flex-1 space-y-2">
        <span style={textSpacingStyle} className={`font-normal block ${textThemeClass}`}>
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
