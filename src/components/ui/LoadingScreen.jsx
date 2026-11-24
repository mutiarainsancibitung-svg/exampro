import React from 'react';

/**
 * Komponen Loading Screen Resmi UIN & Kemenag
 * Digunakan untuk menampilkan status persiapan aplikasi baik di sisi peserta maupun admin.
 */
export const LoadingScreen = ({
  message = 'Menyiapkan Aplikasi Ujian CBT...',
  submessage = 'Mohon tunggu sejenak, sedang menyinkronkan data dengan server...',
  fullScreen = false
}) => {
  const content = (
    <div className="flex flex-col items-center justify-center text-center p-8 max-w-sm mx-auto">
      {/* Logo Kemenag & UIN Jakarta */}
      <div className="flex items-center gap-3 mb-6 bg-white p-3 rounded-2xl shadow-sm border border-kemenag-100/80">
        <img
          src="/Logo_Kemenag.png"
          alt="Logo Kemenag"
          className="w-9 h-9 object-contain"
        />
        <div className="w-px h-6 bg-slate-200" />
        <img
          src="/Logo_UIN.png"
          alt="Logo UIN"
          className="w-9 h-9 object-contain"
        />
      </div>

      {/* Modern Spinner */}
      <div className="relative mb-6">
        <div className="w-14 h-14 rounded-full border-4 border-kemenag-100" />
        <div className="w-14 h-14 rounded-full border-4 border-kemenag-600 border-t-transparent animate-spin absolute top-0 left-0 shadow-sm" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping" />
      </div>

      {/* Teks Pesan */}
      <h3 className="text-base font-extrabold text-slate-800 tracking-tight mb-1.5">
        {message}
      </h3>
      <p className="text-xs text-slate-500 leading-relaxed font-medium">
        {submessage}
      </p>

      {/* Indikator Titik Animasi */}
      <div className="mt-5 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-kemenag-600 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 rounded-full bg-kemenag-600 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 rounded-full bg-kemenag-600 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mint-grid p-4 z-50 fixed inset-0 backdrop-blur-sm">
        <div className="bg-white/95 rounded-3xl shadow-xl shadow-kemenag-900/10 border border-kemenag-100/80">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="py-16 flex items-center justify-center">
      <div className="bg-white rounded-3xl shadow-sm border border-kemenag-100/80">
        {content}
      </div>
    </div>
  );
};
