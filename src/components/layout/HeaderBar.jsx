import React from 'react';
import { GraduationCap } from 'lucide-react';

export const HeaderBar = ({ participantInfo = null }) => {
  return (
    <header className="w-full bg-white border-b border-kemenag-100 shadow-sm py-3 px-4 md:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logos & Institution Title (Sesuai Gambar 2 menggunakan file asli Logo_Kemenag dan Logo_UIN) */}
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2.5">
            {/* Logo Kemenag RI */}
            <img
              src="/Logo_Kemenag.png"
              alt="Logo Kementerian Agama RI"
              className="w-10 h-10 object-contain drop-shadow-sm shrink-0"
            />

            {/* Logo UIN Syarif Hidayatullah Jakarta */}
            <img
              src="/Logo_UIN.png"
              alt="Logo UIN Syarif Hidayatullah Jakarta"
              className="w-10 h-10 object-contain drop-shadow-sm shrink-0"
            />
          </div>

          <div className="min-w-0">
            <h1 className="font-extrabold text-slate-800 text-sm md:text-base leading-tight tracking-tight">
              Pelatihan Guru PAI
            </h1>
            <p className="text-[11px] md:text-xs text-slate-500 font-medium truncate">
              Direktorat PAI Kemenag RI & FITK UIN Syarif Hidayatullah Jakarta
            </p>
          </div>
        </div>

        {/* User Status Bar (Sesuai Gambar 3: [Username] - PESERTA [Nama] 🎓) */}
        {participantInfo && (
          <div className="flex items-center gap-2 bg-kemenag-50 border border-kemenag-200 px-3.5 py-1.5 rounded-2xl text-xs">
            <span className="font-bold text-kemenag-800 truncate max-w-[140px] md:max-w-[260px]">
              {participantInfo.username || participantInfo.identifier} - PESERTA {participantInfo.fullName?.toUpperCase()}
            </span>
            <div className="w-6 h-6 rounded-lg bg-kemenag-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <GraduationCap className="w-3.5 h-3.5" />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
