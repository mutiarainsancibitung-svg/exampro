import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useExam } from '../../context/ExamContext';
import { HeaderBar } from '../../components/layout/HeaderBar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CheckCircle2, Award, Home } from 'lucide-react';

export const ResultPage = () => {
  const navigate = useNavigate();
  const { participant, sessionData, logoutParticipant } = useAuth();
  const { examResult } = useExam();

  useEffect(() => {
    // Jalankan efek selebrasi confetti jika hasil skor ditampilkan
    if (examResult?.showScore) {
      import('canvas-confetti')
        .then((module) => {
          const confetti = module.default || module;
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        })
        .catch(() => {});
    }
  }, [examResult]);

  const handleFinish = () => {
    logoutParticipant();
    navigate('/');
  };

  const showScore = examResult?.showScore;
  const score = examResult?.score;

  return (
    <div className="min-h-screen flex flex-col bg-mint-grid">
      <HeaderBar />

      <main className="flex-1 flex items-center justify-center p-4 md:p-8 my-auto">
        <div className="w-full max-w-lg space-y-6">
          <Card className="p-8 md:p-10 text-center space-y-6 bg-white rounded-4xl shadow-xl shadow-kemenag-900/5 border border-kemenag-100">
            <div className="w-16 h-16 rounded-3xl bg-kemenag-50 text-kemenag-600 flex items-center justify-center mx-auto border border-kemenag-200 shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                Ujian Berhasil Dikumpulkan!
              </h2>
              <p className="text-xs md:text-sm text-slate-500">
                Terima kasih telah mengikuti evaluasi Pelatihan Guru PAI dengan penuh integritas.
              </p>
            </div>

            {/* Rincian Peserta */}
            <div className="p-4 rounded-2xl bg-kemenag-50/60 border border-kemenag-100 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Peserta:</span>
                <span className="font-bold text-slate-800">{participant?.fullName || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nomor Induk / NIP:</span>
                <span className="font-mono font-semibold text-slate-700">{participant?.identifier || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sesi Evaluasi:</span>
                <span className="font-semibold text-kemenag-800">{sessionData?.title || '-'}</span>
              </div>
            </div>

            {/* Tampilan Skor Jika Diizinkan */}
            {showScore && score ? (
              <div className="p-6 rounded-3xl bg-kemenag-50 border border-kemenag-200 space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-kemenag-700 text-xs font-bold uppercase tracking-wider">
                  <Award className="w-4 h-4" />
                  Perolehan Skor Sementara
                </div>
                <div className="text-5xl font-black text-kemenag-700 tracking-tight">
                  {score.pgScore}
                  <span className="text-xl font-normal text-kemenag-500">/100</span>
                </div>
                {score.hasEssay && (
                  <p className="text-[11px] text-kemenag-700 font-medium pt-1">
                    *Skor di atas adalah pilihan ganda. Jawaban essay sedang dalam proses review pengajar.
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-100 text-slate-600 text-xs leading-relaxed">
                Hasil skor ujian ini diatur tersembunyi oleh panitia dan akan diumumkan secara resmi pada sesi evaluasi.
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              className="w-full font-bold text-sm py-3.5"
              onClick={handleFinish}
              icon={Home}
            >
              Kembali ke Halaman Utama
            </Button>
          </Card>
        </div>
      </main>
    </div>
  );
};
