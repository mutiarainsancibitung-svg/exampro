import React from 'react';
import { Clock } from 'lucide-react';

export const TimerDisplay = ({ formatTime, isLowTime, isCriticalTime }) => {
  const getBadgeClass = () => {
    if (isCriticalTime) {
      return 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse';
    }
    if (isLowTime) {
      return 'bg-amber-50 border-amber-300 text-amber-700';
    }
    return 'bg-slate-50 border-slate-200 text-slate-700';
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border font-mono font-semibold text-sm transition-colors ${getBadgeClass()}`}>
      <Clock className={`w-4 h-4 ${isCriticalTime ? 'text-rose-600' : isLowTime ? 'text-amber-600' : 'text-slate-500'}`} />
      <span>{formatTime()}</span>
    </div>
  );
};
