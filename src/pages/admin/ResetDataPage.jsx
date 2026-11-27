import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import * as XLSX from 'xlsx';
import {
  RotateCcw,
  Trash2,
  AlertTriangle,
  BookOpen,
  Users,
  Calendar,
  Flame,
  Download,
  CheckCircle2,
  RotateCw,
  ShieldAlert
} from 'lucide-react';

const RESET_OPTIONS = [
  {
    mode: 'all',
    title: 'Reset Semua',
    subtitle: 'Hapus seluruh Soal, Peserta, Sesi Ujian, & Rekap Nilai sekaligus',
    description:
      'Membersihkan seluruh data kegiatan ujian (Bank Soal, Data Peserta, Mata Ujian, Rekap Nilai & Arsip) agar sistem kembali kosong siap untuk batch pelatihan baru. Akun Admin & Role tetap dipertahankan.',
    keyword: 'RESET SEMUA',
    colorClass: 'border-rose-300 bg-rose-50/40',
    badgeClass: 'bg-rose-600 text-white',
    icon: Flame
  },
  {
    mode: 'questions',
    title: 'Reset Soal (Hapus Soal Semua)',
    subtitle: 'Hapus seluruh butir soal & paket di Bank Soal',
    description:
      'Menghapus seluruh baris soal pada sheet Questions di Google Sheets beserta seluruh paket soal yang terdaftar. Data peserta, sesi, dan riwayat nilai sebelumnya tidak dihapus.',
    keyword: 'HAPUS SOAL',
    colorClass: 'border-amber-300 bg-amber-50/40',
    badgeClass: 'bg-amber-600 text-white',
    icon: BookOpen
  },
  {
    mode: 'participants',
    title: 'Reset Peserta (Hapus Peserta Semua)',
    subtitle: 'Hapus seluruh daftar peserta & data Excel peserta',
    description:
      'Menghapus seluruh akun dan baris peserta pada sheet Participants. Cocok sebelum mengimpor daftar peserta angkatan/kegiatan yang baru.',
    keyword: 'HAPUS PESERTA',
    colorClass: 'border-orange-300 bg-orange-50/40',
    badgeClass: 'bg-orange-600 text-white',
    icon: Users
  },
  {
    mode: 'sessions',
    title: 'Reset Sesi (Hapus Sesi Semua)',
    subtitle: 'Hapus seluruh Mata Ujian / Kegiatan & bersihkan plotting',
    description:
      'Menghapus seluruh data sesi/mata ujian pada sheet Sessions serta membersihkan status plotting sesi & paket pada tabel peserta.',
    keyword: 'HAPUS SESI',
    colorClass: 'border-sky-300 bg-sky-50/40',
    badgeClass: 'bg-sky-600 text-white',
    icon: Calendar
  }
];

