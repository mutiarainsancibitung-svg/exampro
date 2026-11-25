import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { exportQuestionsToExcel } from '../../utils/excelTemplate';
import * as XLSX from 'xlsx';
import {
  Sliders,
  BookOpen,
  Users,
  CheckCircle2,
  Layers,
  Calendar,
  Clock,
  Key,
  CheckCheck,
  FileSpreadsheet,
  Plus,
  Search,
  ArrowRight,
  GraduationCap,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Check,
  AlertCircle,
  Trash2,
  Download,
  RotateCw
} from 'lucide-react';

export const ExamSetupPage = () => {
  const { adminSecretKey, isAdminLoggedIn } = useAuth();
  const navigate = useNavigate();

  // State data sistem
  const [sessions, setSessions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // State Hapus Sesi & Auto-Backup Proteksi
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [showDeleteSessionModal, setShowDeleteSessionModal] = useState(false);
  const [deletingSessionLoading, setDeletingSessionLoading] = useState(false);

  // State Hapus Paket Soal & Auto-Backup
  const [paketToDelete, setPaketToDelete] = useState(null);
  const [showDeletePaketModal, setShowDeletePaketModal] = useState(false);
  const [deletingPaketLoading, setDeletingPaketLoading] = useState(false);
  const [deletePaketConfirmText, setDeletePaketConfirmText] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState('mapping'); // 'mapping' | 'activities' | 'questions'

  // Workflow state
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [isApplyingClass, setIsApplyingClass] = useState(false);

  // Multi-select peserta
  const [selectedParticipantIds, setSelectedParticipantIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassTable, setFilterClassTable] = useState('ALL');

  // Modal Tambah / Edit Mata Ujian (Sesi/Kegiatan)
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
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
    loadData();
  }, [isAdminLoggedIn, navigate]);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const res = await gasApi.getAdminDashboard(adminSecretKey, forceRefresh);
      if (res.status === 'success') {
        const sessList = res.sessions || [];
        const qList = res.questions || [];
        const parts = res.participants || [];
        const subs = res.submissions || [];

        setSessions(sessList);
        setQuestions(qList);
        setParticipants(parts);
        setSubmissions(subs);

        // Inisialisasi pilihan default jika belum dipilih
        if (sessList.length > 0 && !selectedSessionId) {
          setSelectedSessionId(sessList[0].session_id);
        }

        const detectedPkgs = Array.from(new Set(qList.map(q => q.paket?.trim()).filter(Boolean)));
        if (detectedPkgs.length > 0 && !selectedPackage) {
          setSelectedPackage(detectedPkgs[0]);
        }

        const detectedCls = Array.from(new Set(parts.map(p => p.kelas?.trim()).filter(Boolean)));
        if (detectedCls.length > 0 && !selectedClass) {
          setSelectedClass(detectedCls[0]);
        }
      }
    } catch (err) {
      console.error('Gagal memuat data atur ujian:', err);
    } finally {
      setLoading(false);
    }
  };

  // Simpan / Perbarui Mata Ujian / Kegiatan
  const handleSaveSession = async (e) => {
    e.preventDefault();
    if (!sessionForm.title.trim() || !sessionForm.token.trim()) {
      alert('Nama Mata Ujian/Kegiatan dan Token wajib diisi!');
      return;
    }

    try {
      await gasApi.saveSession(adminSecretKey, {
        ...(editingSession ? editingSession : {}),
        ...sessionForm,
        token: sessionForm.token.trim().toUpperCase()
      });
      setShowSessionModal(false);
      setEditingSession(null);
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
      alert('Data Mata Ujian / Kegiatan berhasil disimpan!');
      loadData();
    } catch (err) {
      alert('Gagal menyimpan mata ujian: ' + err.message);
    }
  };

  // Buka Edit Mata Ujian
  const handleOpenEditSession = (sess) => {
    setEditingSession(sess);
    setSessionForm({
      title: sess.title || '',
      type: sess.type || 'pretest',
      token: sess.token || '',
      duration_minutes: sess.duration_minutes || 60,
      is_active: sess.is_active !== false,
      shuffle_questions: sess.shuffle_questions !== false,
      shuffle_options: sess.shuffle_options !== false,
      show_score: sess.show_score !== false
    });
    setShowSessionModal(true);
  };

  // Toggle status aktif sesi
  const handleToggleSessionStatus = async (sess) => {
    try {
      await gasApi.saveSession(adminSecretKey, {
        ...sess,
        is_active: !sess.is_active
      });
      loadData();
    } catch (err) {
      alert('Gagal mengubah status: ' + err.message);
    }
  };

  // Permintaan Hapus Sesi Ujian (dengan proteksi auto-backup jika memiliki nilai pengerjaan)
  const handleRequestDeleteSession = (sess) => {
    if (!sess) return;
    if (sessions.length <= 1) {
      alert('Tidak dapat menghapus sesi ini! Sistem harus memiliki minimal 1 sesi ujian aktif.');
      return;
    }

    const related = (submissions || []).filter(
      sub => String(sub.session_id) === String(sess.session_id)
    );

    setSessionToDelete({
      ...sess,
      submissionsCount: related.length,
      relatedSubmissions: related
    });

    if (related.length > 0) {
      setShowDeleteSessionModal(true);
    } else {
      if (window.confirm(`Yakin ingin menghapus sesi "${sess.title}"? Sesi ini belum memiliki nilai peserta.`)) {
        executeDeleteSession(sess, false);
      }
    }
  };

  // Eksekusi Hapus Sesi Ujian (Unduh file backup Excel otomatis + arsipkan cloud)
  const executeDeleteSession = async (sess, doAutoBackup = true) => {
    setDeletingSessionLoading(true);
    try {
      // 1. Jika ada submission dan doAutoBackup true, download file Excel nilai otomatis
      if (doAutoBackup && sess.relatedSubmissions && sess.relatedSubmissions.length > 0) {
        const wb = XLSX.utils.book_new();
        const exportRows = sess.relatedSubmissions.map((sub, idx) => {
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

      // 2. Panggil API hapus sesi (dengan auto-archive di Google Sheets)
      const res = await gasApi.deleteSession(adminSecretKey, sess.session_id, true);
      alert(res.message || 'Sesi berhasil dihapus');
      setShowDeleteSessionModal(false);
      setSessionToDelete(null);

      // Jika sesi yang dihapus sedang terpilih di Langkah 1, reset pilihan
      if (selectedSessionId === sess.session_id) {
        const remaining = sessions.filter(s => s.session_id !== sess.session_id);
        if (remaining.length > 0) {
          setSelectedSessionId(remaining[0].session_id);
        }
      }

      loadData();
    } catch (err) {
      alert('Gagal menghapus sesi: ' + err.message);
    } finally {
      setDeletingSessionLoading(false);
    }
  };

  // Buka Modal Konfirmasi Hapus Paket Soal
  const handleRequestDeletePaket = (pkg) => {
    setPaketToDelete(pkg);
    setDeletePaketConfirmText('');
    setShowDeletePaketModal(true);
  };

  // Unduh Backup Soal Paket Sebelum Dihapus
  const handleDownloadBackupPaketInSetup = () => {
    if (!paketToDelete) return;
    const pkgQuestions = questions.filter(
      q => (q.paket || '').trim().toLowerCase() === paketToDelete.trim().toLowerCase()
    );
    if (pkgQuestions.length === 0) {
      alert(`Tidak ada butir soal pada paket "${paketToDelete}" untuk diunduh.`);
      return;
    }
    exportQuestionsToExcel(
      pkgQuestions,
      `Backup_Soal_${paketToDelete}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // Eksekusi Hapus Seluruh Butir Soal dalam Paket
  const executeDeletePaketInSetup = async () => {
    if (!paketToDelete) return;
    const isConfirmed = deletePaketConfirmText.trim().toUpperCase() === 'HAPUS' ||
      deletePaketConfirmText.trim().toLowerCase() === paketToDelete.trim().toLowerCase();

    if (!isConfirmed) {
      alert(`Harap ketik "HAPUS" atau nama paket "${paketToDelete}" untuk konfirmasi.`);
      return;
    }

    setDeletingPaketLoading(true);
    try {
      const res = await gasApi.deleteQuestionsByPaket(adminSecretKey, paketToDelete);
      alert(res.message || `Berhasil menghapus paket "${paketToDelete}".`);
      setShowDeletePaketModal(false);
      setPaketToDelete(null);

      // Jika paket yang sedang dipilih di Langkah 2 adalah paket yang dihapus, reset pilihan
      if (selectedPackage && selectedPackage.trim().toLowerCase() === paketToDelete.trim().toLowerCase()) {
        const remaining = dynamicPackages.filter(p => p.toLowerCase() !== paketToDelete.toLowerCase());
        if (remaining.length > 0) {
          setSelectedPackage(remaining[0]);
        }
      }

      loadData();
    } catch (err) {
      alert('Gagal menghapus paket soal: ' + err.message);
    } finally {
      setDeletingPaketLoading(false);
    }
  };

  // Ekstrak data dinamis
  const dynamicClasses = Array.from(new Set(participants.map(p => p.kelas?.trim()).filter(Boolean)));
  const dynamicPackages = Array.from(new Set([
    ...questions.map(q => q.paket?.trim()),
    ...participants.map(p => p.paket?.trim())
  ].filter(Boolean)));

  const activeSession = sessions.find(s => s.session_id === selectedSessionId) || sessions[0];

  // Aksi 1: Terapkan Pemetaan Paket Berdasarkan Kelas (Massal)
  const handleApplyClassMapping = async () => {
    if (!selectedClass.trim()) {
      alert('Pilih kelas yang ingin dipetakan!');
      return;
    }
    if (!selectedPackage.trim()) {
      alert('Pilih paket soal yang akan digunakan!');
      return;
    }

    const targetParticipants = participants.filter(
      p => (p.kelas || '').trim().toLowerCase() === selectedClass.trim().toLowerCase()
    );

    if (targetParticipants.length === 0) {
      alert(`Tidak ada peserta yang terdaftar pada kelas "${selectedClass}".`);
      return;
    }

    const confirmMsg = `Konfirmasi Pemetaan:\n` +
      `- Mata Ujian/Kegiatan: ${activeSession?.title || 'Sesi Aktif'}\n` +
      `- Kelas Sasaran: ${selectedClass} (${targetParticipants.length} Peserta)\n` +
      `- Paket Soal: ${selectedPackage}\n\n` +
      `Terapkan pemetaan ini ke seluruh peserta kelas ${selectedClass}?`;

    if (!window.confirm(confirmMsg)) return;

    setIsApplyingClass(true);
    try {
      const updatedList = targetParticipants.map(p => ({
        ...p,
        session_id: selectedSessionId || p.session_id,
        paket: selectedPackage.trim()
      }));

      await gasApi.batchSaveParticipants(adminSecretKey, updatedList);
      alert(`Berhasil! ${targetParticipants.length} peserta di "${selectedClass}" telah dipetakan ke Paket "${selectedPackage}".`);
      loadData();
    } catch (err) {
      alert('Gagal menerapkan pemetaan kelas: ' + err.message);
    } finally {
      setIsApplyingClass(false);
    }
  };

  // Aksi 2: Terapkan Pemetaan ke Peserta Tercentang
  const handleApplySelectedParticipants = async () => {
    if (selectedParticipantIds.length === 0) {
      alert('Pilih atau centang minimal satu peserta terlebih dahulu!');
      return;
    }
    if (!selectedPackage.trim()) {
      alert('Pilih paket soal yang akan ditugaskan!');
      return;
    }

    const targetParticipants = participants.filter(p =>
      selectedParticipantIds.includes(p.participant_id)
    );

    if (!window.confirm(`Tugaskan Paket "${selectedPackage}" untuk ${targetParticipants.length} peserta yang Anda pilih?`)) {
      return;
    }

    try {
      const updatedList = targetParticipants.map(p => ({
        ...p,
        session_id: selectedSessionId || p.session_id,
        paket: selectedPackage.trim()
      }));

      await gasApi.batchSaveParticipants(adminSecretKey, updatedList);
      alert(`Berhasil menetapkan Paket "${selectedPackage}" ke ${targetParticipants.length} peserta terpilih!`);
      setSelectedParticipantIds([]);
      loadData();
    } catch (err) {
      alert('Gagal menetapkan peserta: ' + err.message);
    }
  };

  // Toggle select all
  const filteredParticipantsTable = participants.filter(p => {
    const matchSearch =
      (p.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.identifier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.username || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchClass =
      filterClassTable === 'ALL' || (p.kelas || '').trim().toLowerCase() === filterClassTable.toLowerCase();
    return matchSearch && matchClass;
  });

  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedParticipantIds(filteredParticipantsTable.map(p => p.participant_id));
    } else {
      setSelectedParticipantIds([]);
    }
  };

  const handleToggleParticipant = (id) => {
    setSelectedParticipantIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <AdminLayout title="Atur Ujian: Mata Ujian, Bank Soal & Pemetaan Kelas">
        <LoadingScreen
          message="Menyiapkan Atur Ujian & Pemetaan..."
          submessage="Sedang mengambil data mata ujian, paket bank soal, dan daftar kelas peserta..."
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Atur Ujian: Mata Ujian, Bank Soal & Pemetaan Kelas">
      <div className="space-y-6">

        {/* Tab Sub Menu Pengaturan */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-3xl border border-kemenag-100 shadow-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTab('mapping')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                activeTab === 'mapping'
                  ? 'bg-kemenag-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-kemenag-50 hover:text-kemenag-800'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>1. Atur Ujian & Pemetaan Kelas</span>
            </button>

            <button
              onClick={() => setActiveTab('activities')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                activeTab === 'activities'
                  ? 'bg-kemenag-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-kemenag-50 hover:text-kemenag-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>2. Data Mata Ujian / Kegiatan ({sessions.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('questions')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                activeTab === 'questions'
                  ? 'bg-kemenag-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-kemenag-50 hover:text-kemenag-800'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>3. Data Bank Soal & Paket ({dynamicPackages.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
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
              onClick={() => {
                setEditingSession(null);
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
                setShowSessionModal(true);
              }}
            >
              Tambah Mata Ujian Baru
            </Button>
          </div>
        </div>

        {/* TAB 1: WORKFLOW ATUR UJIAN & PEMETAAN KELAS */}
        {activeTab === 'mapping' && (
          <div className="space-y-6">

            {/* Visual Header Workflow 3 Langkah */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Langkah 1 */}
              <div className="bg-white p-5 rounded-3xl border border-kemenag-200/80 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-kemenag-700 bg-kemenag-50 px-2.5 py-1 rounded-xl">
                    Langkah 1
                  </span>
                  <Calendar className="w-4 h-4 text-kemenag-600" />
                </div>
                <div className="mt-3">
                  <h4 className="text-xs font-bold text-slate-700 mb-1.5">Pilih Mata Ujian / Kegiatan:</h4>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl border border-kemenag-300 text-xs font-extrabold text-kemenag-900 bg-kemenag-50/50 focus:outline-none"
                  >
                    {sessions.map(s => (
                      <option key={s.session_id} value={s.session_id}>
                        {s.title} ({s.type?.toUpperCase()} - Token: {s.token})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Durasi: <strong className="text-slate-700">{activeSession?.duration_minutes || 60} menit</strong>
                    <span className="mx-1">•</span>
                    <Key className="w-3.5 h-3.5 text-slate-400" /> Token: <strong className="font-mono text-kemenag-800">{activeSession?.token || '-'}</strong>
                  </p>
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[11px]">
                    <button
                      onClick={() => handleOpenEditSession(activeSession)}
                      className="text-slate-600 font-semibold hover:text-slate-900"
                    >
                      Edit Sesi Ini
                    </button>
                    <button
                      onClick={() => handleRequestDeleteSession(activeSession)}
                      className="text-rose-600 font-semibold hover:text-rose-800 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus Sesi
                    </button>
                  </div>
                </div>
              </div>

              {/* Langkah 2 */}
              <div className="bg-white p-5 rounded-3xl border border-emerald-200/80 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl">
                    Langkah 2
                  </span>
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-3">
                  <h4 className="text-xs font-bold text-slate-700 mb-1.5">Pilih Bank Soal / Paket:</h4>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedPackage}
                      onChange={(e) => setSelectedPackage(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl border border-emerald-300 text-xs font-extrabold text-emerald-900 bg-emerald-50/50 focus:outline-none"
                    >
                      {dynamicPackages.map(pkg => {
                        const count = questions.filter(q => (q.paket || '').trim().toLowerCase() === pkg.toLowerCase()).length;
                        return (
                          <option key={pkg} value={pkg}>
                            {pkg} {count > 0 ? `(${count} Soal)` : '(Paket Baru)'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
                    <span>Total Soal di Bank: <strong className="text-emerald-700">{questions.length} butir</strong></span>
                    <button
                      onClick={() => navigate('/admin/questions')}
                      className="text-emerald-700 hover:underline font-bold text-[10px]"
                    >
                      Buka Bank Soal &rarr;
                    </button>
                  </p>
                </div>
              </div>

              {/* Langkah 3 */}
              <div className="bg-white p-5 rounded-3xl border border-blue-200/80 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-xl">
                    Langkah 3
                  </span>
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                </div>
                <div className="mt-3">
                  <h4 className="text-xs font-bold text-slate-700 mb-1.5">Pemetaan Kelas Sasaran:</h4>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl border border-blue-300 text-xs font-extrabold text-blue-900 bg-blue-50/50 focus:outline-none"
                  >
                    {dynamicClasses.map(cls => {
                      const count = participants.filter(p => (p.kelas || '').trim().toLowerCase() === cls.toLowerCase()).length;
                      return (
                        <option key={cls} value={cls}>
                          {cls} ({count} Peserta)
                        </option>
                      );
                    })}
                  </select>
                  <div className="mt-2.5">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={CheckCheck}
                      disabled={isApplyingClass || !selectedClass}
                      onClick={handleApplyClassMapping}
                      className="w-full justify-center shadow-sm"
                    >
                      {isApplyingClass ? 'Menyimpan Pemetaan...' : `Terapkan ke Kelas ${selectedClass}`}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Matriks Ringkasan Pemetaan per Kelas */}
            <div className="bg-white rounded-3xl border border-kemenag-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-kemenag-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Matriks Pemetaan Kelas Terhadap Paket Soal</h3>
                  <p className="text-xs text-slate-500">
                    Ringkasan paket ujian yang telah didistribusikan ke masing-masing kelas.
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                  {dynamicClasses.length} Kelas Terdaftar
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">No</th>
                      <th className="py-3 px-4">Nama Kelas</th>
                      <th className="py-3 px-4 text-center">Jumlah Peserta</th>
                      <th className="py-3 px-4">Mata Ujian / Kegiatan Aktif</th>
                      <th className="py-3 px-4">Paket Soal Ditugaskan</th>
                      <th className="py-3 px-4 text-center">Aksi Cepat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dynamicClasses.map((cls, idx) => {
                      const classParts = participants.filter(p => (p.kelas || '').trim().toLowerCase() === cls.toLowerCase());
                      const assignedPkgs = Array.from(new Set(classParts.map(p => p.paket?.trim()).filter(Boolean)));
                      const displayPkg = assignedPkgs.length === 1 ? assignedPkgs[0] : (assignedPkgs.length > 1 ? `${assignedPkgs.join(', ')} (Bervariasi)` : 'Belum Ditugaskan');

                      return (
                        <tr key={cls} className="hover:bg-slate-50/50 transition">
                          <td className="py-3 px-4 text-center font-bold text-slate-500">{idx + 1}</td>
                          <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                            {cls}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                            {classParts.length} Orang
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-medium">
                            {activeSession?.title || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold ${
                              assignedPkgs.length > 0
                                ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {displayPkg}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => {
                                setSelectedClass(cls);
                                handleApplyClassMapping();
                              }}
                              className="px-3 py-1 rounded-xl text-xs font-bold text-kemenag-700 bg-kemenag-50 hover:bg-kemenag-100 border border-kemenag-200 transition"
                            >
                              Tugaskan Paket "{selectedPackage}"
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pemetaan Tingkat Individu / Tabel Peserta */}
            <div className="bg-white rounded-3xl border border-kemenag-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-kemenag-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Daftar Peserta & Penugasan Paket Per Individu</h3>
                  <p className="text-xs text-slate-500">
                    Anda juga dapat memilih dan menugaskan paket secara selektif ke peserta tertentu.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari peserta..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs w-44 bg-slate-50"
                    />
                  </div>

                  <select
                    value={filterClassTable}
                    onChange={(e) => setFilterClassTable(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 text-slate-700"
                  >
                    <option value="ALL">Semua Kelas</option>
                    {dynamicClasses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>

                  <Button
                    variant="outline"
                    size="sm"
                    icon={Check}
                    disabled={selectedParticipantIds.length === 0}
                    onClick={handleApplySelectedParticipants}
                    className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs"
                  >
                    Tugaskan Paket "{selectedPackage}" ({selectedParticipantIds.length})
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          onChange={handleToggleSelectAll}
                          checked={
                            filteredParticipantsTable.length > 0 &&
                            selectedParticipantIds.length === filteredParticipantsTable.length
                          }
                          className="rounded text-kemenag-600"
                        />
                      </th>
                      <th className="py-2.5 px-3.5">Nama Peserta & NIP</th>
                      <th className="py-2.5 px-3.5">Kelas</th>
                      <th className="py-2.5 px-3.5">Paket Soal Saat Ini</th>
                      <th className="py-2.5 px-3.5">Status Pengerjaan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredParticipantsTable.map((p) => {
                      const isSelected = selectedParticipantIds.includes(p.participant_id);
                      return (
                        <tr key={p.participant_id} className={`hover:bg-slate-50 ${isSelected ? 'bg-kemenag-50/40' : ''}`}>
                          <td className="py-2.5 px-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleParticipant(p.participant_id)}
                              className="rounded text-kemenag-600"
                            />
                          </td>
                          <td className="py-2.5 px-3.5 font-bold text-slate-800">
                            <div>{p.full_name || p.username}</div>
                            <div className="text-[10px] text-slate-400 font-mono">NIP: {p.identifier || '-'}</div>
                          </td>
                          <td className="py-2.5 px-3.5">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {p.kelas || '-'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                              {p.paket || 'Belum Diatur'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                              p.status === 'submitted'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.status === 'in_progress'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {p.status === 'submitted' ? 'Selesai' : p.status === 'in_progress' ? 'Ujian' : 'Siap'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: DATA MATA UJIAN / KEGIATAN */}
        {activeTab === 'activities' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Daftar Mata Ujian & Kegiatan CBT</h3>
                <p className="text-xs text-slate-500">Kelola judul evaluasi, jenis ujian, durasi pengerjaan, dan token masuk peserta.</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setEditingSession(null);
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
                  setShowSessionModal(true);
                }}
              >
                Tambah Mata Ujian
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((sess) => (
                <Card key={sess.session_id} className="p-6 space-y-4 bg-white rounded-3xl border border-kemenag-100 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[11px] font-bold px-3 py-1 rounded-xl uppercase tracking-wider ${
                      sess.type === 'pretest' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-kemenag-100 text-kemenag-900 border border-kemenag-200'
                    }`}>
                      {sess.type || 'Pretest'}
                    </span>
                    <button
                      onClick={() => handleToggleSessionStatus(sess)}
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

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <button
                      onClick={() => {
                        setSelectedSessionId(sess.session_id);
                        setActiveTab('mapping');
                      }}
                      className="text-kemenag-700 font-bold hover:underline flex items-center gap-1"
                    >
                      Pilih & Atur Pemetaan &rarr;
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditSession(sess)}
                        className="text-slate-500 font-semibold hover:text-slate-800"
                      >
                        Edit Sesi
                      </button>
                      <button
                        onClick={() => handleRequestDeleteSession(sess)}
                        className="text-rose-600 font-semibold hover:text-rose-800 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: DATA BANK SOAL & PAKET */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Daftar Paket Soal di Bank Soal</h3>
                <p className="text-xs text-slate-500">Soal-soal yang diimpor dari Excel secara otomatis dikelompokkan ke paket-paket ini.</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={BookOpen}
                onClick={() => navigate('/admin/questions')}
              >
                Buka Kelola Bank Soal & Excel
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dynamicPackages.map((pkg) => {
                const pkgQuestions = questions.filter(q => (q.paket || '').trim().toLowerCase() === pkg.toLowerCase());
                const pgCount = pkgQuestions.filter(q => q.type === 'single_choice' || q.type === 'multiple_choice').length;
                const essayCount = pkgQuestions.filter(q => q.type === 'essay').length;

                return (
                  <Card key={pkg} className="p-6 bg-white rounded-3xl border border-emerald-100 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {pkg}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {pkgQuestions.length} Butir Soal
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span>Pilihan Ganda:</span>
                        <strong className="text-slate-800 font-mono">{pgCount} Soal</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Soal Uraian / Esai:</span>
                        <strong className="text-slate-800 font-mono">{essayCount} Soal</strong>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setSelectedPackage(pkg);
                          setActiveTab('mapping');
                        }}
                        className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                      >
                        Gunakan Pemetaan &rarr;
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate('/admin/questions')}
                          className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                        >
                          Lihat Butir
                        </button>
                        <button
                          onClick={() => handleRequestDeletePaket(pkg)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Hapus
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Modal Tambah / Edit Mata Ujian (Sesi/Kegiatan) */}
      {showSessionModal && (
        <Modal
          isOpen={showSessionModal}
          onClose={() => { setShowSessionModal(false); setEditingSession(null); }}
          title={editingSession ? 'Edit Data Mata Ujian / Kegiatan' : 'Tambah Mata Ujian / Kegiatan Baru'}
        >
          <form onSubmit={handleSaveSession} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Mata Ujian / Kegiatan Pelatihan
              </label>
              <input
                type="text"
                value={sessionForm.title}
                onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                placeholder="Contoh: Evaluasi Pedagogik Guru PAI 2026"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe Evaluasi</label>
                <select
                  value={sessionForm.type}
                  onChange={(e) => setSessionForm({ ...sessionForm, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                >
                  <option value="pretest">Pretest (Awal)</option>
                  <option value="postest">Postest (Akhir)</option>
                  <option value="ujian">Ujian / Sertifikasi</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Durasi (Menit)</label>
                <input
                  type="number"
                  min="1"
                  value={sessionForm.duration_minutes}
                  onChange={(e) => setSessionForm({ ...sessionForm, duration_minutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
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
                placeholder="Contoh: PAI2026"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Sistem juga mendukung pergantian token otomatis setiap 1 menit bagi pengawas ujian.
              </p>
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
                <span>Acak Urutan Pilihan Ganda (Shuffle Options)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sessionForm.show_score}
                  onChange={(e) => setSessionForm({ ...sessionForm, show_score: e.target.checked })}
                  className="rounded text-kemenag-600"
                />
                <span>Tampilkan Skor Langsung Kepada Peserta Setelah Submit</span>
              </label>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => { setShowSessionModal(false); setEditingSession(null); }}
              >
                Batal
              </Button>
              <Button variant="primary" type="submit" className="flex-1">
                Simpan Mata Ujian
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Proteksi Hapus Sesi Ujian & Auto-Backup */}
      <Modal
        isOpen={showDeleteSessionModal}
        onClose={() => !deletingSessionLoading && setShowDeleteSessionModal(false)}
        title="Konfirmasi Hapus Sesi Ujian & Auto-Backup"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Peringatan: Sesi Memiliki Data Nilai Peserta!</span>
            </div>
            <p>
              Sesi <strong>"{sessionToDelete?.title}"</strong> memiliki{' '}
              <strong className="text-amber-950 font-bold underline">
                {sessionToDelete?.submissionsCount} riwayat pengerjaan nilai peserta
              </strong>.
            </p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Untuk melindungi nilai peserta dari kehilangan, sistem akan secara otomatis:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] font-semibold text-emerald-900 bg-white/70 p-2.5 rounded-xl border border-amber-200">
              <li>✅ Mengunduh file Excel rekap nilai (.xlsx) ke laptop/PC Anda.</li>
              <li>✅ Menyalin data nilai ke lembar arsip cloud Google Sheets (Archive_Submissions).</li>
            </ul>
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              className="flex-1"
              disabled={deletingSessionLoading}
              onClick={() => setShowDeleteSessionModal(false)}
            >
              Batalkan
            </Button>
            <Button
              variant="primary"
              className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
              disabled={deletingSessionLoading}
              onClick={() => executeDeleteSession(sessionToDelete, true)}
              icon={Download}
            >
              {deletingSessionLoading ? 'Memproses Backup...' : 'Backup Nilai & Hapus Sesi'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Hapus Paket Soal & Auto-Backup */}
      {showDeletePaketModal && (
        <Modal
          isOpen={showDeletePaketModal}
          onClose={() => {
            if (!deletingPaketLoading) {
              setShowDeletePaketModal(false);
              setPaketToDelete(null);
            }
          }}
          title="Konfirmasi Hapus Paket Soal"
          maxWidth="max-w-lg"
        >
          {(() => {
            const targetQuestions = questions.filter(
              q => (q.paket || '').trim().toLowerCase() === (paketToDelete || '').trim().toLowerCase()
            );
            const isMatch = deletePaketConfirmText.trim().toUpperCase() === 'HAPUS' ||
              (paketToDelete && deletePaketConfirmText.trim().toLowerCase() === paketToDelete.trim().toLowerCase());

            return (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Paket yang akan dihapus:</span>
                    <strong className="text-rose-700 font-bold px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200">
                      {paketToDelete}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Jumlah Butir Soal Terkait:</span>
                    <strong className="text-slate-800 font-mono text-sm">{targetQuestions.length} Butir Soal</strong>
                  </div>
                </div>

                {/* Tombol Cadangan Excel */}
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <h5 className="font-bold text-emerald-900">Amankan Soal Dahulu?</h5>
                    <p className="text-[11px] text-emerald-700">Unduh berkas Excel sebelum seluruh butir dihapus.</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Download}
                    onClick={handleDownloadBackupPaketInSetup}
                    disabled={deletingPaketLoading || targetQuestions.length === 0}
                    className="shrink-0 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                  >
                    Unduh Excel (.xlsx)
                  </Button>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-rose-900 space-y-1">
                    <p className="font-bold">Perhatian Penghapusan Permanen</p>
                    <p className="text-[11px] text-rose-800 leading-relaxed">
                      Seluruh <strong>{targetQuestions.length} butir soal</strong> dalam paket <strong>"{paketToDelete}"</strong> akan dihapus dari Google Sheets.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ketik <span className="text-rose-600 font-mono font-black">HAPUS</span> atau <span className="text-rose-600 font-mono font-black">{paketToDelete}</span> untuk konfirmasi:
                  </label>
                  <input
                    type="text"
                    value={deletePaketConfirmText}
                    onChange={(e) => setDeletePaketConfirmText(e.target.value)}
                    disabled={deletingPaketLoading}
                    placeholder={`Ketik HAPUS atau ${paketToDelete}`}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    disabled={deletingPaketLoading}
                    onClick={() => {
                      setShowDeletePaketModal(false);
                      setPaketToDelete(null);
                    }}
                  >
                    Batalkan
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    disabled={!isMatch || deletingPaketLoading || targetQuestions.length === 0}
                    onClick={executeDeletePaketInSetup}
                  >
                    {deletingPaketLoading ? 'Menghapus Soal...' : `Ya, Hapus ${targetQuestions.length} Soal`}
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </AdminLayout>
  );
};
