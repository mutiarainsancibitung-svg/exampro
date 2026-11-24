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
          const isAnswered = Array.isArray(ans) ? ans.length > 0 : Boolean(ans !== undefined && ans !== null && String(ans).trim() !== '');

          let btnColor = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200';

          if (isCurrent) {
            btnColor = 'ring-2 ring-indigo-600 ring-offset-1 font-bold';
          }

          if (isFlag) {
            btnColor += ' bg-amber-100 text-amber-900 border-amber-300';
          } else if (isAnswered) {
            btnColor += ' bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600';
          }

          return (
            <button
              key={q.question_id || idx}
              onClick={() => onSelectIndex(idx)}
              className={`h-10 rounded-xl text-xs font-semibold border flex items-center justify-center transition-all ${btnColor}`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Keterangan Warna */}
      <div className="pt-3 border-t border-slate-100 space-y-2 text-[11px] text-slate-600">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-lg bg-indigo-600 shrink-0" />
          <span>Sudah Dijawab</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-lg bg-amber-100 border border-amber-300 shrink-0" />
          <span>Ragu-ragu</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-lg bg-slate-100 border border-slate-200 shrink-0" />
          <span>Belum Dijawab</span>
        </div>
      </div>
    </Card>
  );
};
