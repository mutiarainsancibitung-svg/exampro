import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { ExamSubNav } from '../../components/layout/ExamSubNav';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import * as XLSX from 'xlsx';
import {
  Calendar,
  Clock,
  Key,
  Plus,
  Trash2,
  Edit3,
  ToggleLeft,
  ToggleRight,
  RotateCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Users,
  Download,
  Shuffle,
  Eye,
  Sliders,
  StopCircle
} from 'lucide-react';

export const SessionsPage = () => {
  const { adminSecretKey, isAdminLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'pretest' | 'postest'
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'active' | 'inactive'

  // Modal Sesi
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [savingSession, setSavingSession] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    title: '',
    type: 'pretest',
    token: '',
    duration_minutes: 60,
    is_active: true,
    shuffle_questions: true,
    shuffle_options: true,
    show_score: true,
    start_at: '',
    end_at: ''
  });

  // Helper format waktu ke value input datetime-local (YYYY-MM-DDTHH:mm)
  const toDatetimeLocalValue = (val) => {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Helper format tampilan Hari, Tanggal, Jam Indonesia
  const formatIndoDateTime = (val) => {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // State Hapus Sesi & Auto-Backup Proteksi + Akhiri Sesi
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [showDeleteSessionModal, setShowDeleteSessionModal] = useState(false);
  const [deletingSessionLoading, setDeletingSessionLoading] = useState(false);
  const [confirmDeleteChecked, setConfirmDeleteChecked] = useState(false);
  const [endingSessionId, setEndingSessionId] = useState('');

  useEffect(() => {
    if (!isAdminLoggedIn) {
      navigate('/admin/login');
      return;
    }
    loadData();
  }, [isAdminLoggedIn, navigate]);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const res = await gasApi.getAdminDashboard(adminSecretKey, forceRefresh);
      if (res.status === 'success') {
        setSessions(res.sessions || []);
        setQuestions(res.questions || []);
        setParticipants(res.participants || []);
        setSubmissions(res.submissions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Status Aktif / Ditutup
  const handleToggleStatus = async (sess) => {
    const nextActive = !sess.is_active;
    if (!nextActive) {
      const ok = window.confirm(
        `Nonaktifkan mata ujian "${sess.title}"?\n\n` +
        `Saat dinonaktifkan:\n` +
        `1. Peserta yang sedang berada di ruang ujian OTOMATIS dikeluarkan.\n` +
        `2. Peserta baru tidak dapat login ke sistem.\n` +
        `3. Tabel Data Peserta & Excel kembali normal tanpa plotting paket/status seperti sebelum ujian (riwayat nilai di Rekap Nilai tetap aman tersimpan).`
      );
      if (!ok) return;
    }

    try {
      const res = await gasApi.saveSession(adminSecretKey, {
        ...sess,
        is_active: nextActive
      });
      if (!nextActive && res?.message) {
        alert(res.message);
      }
      loadData(true);
    } catch (err) {
      alert('Gagal mengubah status: ' + err.message);
    }
  };

  // Akhiri Sesi Secara Menyeluruh (Mengakhiri Semua Ujian Peserta & Menutup Sesi)
  const handleEndSession = async (sess) => {
    const ok = window.confirm(
      `AKHIRI SESI "${sess.title}" SEKARANG?\n\n` +
      `Tindakan ini akan:\n` +
      `1. Langsung MENGAKHIRI & MENGUMPULKAN seluruh ujian peserta yang sedang mengerjakan saat ini secara otomatis.\n` +
      `2. Menghitung nilai PG sementara & menyimpannya ke Rekap Nilai.\n` +
      `3. Menutup sesi (Ditutup) dan mengeluarkan peserta dari ruang ujian.\n\n` +
      `Lanjutkan akhiri seluruh ujian pada sesi ini?`
    );
    if (!ok) return;

    setEndingSessionId(sess.session_id);
    try {
      const res = await gasApi.endSession(adminSecretKey, sess.session_id);
      alert(res.message || 'Sesi dan seluruh ujian berhasil diakhiri.');
      loadData(true);
    } catch (err) {
      alert('Gagal mengakhiri sesi: ' + err.message);
    } finally {
      setEndingSessionId('');
    }
  };

  // Buka Modal Tambah Sesi
  const handleOpenAdd = () => {
    setEditingSession(null);
    setSessionForm({
      title: '',
      type: 'pretest',
      token: 'PAI' + Math.floor(1000 + Math.random() * 9000),
      duration_minutes: 60,
      is_active: true,
      shuffle_questions: true,
      shuffle_options: true,
      show_score: true,
      start_at: '',
      end_at: ''
    });
    setShowSessionModal(true);
  };

  // Buka Modal Edit Sesi
  const handleOpenEdit = (sess) => {
    setEditingSession(sess);
    setSessionForm({
      session_id: sess.session_id,
      title: sess.title || '',
      type: sess.type || 'pretest',
      token: sess.token || '',
      duration_minutes: Number(sess.duration_minutes) || 60,
      is_active: sess.is_active !== undefined ? sess.is_active : true,
      shuffle_questions: sess.shuffle_questions !== undefined ? sess.shuffle_questions : true,
      shuffle_options: sess.shuffle_options !== undefined ? sess.shuffle_options : true,
      show_score: sess.show_score !== undefined ? sess.show_score : true,
      start_at: toDatetimeLocalValue(sess.start_at),
      end_at: toDatetimeLocalValue(sess.end_at)
    });
    setShowSessionModal(true);
  };

  // Simpan Sesi (Tambah / Edit)
  const handleSaveSession = async (e) => {
    e.preventDefault();
    if (!sessionForm.title.trim()) {
      alert('Judul mata ujian wajib diisi!');
      return;
    }
    if (!sessionForm.token.trim()) {
      alert('Token masuk peserta wajib diisi!');
      return;
    }
    if (sessionForm.start_at && sessionForm.end_at) {
      if (new Date(sessionForm.end_at).getTime() <= new Date(sessionForm.start_at).getTime()) {
        alert('Waktu selesai ujian harus lebih akhir daripada waktu mulai!');
        return;
      }
    }

    const payloadSession = {
      ...sessionForm,
      start_at: sessionForm.start_at ? new Date(sessionForm.start_at).toISOString() : '',
      end_at: sessionForm.end_at ? new Date(sessionForm.end_at).toISOString() : ''
    };

    setSavingSession(true);
    try {
      await gasApi.saveSession(adminSecretKey, payloadSession);
      setShowSessionModal(false);
      loadData(true);
    } catch (err) {
      alert('Gagal menyimpan sesi: ' + err.message);
    } finally {
      setSavingSession(false);
    }
  };

  // Buka Modal Hapus Sesi
  const handleRequestDelete = (sess) => {
    setSessionToDelete(sess);
    setConfirmDeleteChecked(false);
    setShowDeleteSessionModal(true);
  };

  // Eksekusi Hapus Sesi dengan Proteksi Auto-Backup Excel
  const handleExecuteDelete = async () => {
    if (!sessionToDelete) return;
    setDeletingSessionLoading(true);
    try {
      const sess = sessionToDelete;
      const relatedSubs = submissions.filter(s => s.session_id === sess.session_id);

      // Auto-Backup ke Excel jika ada data nilai
      if (relatedSubs.length > 0) {
        const wb = XLSX.utils.book_new();
        const exportRows = relatedSubs.map((sub, idx) => {
          const part = participants.find(p => p.participant_id === sub.participant_id);
          return {
            No: idx + 1,
            Submission_ID: sub.submission_id,
            Sesi_Ujian: sess.title,
            Nama_Peserta: part?.full_name || sub.participant_id,
            Username: part?.username || '-',
            Kelas: part?.kelas || '-',
            Skor_PG: sub.pg_score || 0,
            Skor_Essay: sub.essay_score || 0,
            Total_Nilai: sub.total_score || 0,
            Pelanggaran_Tab: sub.tab_switch_count || 0,
            Waktu_Kirim: sub.submitted_at || ''
          };
        });
        const ws = XLSX.utils.json_to_sheet(exportRows);
        XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Nilai_Backup');
        const cleanTitle = (sess.title || 'Sesi').replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `Backup_Nilai_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
      }

      const res = await gasApi.deleteSession(adminSecretKey, sess.session_id, true);
      alert(res.message || 'Mata ujian berhasil dihapus');
      setShowDeleteSessionModal(false);
      setSessionToDelete(null);
      loadData();
    } catch (err) {
      alert('Gagal menghapus mata ujian: ' + err.message);
    } finally {
      setDeletingSessionLoading(false);
    }
  };

  // Filter Sesi
  const filteredSessions = sessions.filter(sess => {
    const matchSearch = (sess.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (sess.token || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType === 'ALL' || (sess.type || '').toLowerCase() === filterType.toLowerCase();
    const matchStatus = filterStatus === 'ALL' ||
                        (filterStatus === 'active' && sess.is_active) ||
                        (filterStatus === 'inactive' && !sess.is_active);
    return matchSearch && matchType && matchStatus;
  });

  const activeCount = sessions.filter(s => s.is_active).length;
  const inactiveCount = sessions.filter(s => !s.is_active).length;

  if (loading) {
    return (
      <AdminLayout title="Data Mata Ujian / Kegiatan (Sub Menu 1)">
        <LoadingScreen
          message="Memuat Data Mata Ujian CBT..."
          submessage="Sedang mengambil data sesi evaluasi, durasi pengerjaan, dan token masuk..."
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Data Mata Ujian / Kegiatan (Sub Menu 1)">
      <div className="space-y-6">
        {/* Navigasi Sub Menu 3-Laman */}
        <ExamSubNav active={1} />

        {/* Header Bar Sub Menu 1 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-kemenag-100 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-kemenag-700 bg-kemenag-50 px-2.5 py-1 rounded-xl border border-kemenag-200">
                Langkah 1
              </span>
              <h3 className="font-extrabold text-slate-800 text-base">
                Data Mata Ujian & Kegiatan CBT
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Atur judul evaluasi (Pretest/Postest), token masuk, durasi, pengacakan soal, dan status buka/tutup ujian.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              icon={RotateCw}
              onClick={() => loadData(true)}
              title="Segarkan data dari Google Sheets"
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Segarkan
            </Button>

            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={handleOpenAdd}
            >
              Tambah Mata Ujian Baru
            </Button>
          </div>
        </div>

        {/* Ringkasan Statistik Cepat */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 bg-white rounded-2xl border border-kemenag-100 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-kemenag-50 text-kemenag-700">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-semibold">Total Mata Ujian</span>
              <h4 className="text-xl font-black text-slate-800">{sessions.length}</h4>
            </div>
          </Card>

          <Card className="p-4 bg-white rounded-2xl border border-kemenag-100 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-semibold">Sesi Aktif / Terbuka</span>
              <h4 className="text-xl font-black text-emerald-700">{activeCount}</h4>
            </div>
          </Card>

          <Card className="p-4 bg-white rounded-2xl border border-kemenag-100 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-slate-100 text-slate-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-semibold">Sesi Ditutup</span>
              <h4 className="text-xl font-black text-slate-700">{inactiveCount}</h4>
            </div>
          </Card>
        </div>

        {/* Filter & Pencarian Sesi */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-kemenag-100 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative min-w-[200px] flex-1 sm:flex-none">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari Mata Ujian atau Token..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-kemenag-600 font-medium"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 font-bold text-slate-700"
            >
              <option value="ALL">Semua Tipe (Pretest & Postest)</option>
              <option value="pretest">Hanya Pretest</option>
              <option value="postest">Hanya Postest</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 font-bold text-slate-700"
            >
              <option value="ALL">Semua Status</option>
              <option value="active">Sedang Aktif</option>
              <option value="inactive">Sedang Ditutup</option>
            </select>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Menampilkan <strong>{filteredSessions.length}</strong> dari {sessions.length} mata ujian
          </span>
        </div>

        {/* Grid Kartu Mata Ujian */}
        {filteredSessions.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-kemenag-100 text-slate-500 text-xs space-y-3">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
            <p>Tidak ditemukan mata ujian yang sesuai filter pencarian.</p>
            <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenAdd}>
              Buat Mata Ujian Baru
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((sess) => {
              const relatedSubs = submissions.filter(s => s.session_id === sess.session_id).length;
              return (
                <Card
                  key={sess.session_id}
                  className="p-6 space-y-4 bg-white rounded-3xl border border-kemenag-100 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header Kartu: Tipe & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-[11px] font-black px-3 py-1 rounded-xl uppercase tracking-wider ${
                        (sess.type || '').toLowerCase() === 'pretest'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-kemenag-100 text-kemenag-900 border border-kemenag-300'
                      }`}>
                        {sess.type || 'Pretest'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleStatus(sess)}
                          title={sess.is_active ? 'Klik untuk menutup ujian' : 'Klik untuk membuka ujian'}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition ${
                            sess.is_active
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {sess.is_active ? (
                            <>
                              <ToggleRight className="w-4 h-4 text-emerald-600" /> Dibuka
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4 text-slate-400" /> Ditutup
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Judul Mata Ujian */}
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-sm leading-snug line-clamp-2">
                        {sess.title}
                      </h4>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <strong>{sess.duration_minutes || 60} menit</strong>
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Key className="w-3.5 h-3.5 text-slate-400" />
                          Token: <strong className="font-mono text-kemenag-800 bg-kemenag-50 border border-kemenag-200 px-2 py-0.5 rounded-lg">{sess.token}</strong>
                        </span>
                      </div>

                      {(sess.start_at || sess.end_at) && (
                        <div className="mt-2 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-[11px] text-blue-900 space-y-0.5">
                          <div className="font-bold flex items-center gap-1.5 text-blue-800">
                            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            Rentang Waktu Pelaksanaan:
                          </div>
                          {sess.start_at && (
                            <div className="pl-5">
                              Mulai: <strong>{formatIndoDateTime(sess.start_at)}</strong>
                            </div>
                          )}
                          {sess.end_at && (
                            <div className="pl-5">
                              Akhir: <strong>{formatIndoDateTime(sess.end_at)}</strong>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Konfigurasi Fitur Ujian */}
                    <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100 text-[11px] text-slate-600 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Shuffle className="w-3.5 h-3.5 text-slate-400" /> Acak Soal:
                        </span>
                        <strong className={sess.shuffle_questions ? 'text-emerald-700' : 'text-slate-400'}>
                          {sess.shuffle_questions ? 'Ya' : 'Tidak'}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Shuffle className="w-3.5 h-3.5 text-slate-400" /> Acak Opsi (A-E):
                        </span>
                        <strong className={sess.shuffle_options ? 'text-emerald-700' : 'text-slate-400'}>
                          {sess.shuffle_options ? 'Ya' : 'Tidak'}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-slate-400" /> Tampilkan Skor:
                        </span>
                        <strong className={sess.show_score ? 'text-emerald-700' : 'text-slate-400'}>
                          {sess.show_score ? 'Ya' : 'Tidak'}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" /> Lembar Terkumpul:
                        </span>
                        <strong className="text-kemenag-800">{relatedSubs} peserta</strong>
                      </div>
                    </div>
                  </div>

                  {/* Tombol Aksi di Bawah Kartu */}
                  <div className="pt-3 border-t border-slate-100 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleEndSession(sess)}
                        disabled={endingSessionId === sess.session_id}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition disabled:opacity-50"
                        title="Akhiri sesi & kumpulkan otomatis seluruh ujian peserta yang sedang berlangsung"
                      >
                        <StopCircle className="w-3.5 h-3.5 text-rose-600" />
                        {endingSessionId === sess.session_id ? 'Mengakhiri...' : 'Akhiri Sesi'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(sess)}
                        className="text-slate-600 hover:text-slate-900 font-semibold p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100"
                        title="Edit detail mata ujian"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRequestDelete(sess)}
                        className="text-rose-600 hover:text-rose-800 font-semibold p-1.5 rounded-xl border border-rose-200 hover:bg-rose-50"
                        title="Hapus mata ujian"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate('/admin/exam-setup')}
                      className="w-full text-kemenag-700 font-bold hover:underline flex items-center justify-center gap-1 text-[11px] py-1 rounded-xl bg-kemenag-50/60 hover:bg-kemenag-50"
                      title="Buka Langkah 3 untuk memetakan paket soal & peserta"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      Atur Ujian & Pemetaan (Langkah 3) &rarr;
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Mata Ujian */}
      <Modal
        isOpen={showSessionModal}
        onClose={() => !savingSession && setShowSessionModal(false)}
        title={editingSession ? "Edit Mata Ujian / Kegiatan CBT" : "Tambah Mata Ujian / Kegiatan CBT Baru"}
      >
        <form onSubmit={handleSaveSession} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Judul Mata Ujian / Kegiatan Evaluasi:
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Pretest PAI - Penguatan Kompetensi Guru 2026"
              value={sessionForm.title}
              onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
              className="w-full p-3 rounded-2xl border border-slate-200 text-xs font-medium focus:border-kemenag-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Jenis Evaluasi:</label>
              <select
                value={sessionForm.type}
                onChange={(e) => setSessionForm({ ...sessionForm, type: e.target.value })}
                className="w-full p-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 focus:border-kemenag-600 focus:outline-none"
              >
                <option value="pretest">Pretest</option>
                <option value="postest">Postest</option>
                <option value="ujian_harian">Ujian Harian</option>
                <option value="simulasi">Simulasi / Tryout</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Token Masuk Peserta:</label>
              <input
                type="text"
                required
                placeholder="Contoh: PAI2026"
                value={sessionForm.token}
                onChange={(e) => setSessionForm({ ...sessionForm, token: e.target.value.toUpperCase() })}
                className="w-full p-3 rounded-2xl border border-slate-200 text-xs font-mono font-bold text-kemenag-800 uppercase focus:border-kemenag-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Durasi Pengerjaan Ujian (Menit):
            </label>
            <input
              type="number"
              min="5"
              max="300"
              required
              value={sessionForm.duration_minutes}
              onChange={(e) => setSessionForm({ ...sessionForm, duration_minutes: Number(e.target.value) })}
              className="w-full p-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:border-kemenag-600 focus:outline-none"
            />
          </div>

          {/* Rentang Hari & Jam Pelaksanaan (Awal s.d. Akhir) */}
          <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Rentang Jadwal Pelaksanaan (Opsional)
              </span>
              {(sessionForm.start_at || sessionForm.end_at) && (
                <button
                  type="button"
                  onClick={() => setSessionForm({ ...sessionForm, start_at: '', end_at: '' })}
                  className="text-[11px] font-semibold text-rose-600 hover:underline"
                >
                  Hapus Jadwal
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Hari & Waktu Awal:
                </label>
                <input
                  type="datetime-local"
                  value={sessionForm.start_at}
                  onChange={(e) => setSessionForm({ ...sessionForm, start_at: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-blue-200 bg-white text-xs font-semibold text-slate-800 focus:border-kemenag-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Hari & Waktu Akhir:
                </label>
                <input
                  type="datetime-local"
                  value={sessionForm.end_at}
                  onChange={(e) => setSessionForm({ ...sessionForm, end_at: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-blue-200 bg-white text-xs font-semibold text-slate-800 focus:border-kemenag-600 focus:outline-none"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              Peserta hanya diizinkan login dan mengerjakan ujian di dalam rentang waktu ini (jika diisi).
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl space-y-2.5 border border-slate-100">
            <span className="font-bold text-slate-700 block text-xs">Opsi & Integritas Ujian:</span>

            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
              <input
                type="checkbox"
                checked={sessionForm.is_active}
                onChange={(e) => setSessionForm({ ...sessionForm, is_active: e.target.checked })}
                className="rounded text-kemenag-600 focus:ring-kemenag-500 w-4 h-4"
              />
              <span>Aktifkan sesi ini sekarang (peserta diizinkan login)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
              <input
                type="checkbox"
                checked={sessionForm.shuffle_questions}
                onChange={(e) => setSessionForm({ ...sessionForm, shuffle_questions: e.target.checked })}
                className="rounded text-kemenag-600 focus:ring-kemenag-500 w-4 h-4"
              />
              <span>Acak urutan nomor butir soal per peserta</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
              <input
                type="checkbox"
                checked={sessionForm.shuffle_options}
                onChange={(e) => setSessionForm({ ...sessionForm, shuffle_options: e.target.checked })}
                className="rounded text-kemenag-600 focus:ring-kemenag-500 w-4 h-4"
              />
              <span>Acak pilihan jawaban (tampilan A-E tetap urut, konten teracak)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
              <input
                type="checkbox"
                checked={sessionForm.show_score}
                onChange={(e) => setSessionForm({ ...sessionForm, show_score: e.target.checked })}
                className="rounded text-kemenag-600 focus:ring-kemenag-500 w-4 h-4"
              />
              <span>Tampilkan skor perolehan nilai langsung kepada peserta saat selesai</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowSessionModal(false)}
              disabled={savingSession}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={savingSession}
            >
              {editingSession ? "Simpan Perubahan" : "Buat Mata Ujian"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Hapus Sesi dengan Proteksi Auto-Backup */}
      <Modal
        isOpen={showDeleteSessionModal}
        onClose={() => !deletingSessionLoading && setShowDeleteSessionModal(false)}
        title="Konfirmasi Hapus Mata Ujian"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h5 className="font-bold text-rose-900 text-sm">Peringatan Penghapusan Mata Ujian</h5>
              <p className="text-rose-700 leading-relaxed">
                Anda akan menghapus mata ujian <strong>"{sessionToDelete?.title}"</strong>.
              </p>
            </div>
          </div>

          {/* Pengaman Backup Otomatis */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-900 font-bold">
              <Download className="w-4 h-4 text-emerald-700" />
              <span>Proteksi Otomatis Cadangan Nilai (.xlsx)</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Jika mata ujian ini telah memiliki riwayat nilai peserta, sistem akan <strong>secara otomatis mengunduh file Excel (.xlsx)</strong> cadangan seluruh rekapan nilai ke komputer Anda dan mengarsipkannya sebelum sesi dihapus dari sistem.
            </p>
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmDeleteChecked}
              onChange={(e) => setConfirmDeleteChecked(e.target.checked)}
              className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
            />
            <span className="text-slate-700 font-medium">
              Saya memahami bahwa mata ujian ini akan dihapus dari Google Sheets dan tidak dapat dibatalkan.
            </span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteSessionModal(false)}
              disabled={deletingSessionLoading}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              disabled={!confirmDeleteChecked}
              loading={deletingSessionLoading}
              onClick={handleExecuteDelete}
            >
              Hapus Mata Ujian
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
};