export const ResetDataPage = () => {
  const { adminSecretKey, isAdminLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMode = searchParams.get('mode') || 'all';

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    sessions: 0,
    questions: 0,
    participants: 0,
    submissions: 0
  });
  const [fullBackupCache, setFullBackupCache] = useState(null);

  // Modal Konfirmasi Reset
  const [confirmOption, setConfirmOption] = useState(null);
  const [confirmKeyword, setConfirmKeyword] = useState('');
  const [executing, setExecuting] = useState(false);
  const [lastResultMsg, setLastResultMsg] = useState('');

  useEffect(() => {
    if (!isAdminLoggedIn) {
      navigate('/admin/login');
      return;
    }
    loadSummary();
  }, [isAdminLoggedIn, navigate]);

  const loadSummary = async (forceRefresh = true) => {
    setLoading(true);
    try {
      const res = await gasApi.getAdminDashboard(adminSecretKey, forceRefresh);
      if (res.status === 'success') {
        setFullBackupCache(res);
        setStats({
          sessions: (res.sessions || []).length,
          questions: (res.questions || []).length,
          participants: (res.participants || []).length,
          submissions: (res.submissions || []).length
        });
      }
    } catch (err) {
      console.error('Gagal memuat statistik reset:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenResetModal = (opt) => {
    setConfirmOption(opt);
    setConfirmKeyword('');
  };

  const handleDownloadQuickBackup = async () => {
    try {
      const res = await gasApi.exportFullBackup(adminSecretKey);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(res.sessions || []), 'Sessions');
      const qRows = (res.questions || []).map(q => ({
        ...q,
        options_json: typeof q.options === 'object' ? JSON.stringify(q.options) : (q.options_json || '[]')
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(qRows), 'Questions');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(res.participants || []), 'Participants');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(res.submissions || []), 'Submissions');
      const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
      XLSX.writeFile(wb, `Backup_Sebelum_Reset_${nowStr}.xlsx`);
    } catch (err) {
      alert('Gagal mengunduh backup Excel: ' + err.message);
    }
  };

  const handleExecuteReset = async () => {
    if (!confirmOption) return;
    if (confirmKeyword.trim().toUpperCase() !== confirmOption.keyword) {
      alert(`Ketik kata konfirmasi "${confirmOption.keyword}" dengan benar untuk melanjutkan.`);
      return;
    }

    setExecuting(true);
    setLastResultMsg('');
    try {
      const res = await gasApi.resetSystemData(adminSecretKey, confirmOption.mode);
      setLastResultMsg(res.message || `${confirmOption.title} berhasil dilakukan.`);
      setConfirmOption(null);
      setConfirmKeyword('');
      await loadSummary(true);
    } catch (err) {
      alert('Gagal melakukan reset data: ' + err.message);
    } finally {
      setExecuting(false);
    }
  };

  const getOptionCountLabel = (mode) => {
    if (mode === 'all') {
      return `${stats.sessions} Sesi • ${stats.questions} Soal • ${stats.participants} Peserta • ${stats.submissions} Nilai`;
    }
    if (mode === 'questions') return `${stats.questions} Butir Soal Terdata`;
    if (mode === 'participants') return `${stats.participants} Peserta Terdata`;
    if (mode === 'sessions') return `${stats.sessions} Mata Ujian Terdata`;
    return '';
  };

  if (loading) {
    return (
      <AdminLayout title="Reset Data Sistem">
        <LoadingScreen
          message="Memuat Pusat Reset Data..."
          submessage="Menghitung total soal, peserta, mata ujian, dan rekap nilai pada Google Sheets..."
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Sub Menu Reset Data">
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="bg-white p-5 rounded-3xl border border-rose-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">
                Sub Menu Reset Data Sistem CBT
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih jenis pembersihan data (Reset Semua, Reset Soal, Reset Peserta, atau Reset Sesi). Setiap aksi dilindungi konfirmasi bertingkat.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={handleDownloadQuickBackup}
              className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
            >
              Unduh Backup (.xlsx)
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={RotateCw}
              onClick={() => loadSummary(true)}
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Segarkan
            </Button>
          </div>
        </div>

        {lastResultMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{lastResultMsg}</span>
          </div>
        )}

        {/* Sub-tab Pilihan Cepat */}
        <div className="bg-white p-2.5 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap gap-2">
          {RESET_OPTIONS.map((opt) => {
            const active = selectedMode === opt.mode;
            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() => setSearchParams({ mode: opt.mode })}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition ${
                  active
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                }`}
              >
                <opt.icon className="w-3.5 h-3.5" />
                <span>{opt.title}</span>
              </button>
            );
          })}
        </div>

        {/* 4 Kartu Pilihan Reset */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {RESET_OPTIONS.map((opt) => {
            const isHighlighted = selectedMode === opt.mode;
            const IconComp = opt.icon;
            return (
              <Card
                key={opt.mode}
                className={`p-6 rounded-3xl border transition-all flex flex-col justify-between space-y-4 bg-white ${
                  isHighlighted
                    ? 'ring-2 ring-rose-500 border-rose-400 shadow-md'
                    : 'border-slate-200 hover:border-rose-200 shadow-sm'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${opt.badgeClass}`}>
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          Pilihan Reset
                        </span>
                        <h4 className="font-extrabold text-slate-900 text-sm">
                          {opt.title}
                        </h4>
                      </div>
                    </div>

                    {isHighlighted && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        Dipilih
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-bold text-slate-700">
                    {opt.subtitle}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {opt.description}
                  </p>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                    <span>Data Saat Ini di Server:</span>
                    <strong className="font-mono text-slate-900">{getOptionCountLabel(opt.mode)}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <Button
                    variant="danger"
                    className="w-full justify-center"
                    icon={Trash2}
                    onClick={() => handleOpenResetModal(opt)}
                  >
                    {opt.title}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Modal Konfirmasi Penghapusan Keras */}
      <Modal
        isOpen={Boolean(confirmOption)}
        onClose={() => !executing && setConfirmOption(null)}
        title={`Konfirmasi ${confirmOption?.title || 'Reset Data'}`}
        maxWidth="max-w-lg"
      >
        {confirmOption && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="font-extrabold text-rose-950 text-sm">
                  Peringatan Penghapusan Permanen
                </h5>
                <p className="text-rose-800 leading-relaxed">
                  Anda akan menjalankan <strong>{confirmOption.title}</strong>. Data yang dihapus ({getOptionCountLabel(confirmOption.mode)}) tidak dapat dikembalikan kecuali Anda sudah mengunduh cadangan Excel.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
              <span className="text-[11px] text-emerald-900 font-semibold">
                Disarankan unduh cadangan data terlebih dahulu sebelum menghapus permanen.
              </span>
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={handleDownloadQuickBackup}
                className="shrink-0 border-emerald-300 text-emerald-800 bg-white hover:bg-emerald-100"
              >
                Backup Excel
              </Button>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Ketik kata <span className="font-mono text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">{confirmOption.keyword}</span> untuk mengonfirmasi:
              </label>
              <input
                type="text"
                value={confirmKeyword}
                onChange={(e) => setConfirmKeyword(e.target.value)}
                placeholder={`Ketik ${confirmOption.keyword}`}
                className="w-full p-3 rounded-2xl border border-rose-300 font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => setConfirmOption(null)}
                disabled={executing}
              >
                Batal
              </Button>
              <Button
                variant="danger"
                icon={Trash2}
                loading={executing}
                disabled={confirmKeyword.trim().toUpperCase() !== confirmOption.keyword || executing}
                onClick={handleExecuteReset}
              >
                Ya, Eksekusi {confirmOption.title}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
};
