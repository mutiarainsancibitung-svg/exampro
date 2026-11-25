import React from 'react';
import { Card } from '../ui/Card';

export const NavGrid = ({
  questions = [],
  currentIndex,
  onSelectIndex,
  answers = {},
  flagged = {}
}) => {
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h4 className="font-semibold text-slate-800 text-sm">Nomor Soal</h4>
        <span className="text-xs text-slate-500 font-medium">
          Total: {questions.length}
        </span>
      </div>

      {/* Grid Nomor */}
      <div className="grid grid-cols-5 gap-2 max-h-[340px] overflow-y-auto p-1">
        {questions.map((q, idx) => {
          const isCurrent = currentIndex === idx;
          const isFlag = Boolean(flagged[q.question_id]);
          const ans = answers[q.question_id];
          const isAnswered = Array.isArray(ans)
            ? ans.length > 0
            : Boolean(ans !== undefined && ans !== null && String(ans).trim() !== '');

          // Tentukan warna dasar tombol tanpa tumpang tindih kelas Tailwind
          let btnStyle = '';

          if (isFlag) {
            // Ragu-ragu: Kuning Amber
            btnStyle = 'bg-amber-400 text-amber-950 border-amber-500 hover:bg-amber-500 font-bold';
          } else if (isAnswered) {
            // Sudah Dijawab: Biru Solid (Tetap Biru meski pindah ke nomor lain)
            btnStyle = 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600 font-bold shadow-sm';
          } else {
            // Belum Dijawab: Abu-abu Slate
            btnStyle = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200 font-semibold';
          }

          // Efek Ring untuk nomor yang sedang aktif dikerjakan
          const ringStyle = isCurrent
            ? 'ring-2 ring-emerald-500 ring-offset-2 scale-105 z-10'
            : '';

          return (
            <button
              key={q.question_id || idx}
              onClick={() => onSelectIndex(idx)}
              className={`h-10 rounded-xl text-xs border flex items-center justify-center transition-all ${btnStyle} ${ringStyle}`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Keterangan Warna */}
      <div className="pt-3 border-t border-slate-100 space-y-2 text-[11px] text-slate-600">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-lg bg-blue-600 shrink-0 shadow-sm" />
          <span className="font-medium text-slate-700">Sudah Dijawab (Biru)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-lg bg-amber-400 border border-amber-500 shrink-0" />
          <span className="font-medium text-slate-700">Ragu-ragu (Kuning)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-lg bg-slate-100 border border-slate-200 shrink-0" />
          <span className="font-medium text-slate-700">Belum Dijawab (Abu-abu)</span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-[10px] text-slate-400">
          <span className="w-2.5 h-2.5 rounded-full ring-2 ring-emerald-500 ring-offset-1 inline-block shrink-0" />
          <span>Nomor yang sedang dibuka</span>
        </div>
      </div>
    </Card>
  );
};
