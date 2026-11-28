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
import {
  DISABILITY_CATEGORIES,
  getDisabilityMeta,
  normalizeDisabilityType,
  isDisabilityParticipant
} from '../../utils/disabilityConfig';
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
  ArrowLeft,
  RotateCw,
  AlertCircle,
  Layers,
  Trash2,
  Accessibility
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

  // State Pop-up Wizard Pemetaan (Step 1 Paket -> Step 2 Peserta -> Step 3 Tetapkan Final)
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardSession, setWizardSession] = useState(null);
  const [wizardStep, setWizardStep] = useState(1); // 1 | 2 | 3
  const [wizardPackage, setWizardPackage] = useState('');
  const [wizardTargetMode, setWizardTargetMode] = useState('class'); // 'class' | 'individual'
  const [wizardSelectedClasses, setWizardSelectedClasses] = useState([]);
  const [wizardSelectedIds, setWizardSelectedIds] = useState([]);
  const [wizardSearch, setWizardSearch] = useState('');
  const [savingMapping, setSavingMapping] = useState(false);

  // State Tabel Verifikasi Peserta Terpetakan di Bawah Rangkuman
  const [selectedTableIds, setSelectedTableIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassTable, setFilterClassTable] = useState('ALL');
  const [filterPackageTable, setFilterPackageTable] = useState('ALL');
  const [filterDisabilityTable, setFilterDisabilityTable] = useState('ALL');
  const [isClearingPlotting, setIsClearingPlotting] = useState(false);

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
      console.error('Gagal memuat data atur ujian:', err);
    } finally {
      setLoading(false);
    }
  };

  // Ekstrak daftar paket murni dari Bank Soal + kelas dari Peserta
  const dynamicPackages = Array.from(
    new Set(questions.map(q => q.paket?.trim()).filter(Boolean))
  );
  const dynamicClasses = Array.from(
    new Set(participants.map(p => p.kelas?.trim()).filter(Boolean))
  );

  // Rangkuman pemetaan per sesi
  const getSessionSummary = (sess) => {
    const mappedParticipants = participants.filter(
      p => String(p.session_id || '').trim() === String(sess.session_id).trim() &&
           String(p.paket || '').trim() !== '' &&
           String(p.paket || '').trim() !== '-'
    );
    const mappedPakets = Array.from(
      new Set(mappedParticipants.map(p => String(p.paket).trim()))
    );
    const mappedClasses = Array.from(
      new Set(mappedParticipants.map(p => String(p.kelas || '').trim()).filter(Boolean))
    );
    const subCount = submissions.filter(
      s => String(s.session_id || '').trim() === String(sess.session_id).trim()
    ).length;

    return { mappedParticipants, mappedPakets, mappedClasses, subCount };
  };

  // Buka Pop-up Wizard saat Rangkuman Data Mata Ujian diklik
  const handleOpenMappingWizard = (sess) => {
    const summary = getSessionSummary(sess);
    setWizardSession(sess);
    setWizardStep(1);
    setWizardPackage(summary.mappedPakets[0] || dynamicPackages[0] || '');

    if (summary.mappedClasses.length > 0 && summary.mappedParticipants.length > 0) {
      setWizardTargetMode('class');
      setWizardSelectedClasses(summary.mappedClasses);
      setWizardSelectedIds(summary.mappedParticipants.map(p => p.participant_id));
    } else {
      setWizardTargetMode('class');
      setWizardSelectedClasses(dynamicClasses.length > 0 ? [dynamicClasses[0]] : []);
      setWizardSelectedIds([]);
    }
    setWizardSearch('');
    setWizardOpen(true);
  };

  const toggleWizardClass = (cls) => {
    setWizardSelectedClasses(prev =>
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    );
  };

  const toggleWizardParticipant = (id) => {
    setWizardSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Hitung peserta target pada Pop-up Wizard berdasarkan mode Pilihan Kelas vs Per Orang
  const getWizardTargetParticipants = () => {
    if (wizardTargetMode === 'class') {
      const lowerSet = new Set(wizardSelectedClasses.map(c => c.toLowerCase()));
      return participants.filter(p => lowerSet.has(String(p.kelas || '').trim().toLowerCase()));
    }
    const idSet = new Set(wizardSelectedIds);
    return participants.filter(p => idSet.has(p.participant_id));
  };

  // Finalisasi & Simpan Pemetaan
  const handleFinalizeMapping = async () => {
    if (!wizardSession) return;
    if (!wizardPackage.trim()) {
      alert('Pilih paket soal terlebih dahulu pada Langkah 1.');
      setWizardStep(1);
      return;
    }
    const targetList = getWizardTargetParticipants();
    if (targetList.length === 0) {
      alert('Pilih minimal 1 kelas atau 1 peserta pada Langkah 2.');
      setWizardStep(2);
      return;
    }

    setSavingMapping(true);
    try {
      const updatedList = targetList.map(p => ({
        ...p,
        paket: wizardPackage,
        session_id: wizardSession.session_id
      }));

      await gasApi.batchSaveParticipants(adminSecretKey, updatedList);
      alert(
        `Pemetaan Final Berhasil Disimpan!\n` +
        `- Mata Ujian: ${wizardSession.title}\n` +
        `- Paket Soal: ${wizardPackage}\n` +
        `- Total Peserta Terpetakan: ${updatedList.length} orang`
      );
      setWizardOpen(false);
      await loadData(true);
    } catch (err) {
      alert('Gagal menyimpan pemetaan ujian: ' + err.message);
    } finally {
      setSavingMapping(false);
    }
  };

  // Reset Plotting untuk sesi tertentu dari kartu Rangkuman
  const handleResetSessionPlotting = async (e, sess) => {
    e.stopPropagation();
    const { mappedParticipants } = getSessionSummary(sess);
    if (mappedParticipants.length === 0) {
      alert(`Belum ada peserta yang terpetakan pada mata ujian "${sess.title}".`);
      return;
    }
    if (!window.confirm(`Hapus plotting ${mappedParticipants.length} peserta dari mata ujian "${sess.title}"?`)) {
      return;
    }
    setIsClearingPlotting(true);
    try {
      const updatedList = mappedParticipants.map(p => ({
        ...p,
        paket: '-',
        session_id: '',
        token_used: '',
        start_time: '',
        status: 'registered'
      }));
      await gasApi.batchSaveParticipants(adminSecretKey, updatedList);
      alert(`Plotting untuk ${updatedList.length} peserta berhasil dibersihkan.`);
      await loadData(true);
    } catch (err) {
      alert('Gagal membersihkan plotting: ' + err.message);
    } finally {
      setIsClearingPlotting(false);
    }
  };

  // Hapus Plotting peserta terpilih di tabel verifikasi
  const handleClearPlottingSelected = async () => {
    if (selectedTableIds.length === 0) return;
    if (!window.confirm(`Hapus plotting mata ujian & paket soal untuk ${selectedTableIds.length} peserta terpilih?`)) {
      return;
    }
    setIsClearingPlotting(true);
    try {
      const selectedParts = participants.filter(p => selectedTableIds.includes(p.participant_id));
      const updatedList = selectedParts.map(p => ({
        ...p,
        paket: '-',
        session_id: '',
        token_used: '',
        start_time: '',
        status: 'registered'
      }));
      await gasApi.batchSaveParticipants(adminSecretKey, updatedList);
      alert(`Plotting untuk ${updatedList.length} peserta berhasil dibersihkan.`);
      setSelectedTableIds([]);
      await loadData(true);
    } catch (err) {
      alert('Gagal membersihkan plotting peserta: ' + err.message);
    } finally {
      setIsClearingPlotting(false);
    }
  };

  // Filter Tabel Verifikasi Peserta
  const filteredParticipants = participants.filter(p => {
    const matchSearch =
      (p.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.identifier || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchClass = filterClassTable === 'ALL' || (p.kelas || '').toLowerCase() === filterClassTable.toLowerCase();
    const matchPkg = filterPackageTable === 'ALL' || (p.paket || '').toLowerCase() === filterPackageTable.toLowerCase();
    const pDis = normalizeDisabilityType(p.disability_type);
    const matchDis =
      filterDisabilityTable === 'ALL' ||
      (filterDisabilityTable === 'DISABILITY_ONLY' && pDis !== 'none') ||
      pDis === filterDisabilityTable;
    return matchSearch && matchClass && matchPkg && matchDis;
  });

  const toggleSelectAllTable = () => {
    if (selectedTableIds.length === filteredParticipants.length) {
      setSelectedTableIds([]);
    } else {
      setSelectedTableIds(filteredParticipants.map(p => p.participant_id));
    }
  };

  const toggleSelectOneTable = (id) => {
    setSelectedTableIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const wizardFilteredIndividuals = participants.filter(p =>
    (p.full_name || '').toLowerCase().includes(wizardSearch.toLowerCase()) ||
    (p.username || '').toLowerCase().includes(wizardSearch.toLowerCase()) ||
    (p.kelas || '').toLowerCase().includes(wizardSearch.toLowerCase())
  );

  const wizardTargetParticipants = getWizardTargetParticipants();

  if (loading) {
    return (
      <AdminLayout title="Atur Ujian & Pemetaan (Langkah 3)">
        <LoadingScreen
          message="Menyiapkan Rangkuman & Pemetaan Ujian..."
          submessage="Mengambil rangkuman mata ujian, paket bank soal, dan daftar peserta..."
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Atur Ujian & Pemetaan (Langkah 3)">
      <div className="space-y-6">
        {/* Navigasi Sub Menu 3-Laman (Langkah 3 aktif) */}
        <ExamSubNav active={3} />

        {/* Header Langkah 3 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-kemenag-100 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-kemenag-700 bg-kemenag-50 px-2.5 py-1 rounded-xl border border-kemenag-200">
                Langkah 3
              </span>
              <h3 className="font-extrabold text-slate-800 text-base">
                Rangkuman Mata Ujian & Pop-Up Pemetaan Paket ke Peserta
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Klik salah satu rangkuman mata ujian atau tekan tombol <strong>"Petakan Ujian Ini"</strong> untuk mengatur paket soal, memilih peserta, lalu menetapkan finalisasi pemetaan.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              icon={RotateCw}
              onClick={() => loadData(true)}
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
              Kelola Data Mata Ujian
            </Button>
          </div>
        </div>

        {/* RANGKUMAN DATA MATA UJIAN (Klik Rangkuman -> Langsung Pop-up Wizard) */}
        <Card className="overflow-hidden bg-white rounded-3xl border border-kemenag-200/80 shadow-sm">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-r from-kemenag-50/70 to-white">
            <div>
              <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-kemenag-600" />
                Rangkuman Data Mata Ujian
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Ringkasan status pemetaan setiap kegiatan evaluasi. Klik baris rangkuman untuk membuka pop-up pengaturan pemetaan.
              </p>
            </div>
            <span className="text-xs font-bold text-kemenag-800 bg-white border border-kemenag-200 px-3 py-1 rounded-xl shrink-0">
              {sessions.length} Mata Ujian Terdata
            </span>
          </div>

          {sessions.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs space-y-3">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
              <p>Belum ada data mata ujian. Buat mata ujian terlebih dahulu di Langkah 1.</p>
              <Button variant="primary" size="sm" onClick={() => navigate('/admin/sessions')}>
                Ke Data Mata Ujian (Langkah 1)
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sessions.map((sess) => {
                const { mappedParticipants, mappedPakets, mappedClasses, subCount } = getSessionSummary(sess);
                const isMapped = mappedParticipants.length > 0 && mappedPakets.length > 0;

                return (
                  <div
                    key={sess.session_id}
                    onClick={() => handleOpenMappingWizard(sess)}
                    className="p-5 hover:bg-kemenag-50/40 transition cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4 group"
                  >
                    {/* Kolom Rangkuman 1: Info Ringkas Mata Ujian */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg uppercase tracking-wider ${
                          (sess.type || '').toLowerCase() === 'pretest'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-kemenag-100 text-kemenag-900 border border-kemenag-300'
                        }`}>
                          {sess.type || 'Pretest'}
                        </span>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border ${
                          sess.is_active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {sess.is_active ? 'Dibuka' : 'Ditutup'}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-kemenag-800 bg-kemenag-50 px-2 py-0.5 rounded-lg border border-kemenag-200 flex items-center gap-1">
                          <Key className="w-3 h-3" /> {sess.token}
                        </span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" /> {sess.duration_minutes || 60} mnt
                        </span>
                      </div>

                      <h5 className="font-extrabold text-slate-900 text-sm group-hover:text-kemenag-700 transition">
                        {sess.title}
                      </h5>
                    </div>

                    {/* Kolom Rangkuman 2: Status Pemetaan Paket & Peserta */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:w-[440px] shrink-0">
                      <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                        <span className="block text-[10px] font-bold uppercase text-slate-400">Paket Soal</span>
                        {mappedPakets.length > 0 ? (
                          <span className="text-xs font-extrabold text-emerald-800 line-clamp-1">
                            {mappedPakets.join(', ')}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-amber-600">Belum dipilih</span>
                        )}
                      </div>

                      <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                        <span className="block text-[10px] font-bold uppercase text-slate-400">Peserta Terplot</span>
                        <span className="text-xs font-extrabold text-slate-800 block">
                          {mappedParticipants.length} Orang
                        </span>
                        {mappedParticipants.some(isDisabilityParticipant) && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 mt-0.5">
                            <Accessibility className="w-3 h-3" />
                            {mappedParticipants.filter(isDisabilityParticipant).length} Disabilitas
                          </span>
                        )}
                        {mappedClasses.length > 0 && (
                          <span className="text-[10px] text-slate-500 line-clamp-1 block">
                            {mappedClasses.join(', ')}
                          </span>
                        )}
                      </div>

                      <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 col-span-2 sm:col-span-1">
                        <span className="block text-[10px] font-bold uppercase text-slate-400">Submisi</span>
                        <span className="text-xs font-extrabold text-sky-800 block">
                          {subCount} Terkumpul
                        </span>
                      </div>
                    </div>

                    {/* Kolom Rangkuman 3: Tombol Petakan Ujian Ini */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isMapped && (
                        <button
                          type="button"
                          onClick={(e) => handleResetSessionPlotting(e, sess)}
                          disabled={isClearingPlotting}
                          className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition"
                          title="Hapus semua plotting pada mata ujian ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      <Button
                        variant="primary"
                        size="sm"
                        icon={Sliders}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenMappingWizard(sess);
                        }}
                      >
                        {isMapped ? 'Ubah Pemetaan' : 'Petakan Ujian Ini'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Tabel Verifikasi Daftar Peserta & Paket Soal Aktif */}
        <Card className="overflow-hidden bg-white rounded-3xl border border-kemenag-100 shadow-sm">
          <div className="p-5 border-b border-kemenag-100 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">
                  Hasil Pemetaan Peserta & Paket Soal Aktif
                </h4>
                <p className="text-xs text-slate-500">
                  Verifikasi akhir peserta yang sudah dipetakan paket soalnya pada masing-masing mata ujian.
                </p>
              </div>

              {selectedTableIds.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={Trash2}
                  onClick={handleClearPlottingSelected}
                  loading={isClearingPlotting}
                  className="border-rose-300 text-rose-700 hover:bg-rose-50 shrink-0"
                >
                  Hapus Plotting ({selectedTableIds.length} Peserta)
                </Button>
              )}
            </div>

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

                <select
                  value={filterDisabilityTable}
                  onChange={(e) => setFilterDisabilityTable(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-indigo-200 text-xs font-bold bg-indigo-50/70 text-indigo-800"
                >
                  <option value="ALL">Semua Kondisi Peserta</option>
                  <option value="none">Hanya Non-Disabilitas</option>
                  <option value="DISABILITY_ONLY">Hanya Disabilitas</option>
                  {DISABILITY_CATEGORIES.filter(c => c.key !== 'none').map(c => (
                    <option key={c.key} value={c.key}>{c.shortLabel}</option>
                  ))}
                </select>
              </div>

              <span className="text-xs text-slate-500 font-medium">
                Total {filteredParticipants.length} dari {participants.length} peserta
              </span>
            </div>
          </div>

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
                        checked={selectedTableIds.length > 0 && selectedTableIds.length === filteredParticipants.length}
                        onChange={toggleSelectAllTable}
                        className="rounded text-kemenag-600 focus:ring-kemenag-500"
                      />
                    </th>
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Nama Lengkap & NIP</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4">Disabilitas</th>
                    <th className="py-3 px-4">Mata Ujian Terhubung</th>
                    <th className="py-3 px-4">Paket Soal Aktif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredParticipants.map((p, idx) => {
                    const isChecked = selectedTableIds.includes(p.participant_id);
                    const mappedSess = sessions.find(s => String(s.session_id) === String(p.session_id));
                    const disMeta = getDisabilityMeta(p.disability_type);

                    return (
                      <tr
                        key={p.participant_id || idx}
                        className={`transition ${isChecked ? 'bg-kemenag-50/50' : 'hover:bg-slate-50/60'}`}
                      >
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectOneTable(p.participant_id)}
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
                            {p.kelas || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold border ${disMeta.badgeClass}`}>
                            {disMeta.key !== 'none' && <Accessibility className="w-3 h-3 shrink-0" />}
                            {disMeta.shortLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {mappedSess ? (
                            <span className="text-slate-800 font-semibold line-clamp-1">{mappedSess.title}</span>
                          ) : (
                            <span className="text-slate-400 italic">Belum terhubung</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {p.paket && p.paket !== '-' ? (
                            <span className="font-bold text-kemenag-800 bg-kemenag-50 border border-kemenag-200 px-2.5 py-1 rounded-xl inline-flex items-center gap-1.5">
                              <BookOpen className="w-3 h-3 text-kemenag-600" />
                              {p.paket}
                            </span>
                          ) : (
                            <span className="text-slate-400 bg-slate-100 px-2.5 py-1 rounded-xl text-[11px] font-medium">
                              Belum Diplot
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

      {/* POP-UP WIZARD PEMETAAN UJIAN (1. Paket Soal -> 2. Peserta -> 3. Tetapkan Final) */}
      <Modal
        isOpen={wizardOpen && Boolean(wizardSession)}
        onClose={() => !savingMapping && setWizardOpen(false)}
        title={`Petakan Ujian: ${wizardSession?.title || ''}`}
        maxWidth="max-w-3xl"
      >
        {wizardSession && (
          <div className="space-y-5 text-xs">
            {/* Indikator 3 Langkah dalam Pop-up */}
            <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 border border-slate-200 rounded-2xl">
              {[
                { step: 1, label: '1. Paket Soal' },
                { step: 2, label: '2. Pilih Peserta' },
                { step: 3, label: '3. Tetapkan Final' }
              ].map((item) => {
                const isCurrent = wizardStep === item.step;
                const isDone = wizardStep > item.step;
                return (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => {
                      if (item.step === 1 || (item.step === 2 && wizardPackage) || (item.step === 3 && wizardPackage && wizardTargetParticipants.length > 0)) {
                        setWizardStep(item.step);
                      }
                    }}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition ${
                      isCurrent
                        ? 'bg-kemenag-600 text-white shadow-sm'
                        : isDone
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'text-slate-500 bg-white/70'
                    }`}
                  >
                    {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* LANGKAH 1 POP-UP: PENENTUAN PAKET SOAL */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div className="p-3.5 bg-kemenag-50/70 border border-kemenag-200 rounded-2xl flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-kemenag-700">Mata Ujian Terpilih</span>
                    <h5 className="font-extrabold text-slate-900 text-sm">{wizardSession.title}</h5>
                  </div>
                  <span className="font-mono font-bold text-kemenag-800 bg-white px-2.5 py-1 rounded-xl border border-kemenag-200">
                    Token: {wizardSession.token}
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-2">
                    Pilih Paket Bank Soal yang Akan Dikerjakan:
                  </label>

                  {dynamicPackages.length === 0 ? (
                    <div className="p-6 text-center bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                      <AlertCircle className="w-7 h-7 text-amber-600 mx-auto" />
                      <p className="font-bold text-amber-900">Belum ada paket soal di Bank Soal!</p>
                      <p className="text-amber-800 text-[11px]">
                        Silakan buat atau impor soal pada menu "2. Data Bank Soal & Paket" terlebih dahulu.
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setWizardOpen(false);
                          navigate('/admin/questions');
                        }}
                      >
                        Buka Bank Soal (Langkah 2)
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                      {dynamicPackages.map((pkg) => {
                        const pkgQuestions = questions.filter(
                          q => (q.paket || '').trim().toLowerCase() === pkg.toLowerCase()
                        );
                        const totalWeight = pkgQuestions.reduce((acc, q) => acc + (Number(q.weight) || 1), 0);
                        const selected = wizardPackage === pkg;

                        return (
                          <button
                            key={pkg}
                            type="button"
                            onClick={() => setWizardPackage(pkg)}
                            className={`p-4 rounded-2xl border text-left transition flex items-start justify-between gap-3 ${
                              selected
                                ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 shadow-sm'
                                : 'bg-white border-slate-200 hover:border-emerald-300'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <BookOpen className={`w-4 h-4 ${selected ? 'text-emerald-700' : 'text-slate-400'}`} />
                                <span className="font-extrabold text-sm text-slate-900">{pkg}</span>
                              </div>
                              <p className="text-[11px] text-slate-500">
                                {pkgQuestions.length} butir soal • Bobot total: {totalWeight} poin
                              </p>
                            </div>
                            <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                              selected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                            }`}>
                              {selected && <CheckCircle2 className="w-3.5 h-3.5" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <Button variant="secondary" onClick={() => setWizardOpen(false)}>
                    Batal
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!wizardPackage}
                    onClick={() => setWizardStep(2)}
                    icon={ArrowRight}
                  >
                    Lanjut Pilih Peserta
                  </Button>
                </div>
              </div>
            )}

            {/* LANGKAH 2 POP-UP: PENENTUAN PESERTA (KELAS / PER ORANG) */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h5 className="font-extrabold text-slate-800 text-sm">
                      Tentukan Peserta Ujian
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      Paket terpilih: <strong className="text-emerald-700">{wizardPackage}</strong> • Target saat ini: <strong className="text-blue-700">{wizardTargetParticipants.length} peserta</strong>
                    </p>
                  </div>

                  {/* Toggle Mode: Pilih Kelas vs Pilih Per Orang */}
                  <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setWizardTargetMode('class')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                        wizardTargetMode === 'class'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Pilih Kelas
                    </button>
                    <button
                      type="button"
                      onClick={() => setWizardTargetMode('individual')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                        wizardTargetMode === 'individual'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Pilih Per Orang
                    </button>
                  </div>
                </div>

                {wizardTargetMode === 'class' ? (
                  <div className="space-y-2.5">
                    {dynamicClasses.length === 0 ? (
                      <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500">
                        Belum ada data kelas/peserta terdaftar.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                        {dynamicClasses.map((cls) => {
                          const count = participants.filter(
                            p => (p.kelas || '').trim().toLowerCase() === cls.toLowerCase()
                          ).length;
                          const checked = wizardSelectedClasses.includes(cls);
                          return (
                            <label
                              key={cls}
                              className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between transition ${
                                checked
                                  ? 'bg-blue-50 border-blue-500 text-blue-950 font-bold'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleWizardClass(cls)}
                                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                                />
                                <span>{cls}</span>
                              </div>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-600">
                                {count} Peserta
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Cari nama, username, atau kelas peserta..."
                          value={wizardSearch}
                          onChange={(e) => setWizardSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const ids = wizardFilteredIndividuals.map(p => p.participant_id);
                          setWizardSelectedIds(Array.from(new Set([...wizardSelectedIds, ...ids])));
                        }}
                      >
                        Pilih Semua ({wizardFilteredIndividuals.length})
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setWizardSelectedIds([])}
                      >
                        Kosongkan
                      </Button>
                    </div>

                    <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-slate-50/40">
                      {wizardFilteredIndividuals.map((p) => {
                        const checked = wizardSelectedIds.includes(p.participant_id);
                        return (
                          <label
                            key={p.participant_id}
                            className={`flex items-center gap-3 px-3.5 py-2 cursor-pointer transition ${
                              checked ? 'bg-blue-50 font-bold text-blue-950' : 'hover:bg-white text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleWizardParticipant(p.participant_id)}
                              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="block truncate">{p.full_name || p.username}</span>
                              <span className="text-[10px] text-slate-400 font-mono font-normal">@{p.username}</span>
                            </div>
                            {isDisabilityParticipant(p) && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border shrink-0 ${getDisabilityMeta(p.disability_type).badgeClass}`}>
                                <Accessibility className="w-3 h-3" />
                                {getDisabilityMeta(p.disability_type).shortLabel}
                              </span>
                            )}
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-600 shrink-0">
                              {p.kelas || '-'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <Button
                    variant="secondary"
                    icon={ArrowLeft}
                    onClick={() => setWizardStep(1)}
                  >
                    Kembali ke Paket Soal
                  </Button>
                  <Button
                    variant="primary"
                    disabled={wizardTargetParticipants.length === 0}
                    onClick={() => setWizardStep(3)}
                    icon={ArrowRight}
                  >
                    Lanjut Tetapkan Final ({wizardTargetParticipants.length})
                  </Button>
                </div>
              </div>
            )}

            {/* LANGKAH 3 POP-UP: REVIEW & TETAPKAN FINAL */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm">
                    <CheckCheck className="w-5 h-5 text-emerald-600" />
                    <span>Konfirmasi Penetapan Final Pemetaan</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-white border border-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">1. Mata Ujian</span>
                      <strong className="text-slate-900 block mt-0.5">{wizardSession.title}</strong>
                      <span className="text-[11px] font-mono text-kemenag-700">Token: {wizardSession.token}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">2. Paket Soal</span>
                      <strong className="text-emerald-800 block mt-0.5">{wizardPackage}</strong>
                      <span className="text-[11px] text-slate-500">
                        {questions.filter(q => (q.paket || '').trim().toLowerCase() === wizardPackage.toLowerCase()).length} Butir Soal
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">3. Peserta Sasaran</span>
                      <strong className="text-blue-800 block mt-0.5">{wizardTargetParticipants.length} Peserta</strong>
                      <span className="text-[11px] text-slate-500 block">
                        {wizardTargetMode === 'class'
                          ? `Kelas: ${wizardSelectedClasses.join(', ')}`
                          : 'Pilihan Per Orang'}
                      </span>
                      {wizardTargetParticipants.some(isDisabilityParticipant) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 mt-1">
                          <Accessibility className="w-3 h-3" />
                          {wizardTargetParticipants.filter(isDisabilityParticipant).length} Disabilitas (Aksesibilitas Aktif)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/80 border border-emerald-100">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Pratinjau Peserta yang Akan Menerima Soal Paket "{wizardPackage}":
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {wizardTargetParticipants.slice(0, 15).map((p) => (
                        <span
                          key={p.participant_id}
                          className="px-2 py-0.5 rounded-lg bg-emerald-100/70 text-emerald-950 font-semibold text-[11px]"
                        >
                          {p.full_name || p.username}
                        </span>
                      ))}
                      {wizardTargetParticipants.length > 15 && (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-bold text-[11px]">
                          +{wizardTargetParticipants.length - 15} peserta lainnya
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <Button
                    variant="secondary"
                    icon={ArrowLeft}
                    disabled={savingMapping}
                    onClick={() => setWizardStep(2)}
                  >
                    Ubah Peserta
                  </Button>
                  <Button
                    variant="success"
                    icon={CheckCheck}
                    loading={savingMapping}
                    onClick={handleFinalizeMapping}
                  >
                    Tetapkan Final & Simpan Pemetaan
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
};
