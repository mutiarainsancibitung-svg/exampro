import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { Plus, Users, BookOpen, CheckCircle2, FileText, ToggleLeft, ToggleRight, Wrench, Check, Database, RotateCw } from 'lucide-react';

export const DashboardPage = () => {
  const { adminSecretKey, isAdminLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState({ sessions: [], questions: [], participants: [], submissions: [] });
  const [loading, setLoading] = useState(true);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState(null);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    title: '',
    type: 'pretest',
    token: '',
    duration_minutes: 60,
    is_active: true,
    shuffle_questions: true,
    shuffle_options: true,
    show_score: true
  });

  useEffect(() => {
    if (!isAdminLoggedIn) {
      navigate('/admin/login');
      return;
    }
    loadDashboard();
  }, [isAdminLoggedIn, navigate]);

  const loadDashboard = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const res = await gasApi.getAdminDashboard(adminSecretKey, forceRefresh);
      if (res.status === 'success') {
        setData(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSession = async (e) => {
    e.preventDefault();
    try {
      await gasApi.saveSession(adminSecretKey, sessionForm);
      setShowSessionModal(false);
      setSessionForm({
        title: '',
        type: 'pretest',
        token: '',
        duration_minutes: 60,
        is_active: true,
        shuffle_questions: true,
        shuffle_options: true,
        show_score: true
      });
      loadDashboard();
    } catch (err) {
      alert('Gagal menyimpan sesi: ' + err.message);
    }
  };

  const handleToggleSession = async (sess) => {
    try {
      await gasApi.saveSession(adminSecretKey, {
        ...sess,
        is_active: !sess.is_active
      });
      loadDashboard();
    } catch (err) {
      alert('Gagal mengubah status sesi: ' + err.message);
    }
  };

  const handleCheckAndRepair = async () => {
    setRepairing(true);
    try {
      const res = await gasApi.checkAndRepairDatabase(adminSecretKey);
      setRepairResult(res);
      setShowRepairModal(true);
      loadDashboard();
    } catch (err) {
      alert('Gagal memeriksa/memperbaiki database: ' + err.message);
    } finally {
      setRepairing(false);
    }
  };

  const stats = [
    { label: 'Total Sesi Evaluasi', value: data.sessions.length, icon: FileText, color: 'text-kemenag-700 bg-kemenag-50', link: null },
    { label: 'Bank Soal PAI', value: data.questions.length, icon: BookOpen, color: 'text-emerald-700 bg-emerald-50', link: '/admin/questions' },
    { label: 'Peserta Terdaftar', value: data.participants.length, icon: Users, color: 'text-blue-700 bg-blue-50', link: '/admin/participants' },
    { label: 'Lembar Terkumpul', value: data.submissions.length, icon: CheckCircle2, color: 'text-purple-700 bg-purple-50', link: '/admin/results' },
  ];

  if (loading) {
    return (
      <AdminLayout title="Dashboard & Manajemen Sesi Evaluasi PAI">
        <LoadingScreen
          message="Menyiapkan Dashboard Admin..."
          submessage="Sedang mengambil data sesi evaluasi, bank soal, dan keaktifan peserta..."
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard & Manajemen Sesi Evaluasi PAI">
      <div className="space-y-8">
        {/* Ringkasan Statistik */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((st, i) => (
            <Card
              key={i}
              onClick={() => st.link && navigate(st.link)}
              className={`p-6 flex items-center gap-4 bg-white rounded-3xl border border-kemenag-100 shadow-sm transition ${
                st.link ? 'cursor-pointer hover:shadow-md hover:border-kemenag-300' : ''
              }`}
            >
              <div className={`p-3.5 rounded-2xl ${st.color}`}>
                <st.icon className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-semibold">{st.label}</span>
                <h3 className="text-2xl font-black text-slate-800">{st.value}</h3>
              </div>
            </Card>
          ))}
        </div>

        {/* Daftar Sesi Ujian */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Daftar Sesi Ujian (Pretest & Postest)</h3>
              <p className="text-xs text-slate-500">Kelola token masuk, durasi pengerjaan, dan status ujian.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={RotateCw}
                onClick={() => loadDashboard(true)}
                className="border-slate-200 text-slate-700 hover:bg-slate-50"
                title="Segarkan data dari Google Sheets (bypass cache)"
              >
                Segarkan
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={Wrench}
                onClick={handleCheckAndRepair}
                loading={repairing}
                className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              >
                Cek & Perbaiki Database
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={Users}
                onClick={() => navigate('/admin/participants')}
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                Kelola Peserta (.xlsx)
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => setShowSessionModal(true)}
              >
                Tambah Sesi Baru
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.sessions.map((sess) => (
              <Card key={sess.session_id} className="p-6 space-y-4 bg-white rounded-3xl border border-kemenag-100 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-[11px] font-bold px-3 py-1 rounded-xl uppercase tracking-wider ${
                    sess.type === 'pretest' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-kemenag-100 text-kemenag-900 border border-kemenag-200'
                  }`}>
                    {sess.type || 'Pretest'}
                  </span>
                  <button
                    onClick={() => handleToggleSession(sess)}
                    className="text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    {sess.is_active ? (
                      <span className="text-kemenag-600 flex items-center gap-1">
                        <ToggleRight className="w-5 h-5" /> Aktif
                      </span>
                    ) : (
                      <span className="text-slate-400 flex items-center gap-1">
                        <ToggleLeft className="w-5 h-5" /> Ditutup
                      </span>
                    )}
                  </button>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">
                    {sess.title}
                  </h4>
                  <div className="mt-2.5 flex items-center gap-3 text-xs text-slate-500">
                    <span>Durasi: <strong className="text-slate-700">{sess.duration_minutes} mnt</strong></span>
                    <span>•</span>
                    <span>Token: <strong className="font-mono text-kemenag-800 bg-kemenag-50 border border-kemenag-200 px-2 py-0.5 rounded-lg">{sess.token}</strong></span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Skor: <strong>{sess.show_score ? 'Muncul' : 'Sembunyi'}</strong></span>
                  <span>Acak Soal: <strong>{sess.shuffle_questions ? 'Ya' : 'Tidak'}</strong></span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Modal Tambah Sesi */}
      <Modal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        title="Buat Sesi Evaluasi Baru"
      >
        <form onSubmit={handleSaveSession} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Ujian</label>
            <input
              type="text"
              value={sessionForm.title}
              onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
              placeholder="Contoh: Pretest Pelatihan Guru PAI (Paket 1)"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe Sesi</label>
              <select
                value={sessionForm.type}
                onChange={(e) => setSessionForm({ ...sessionForm, type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              >
                <option value="pretest">Pretest</option>
                <option value="postest">Postest</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Durasi (Menit)</label>
              <input
                type="number"
                value={sessionForm.duration_minutes}
                onChange={(e) => setSessionForm({ ...sessionForm, duration_minutes: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Token Masuk Ujian</label>
            <input
              type="text"
              value={sessionForm.token}
              onChange={(e) => setSessionForm({ ...sessionForm, token: e.target.value.toUpperCase() })}
              placeholder="Contoh: TOT2026"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono font-bold uppercase"
              required
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sessionForm.shuffle_questions}
                onChange={(e) => setSessionForm({ ...sessionForm, shuffle_questions: e.target.checked })}
                className="rounded text-kemenag-600"
              />
              <span>Acak Urutan Soal (Shuffle Questions)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sessionForm.shuffle_options}
                onChange={(e) => setSessionForm({ ...sessionForm, shuffle_options: e.target.checked })}
                className="rounded text-kemenag-600"
              />
              <span>Acak Urutan Opsi Pilihan Ganda (Shuffle Options)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sessionForm.show_score}
                onChange={(e) => setSessionForm({ ...sessionForm, show_score: e.target.checked })}
                className="rounded text-kemenag-600"
              />
              <span>Tampilkan Skor Langsung Setelah Selesai Submit</span>
            </label>
          </div>

          <div className="flex gap-2 pt-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowSessionModal(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" className="flex-1">
              Simpan Sesi
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Laporan Cek & Perbaiki Database */}
      {showRepairModal && repairResult && (
        <Modal
          isOpen={showRepairModal}
          onClose={() => setShowRepairModal(false)}
          title="Hasil Pemeriksaan & Perbaikan Database (Google Sheets)"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-900 text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-800">{repairResult.message}</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Seluruh tabel database (5 sheet) diperiksa: jika baris 1 kosong atau belum ada, header resmi otomatis diisikan dan diformat warna Kemenag hijau.
                </p>
              </div>
            </div>

            <div className="overflow-hidden border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-3.5 py-2.5">Nama Sheet</th>
                    <th className="px-3.5 py-2.5">Tindakan / Status Header</th>
                    <th className="px-3.5 py-2.5 text-center">Total Baris</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(repairResult.report || []).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3.5 py-2.5 font-bold text-slate-800 flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-kemenag-600" />
                        {item.sheet}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" />
                          {item.action}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-mono font-bold text-slate-700">
                        {item.totalRows}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="primary" onClick={() => setShowRepairModal(false)}>
                Tutup & Lanjutkan
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
};
