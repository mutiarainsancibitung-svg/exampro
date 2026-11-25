import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { ExamSubNav } from '../../components/layout/ExamSubNav';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import {
  Sliders,
  BookOpen,
  Users,
  CheckCircle2,
  Calendar,
  Clock,
  Key,
  CheckCheck,
  Search,
  ArrowRight,
  GraduationCap,
  Sparkles,
  RotateCw,
  ExternalLink,
  Layers,
  AlertCircle
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

  // Workflow state
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [isApplyingClass, setIsApplyingClass] = useState(false);

  // Multi-select peserta
  const [selectedParticipantIds, setSelectedParticipantIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassTable, setFilterClassTable] = useState('ALL');
  const [filterPackageTable, setFilterPackageTable] = useState('ALL');
  const [customTargetPackage, setCustomTargetPackage] = useState('');
  const [isUpdatingSelected, setIsUpdatingSelected] = useState(false);

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

        // Ambil paket yang tersedia
        const pkgs = Array.from(new Set([
          ...qList.map(q => q.paket?.trim()),
          ...parts.map(p => p.paket?.trim())
        ].filter(Boolean)));

        if (pkgs.length > 0 && !selectedPackage) {
          setSelectedPackage(pkgs[0]);
          setCustomTargetPackage(pkgs[0]);
        }

        // Ambil kelas yang tersedia
        const clsList = Array.from(new Set(parts.map(p => p.kelas?.trim()).filter(Boolean)));
        if (clsList.length > 0 && !selectedClass) {
          setSelectedClass(clsList[0]);
        }
      }
    } catch (err) {
      console.error('Gagal memuat data atur ujian:', err);
    } finally {
      setLoading(false);
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
      `- Paket Soal yang Ditetapkan: ${selectedPackage}\n\n` +
      `Apakah Anda yakin ingin memetakan paket "${selectedPackage}" ke seluruh peserta kelas "${selectedClass}"?`;

    if (!window.confirm(confirmMsg)) return;

    setIsApplyingClass(true);
    try {
      const updatedList = targetParticipants.map(p => ({
        ...p,
        paket: selectedPackage,
        session_id: activeSession ? activeSession.session_id : p.session_id
      }));

      await gasApi.batchSaveParticipants(adminSecretKey, updatedList);
      alert(`Sukses! Sebanyak ${updatedList.length} peserta kelas "${selectedClass}" berhasil dipetakan ke paket "${selectedPackage}".`);
      loadData();
    } catch (err) {
      alert('Gagal menerapkan pemetaan kelas: ' + err.message);
    } finally {
      setIsApplyingClass(false);
    }
  };

  // Aksi 2: Terapkan Paket ke Peserta yang Dicentang (Selektif)
  const handleApplyCustomPackageToSelected = async () => {
    if (selectedParticipantIds.length === 0) {
      alert('Pilih minimal satu peserta yang ingin diubah paket soalnya.');
      return;
    }
    if (!customTargetPackage.trim()) {
      alert('Pilih paket soal tujuan!');
      return;
    }

    const confirmMsg = `Ubah paket soal untuk ${selectedParticipantIds.length} peserta terpilih menjadi "${customTargetPackage}"?`;
    if (!window.confirm(confirmMsg)) return;

    setIsUpdatingSelected(true);
    try {
      const selectedParts = participants.filter(p => selectedParticipantIds.includes(p.participant_id));
      const updatedList = selectedParts.map(p => ({
        ...p,
        paket: customTargetPackage,
        session_id: activeSession ? activeSession.session_id : p.session_id
      }));

      await gasApi.batchSaveParticipants(adminSecretKey, updatedList);
      alert(`Berhasil memperbarui paket ${updatedList.length} peserta menjadi "${customTargetPackage}".`);
      setSelectedParticipantIds([]);
      loadData();
    } catch (err) {
      alert('Gagal memperbarui paket peserta: ' + err.message);
    } finally {
      setIsUpdatingSelected(false);
    }
  };

  // Filter Tabel Peserta
  const filteredParticipants = participants.filter(p => {
    const matchSearch = (p.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (p.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (p.identifier || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchClass = filterClassTable === 'ALL' || (p.kelas || '').toLowerCase() === filterClassTable.toLowerCase();
    const matchPkg = filterPackageTable === 'ALL' || (p.paket || '').toLowerCase() === filterPackageTable.toLowerCase();
    return matchSearch && matchClass && matchPkg;
  });

  // Toggle checklist peserta
  const toggleSelectAll = () => {
    if (selectedParticipantIds.length === filteredParticipants.length) {
      setSelectedParticipantIds([]);
    } else {
      setSelectedParticipantIds(filteredParticipants.map(p => p.participant_id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedParticipantIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <AdminLayout title="Atur Ujian & Pemetaan Kelas (Sub Menu 1)">
        <LoadingScreen
          message="Menyiapkan Atur Ujian & Pemetaan..."
          submessage="Sedang mengambil data mata ujian, paket bank soal, dan daftar kelas peserta..."
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Atur Ujian & Pemetaan Kelas (Sub Menu 1)">
      <div className="space-y-6">
        {/* Navigasi Sub Menu 3-Laman */}
        <ExamSubNav active={1} />

        {/* Header Bar Sub Menu 1 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-kemenag-100 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-kemenag-700 bg-kemenag-50 px-2.5 py-1 rounded-xl border border-kemenag-200">
                Sub Menu 1
              </span>
              <h3 className="font-extrabold text-slate-800 text-base">
                Atur Ujian & Pemetaan Paket ke Kelas Sasaran
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Hubungkan mata ujian aktif dengan paket soal tertentu, lalu petakan secara massal ke kelas atau peserta tertentu.
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
              variant="outline"
              size="sm"
              icon={Calendar}
              onClick={() => navigate('/admin/sessions')}
              className="border-kemenag-300 text-kemenag-800 hover:bg-kemenag-50"
            >
              Kelola Mata Ujian (Sub Menu 2) &rarr;
            </Button>
          </div>
        </div>

        {/* Workflow 3 Langkah Pemetaan */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Langkah 1: Pilih Mata Ujian */}
          <div className="bg-white p-5 rounded-3xl border border-kemenag-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div>
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
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Status: <strong className={activeSession?.is_active ? 'text-emerald-700' : 'text-slate-500'}>{activeSession?.is_active ? 'Aktif' : 'Ditutup'}</strong></span>
              <button
                onClick={() => navigate('/admin/sessions')}
                className="text-kemenag-700 font-bold hover:underline"
              >
                Atur Sesi di Sub Menu 2 &rarr;
              </button>
            </div>
          </div>

          {/* Langkah 2: Pilih Paket Soal */}
          <div className="bg-white p-5 rounded-3xl border border-emerald-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div>
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
                  <span>Total Soal Bank: <strong className="text-emerald-700">{questions.length} butir</strong></span>
                  <button
                    onClick={() => navigate('/admin/questions')}
                    className="text-emerald-700 hover:underline font-bold text-[10px]"
                  >
                    Kelola di Sub Menu 3 &rarr;
                  </button>
                </p>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-100 text-[11px] text-slate-400">
              Paket aktif terpilih: <strong className="text-emerald-800">{selectedPackage || '-'}</strong>
            </div>
          </div>

          {/* Langkah 3: Terapkan ke Kelas */}
          <div className="bg-white p-5 rounded-3xl border border-blue-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div>
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
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100">
              <Button
                variant="primary"
                size="sm"
                className="w-full justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold"
                onClick={handleApplyClassMapping}
                loading={isApplyingClass}
              >
                Terapkan Paket ke Kelas "{selectedClass}"
              </Button>
            </div>
          </div>
        </div>

        {/* Tabel Verifikasi Peserta Terpetakan */}
        <Card className="overflow-hidden bg-white rounded-3xl border border-kemenag-100 shadow-sm">
          {/* Header & Filter Tabel */}
          <div className="p-5 border-b border-kemenag-100 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">
                  Daftar Peserta & Paket Soal yang Ditetapkan
                </h4>
                <p className="text-xs text-slate-500">
                  Periksa paket soal yang akan diterima masing-masing peserta saat mereka masuk ke ruang ujian.
                </p>
              </div>

              {/* Batch Action Peserta Terpilih */}
              {selectedParticipantIds.length > 0 && (
                <div className="flex items-center gap-2 p-2 bg-kemenag-50 border border-kemenag-200 rounded-2xl animate-fade-in">
                  <span className="text-xs font-bold text-kemenag-800 px-2">
                    {selectedParticipantIds.length} dipilih
                  </span>
                  <select
                    value={customTargetPackage}
                    onChange={(e) => setCustomTargetPackage(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-kemenag-300 text-xs font-bold text-kemenag-900 bg-white"
                  >
                    {dynamicPackages.map(pkg => (
                      <option key={pkg} value={pkg}>{pkg}</option>
                    ))}
                  </select>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleApplyCustomPackageToSelected}
                    loading={isUpdatingSelected}
                  >
                    Ganti Paket
                  </Button>
                </div>
              )}
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari Nama / NIP / Username..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs w-52 bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>

                <select
                  value={filterClassTable}
                  onChange={(e) => setFilterClassTable(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-700"
                >
                  <option value="ALL">Semua Kelas</option>
                  {dynamicClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>

                <select
                  value={filterPackageTable}
                  onChange={(e) => setFilterPackageTable(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-700"
                >
                  <option value="ALL">Semua Paket Soal</option>
                  {dynamicPackages.map(pkg => (
                    <option key={pkg} value={pkg}>{pkg}</option>
                  ))}
                </select>
              </div>

              <span className="text-xs text-slate-500 font-medium">
                Total {filteredParticipants.length} dari {participants.length} peserta
              </span>
            </div>
          </div>

          {/* Isi Tabel Peserta */}
          <div className="overflow-x-auto">
            {filteredParticipants.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Tidak ada data peserta yang cocok dengan kriteria filter.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold">
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedParticipantIds.length > 0 && selectedParticipantIds.length === filteredParticipants.length}
                        onChange={toggleSelectAll}
                        className="rounded text-kemenag-600 focus:ring-kemenag-500"
                      />
                    </th>
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Nama Lengkap & NIP</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4">Paket Soal Aktif</th>
                    <th className="py-3 px-4">Status Ujian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredParticipants.map((p, idx) => {
                    const isChecked = selectedParticipantIds.includes(p.participant_id);
                    const sub = submissions.find(s => s.participant_id === p.participant_id);
                    const isSubmitted = !!sub || String(p.status).toLowerCase() === 'submitted';

                    return (
                      <tr
                        key={p.participant_id || idx}
                        className={`transition ${isChecked ? 'bg-kemenag-50/50' : 'hover:bg-slate-50/60'}`}
                      >
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectOne(p.participant_id)}
                            className="rounded text-kemenag-600 focus:ring-kemenag-500"
                          />
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <strong className="text-slate-800 block">{p.full_name || p.username}</strong>
                          <span className="text-[11px] text-slate-400 font-mono">@{p.username} • NIP: {p.identifier || '-'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {p.kelas || 'Belum Ada Kelas'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-kemenag-800 bg-kemenag-50 border border-kemenag-200 px-2.5 py-1 rounded-xl inline-flex items-center gap-1.5">
                            <BookOpen className="w-3 h-3 text-kemenag-600" />
                            {p.paket || 'Pretest'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {isSubmitted ? (
                            <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-xl text-[11px]">
                              Terkumpul (Skor: {sub?.total_score || sub?.pg_score || 0})
                            </span>
                          ) : (
                            <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-xl text-[11px]">
                              Belum Mengirim
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};
