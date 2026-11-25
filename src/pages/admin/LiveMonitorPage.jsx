import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import {
  Radio,
  RefreshCw,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Users,
  ShieldAlert,
  Send,
  Eye,
  LogOut,
  AlertCircle,
  Play,
  Pause,
  Layers,
  Award,
  Sparkles,
  Lock,
  Grid,
  List
} from 'lucide-react';

export const LiveMonitorPage = () => {
  const { adminSecretKey, isAdminLoggedIn, adminRole } = useAuth();
  const navigate = useNavigate();

  // State Data
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [proctorData, setProctorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-refresh controls
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(10);
  const [countdown, setCountdown] = useState(10);

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'in_progress' | 'submitted' | 'violation'
  const [filterKelas, setFilterKelas] = useState('ALL');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Modal Aksi Pengawas
  const [showWarnModal, setShowWarnModal] = useState(false);
  const [targetParticipant, setTargetParticipant] = useState(null);
  const [warningMessage, setWarningMessage] = useState('Harap tetap fokus pada lembar soal dan jangan membuka tab lain!');
  const [sendingAction, setSendingAction] = useState(false);

  // Audio Beep Ref untuk alarm pelanggaran baru
  const prevViolationsRef = useRef(0);

  useEffect(() => {
    if (!isAdminLoggedIn) {
      navigate('/admin/login');
      return;
    }
    loadInitialSessions();
  }, [isAdminLoggedIn, navigate]);

  // Muat daftar sesi ujian yang tersedia
  const loadInitialSessions = async () => {
    setLoading(true);
    try {
      const res = await gasApi.getAdminDashboard(adminSecretKey);
      if (res.status === 'success') {
        const sessList = res.sessions || [];
        setSessions(sessList);
        if (sessList.length > 0) {
          const active = sessList.find(s => s.is_active) || sessList[0];
          setSelectedSessionId(active.session_id);
          await fetchProctorData(active.session_id);
        }
      }
    } catch (err) {
      console.error('Gagal memuat sesi untuk monitor:', err);
    } finally {
      setLoading(false);
    }
  };

  // Ambil Data Live Proctor
  const fetchProctorData = useCallback(async (sessionIdToFetch) => {
    const sId = sessionIdToFetch || selectedSessionId;
    if (!sId) return;

    setRefreshing(true);
    try {
      const res = await gasApi.getLiveProctor(adminSecretKey, sId);
      if (res.status === 'success') {
        setProctorData(res);

        // Deteksi jika ada penambahan pelanggaran baru (alarm visual)
        const totalViolations = (res.participants || []).reduce(
          (sum, p) => sum + (Number(p.violations) || 0),
          0
        );
        if (totalViolations > prevViolationsRef.current && prevViolationsRef.current > 0) {
          // Play gentle web audio beep jika diizinkan browser
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
          } catch (e) {}
        }
        prevViolationsRef.current = totalViolations;
      }
    } catch (err) {
      console.error('Gagal memuat data live proctor:', err);
    } finally {
      setRefreshing(false);
    }
  }, [adminSecretKey, selectedSessionId]);

  // Handle pergantian sesi
  const handleSessionChange = (newSessionId) => {
    setSelectedSessionId(newSessionId);
    setCountdown(refreshIntervalSec);
    fetchProctorData(newSessionId);
  };

  // Timer Countdown Auto-Refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchProctorData();
          return refreshIntervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh, refreshIntervalSec, fetchProctorData]);

  // Handler Kirim Peringatan / Tindakan Pengawas
  const handleSendWarning = async (e) => {
    e.preventDefault();
    if (!targetParticipant || !warningMessage.trim()) return;

    setSendingAction(true);
    try {
      await gasApi.sendProctorAction(
        adminSecretKey,
        selectedSessionId,
        targetParticipant.participant_id,
        'warn',
        warningMessage.trim()
      );
      alert(`Peringatan berhasil dikirimkan ke layar ${targetParticipant.full_name}!`);
      setShowWarnModal(false);
      setTargetParticipant(null);
      fetchProctorData();
    } catch (err) {
      alert('Gagal mengirim peringatan: ' + err.message);
    } finally {
      setSendingAction(false);
    }
  };

  // Handler Paksa Selesai / Kumpulkan
  const handleForceSubmit = async (p) => {
    if (!window.confirm(`Yakin ingin MEMAKSA KUMPULKAN ujian untuk peserta "${p.full_name}"? Lembar jawabannya akan langsung difinalisasi.`)) {
      return;
    }

    try {
      await gasApi.sendProctorAction(
        adminSecretKey,
        selectedSessionId,
        p.participant_id,
        'force_submit',
        'Ujian telah dikumpulkan paksa oleh Pengawas Ujian.'
      );
      alert(`Perintah kumpulkan paksa telah dikirim untuk ${p.full_name}.`);
      fetchProctorData();
    } catch (err) {
      alert('Gagal mengirim instruksi kumpulkan paksa: ' + err.message);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Live Monitor & Pengawasan Ujian">
        <LoadingScreen
          message="Menyiapkan Ruang Pengawasan Live..."
          submessage="Sedang menyinkronkan status peserta, sisa waktu, dan deteksi perpindahan tab secara real-time..."
        />
      </AdminLayout>
    );
  }

  const rawParticipants = proctorData?.participants || [];
  const currentSession = sessions.find(s => s.session_id === selectedSessionId) || proctorData?.session;

  // Deduplikasi peserta unik berdasarkan username / identifier / ID
  // Memastikan total peserta tetap 38 dan tidak ada nama ganda di monitor
  const uniqueParticipantsMap = new Map();
  rawParticipants.forEach(p => {
    const key = String(p.username || p.identifier || p.participant_id || '').trim().toLowerCase();
    if (!key) return;
    if (!uniqueParticipantsMap.has(key)) {
      uniqueParticipantsMap.set(key, p);
    } else {
      const existing = uniqueParticipantsMap.get(key);
      const isCurrentActive = p.status === 'submitted' || p.status === 'in_progress';
      const isExistingActive = existing.status === 'submitted' || existing.status === 'in_progress';
      // Prioritaskan baris yang memiliki status lebih aktif (submitted > in_progress > registered)
      if (isCurrentActive && (!isExistingActive || p.status === 'submitted')) {
        uniqueParticipantsMap.set(key, { ...existing, ...p });
      }
    }
  });
  const participants = Array.from(uniqueParticipantsMap.values());

  // Daftar kelas unik untuk filter
  const uniqueClasses = Array.from(new Set(participants.map(p => p.kelas?.trim()).filter(Boolean)));

  // Filter Data Peserta
  const filteredParticipants = participants.filter(p => {
    const matchSearch =
      (p.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.kelas || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchKelas = filterKelas === 'ALL' || (p.kelas || '').toLowerCase() === filterKelas.toLowerCase();

    let matchStatus = true;
    if (filterStatus === 'in_progress') {
      matchStatus = p.status === 'in_progress';
    } else if (filterStatus === 'submitted') {
      matchStatus = p.status === 'submitted';
    } else if (filterStatus === 'violation') {
      matchStatus = Number(p.violations) > 0;
    }

    return matchSearch && matchKelas && matchStatus;
  });

  const totalRegistered = participants.length;
  const countInProgress = participants.filter(p => p.status === 'in_progress').length;
  const countSubmitted = participants.filter(p => p.status === 'submitted').length;
  const countViolations = participants.filter(p => Number(p.violations) > 0).length;

  return (
    <AdminLayout title="Live Monitor & Pengawasan Ujian Real-Time">
      <div className="space-y-6">

        {/* Toolbar Header Pengawasan */}
        <div className="bg-white p-5 rounded-3xl border border-kemenag-100 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-800 text-sm">Pilih Sesi Ujian yang Dipantau:</h3>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Live Monitoring
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <select
                  value={selectedSessionId}
                  onChange={(e) => handleSessionChange(e.target.value)}
                  className="px-3.5 py-1.5 rounded-xl border border-emerald-300 text-xs font-bold text-emerald-950 bg-emerald-50/50 focus:outline-none"
                >
                  {sessions.map(s => (
                    <option key={s.session_id} value={s.session_id}>
                      {s.title} ({s.type?.toUpperCase()} - Token: {s.token})
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">•</span>
                <span className="text-xs text-slate-500 hidden sm:inline">
                  Durasi: <strong className="text-slate-700">{currentSession?.duration_minutes || 60} menit</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Kontrol Auto-Refresh & Tombol Segarkan */}
          <div className="flex items-center gap-2.5 self-end lg:self-center">
            {/* Toggle Pause / Resume */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 border ${
                autoRefresh
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
              title={autoRefresh ? 'Jeda pembaruan otomatis' : 'Lanjutkan pembaruan otomatis'}
            >
              {autoRefresh ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Auto ({countdown}s)</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-amber-600" />
                  <span>Dijeda</span>
                </>
              )}
            </button>

            {/* Pilihan Interval Refresh */}
            <select
              value={refreshIntervalSec}
              onChange={(e) => {
                const val = Number(e.target.value);
                setRefreshIntervalSec(val);
                setCountdown(val);
              }}
              className="px-2.5 py-2 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:outline-none"
            >
              <option value={5}>Setiap 5 detik</option>
              <option value={10}>Setiap 10 detik</option>
              <option value={20}>Setiap 20 detik</option>
              <option value={30}>Setiap 30 detik</option>
            </select>

            {/* Tombol Refresh Manual */}
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={() => {
                setCountdown(refreshIntervalSec);
                fetchProctorData();
              }}
              disabled={refreshing}
              className={`border-slate-200 text-slate-700 hover:bg-slate-100 ${refreshing ? 'animate-spin' : ''}`}
            >
              {refreshing ? 'Memperbarui...' : 'Segarkan'}
            </Button>
          </div>
        </div>

        {/* 4 Kartu KPI Statistik Pengawasan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Peserta Terdaftar */}
          <Card className="p-5 bg-white rounded-3xl border border-kemenag-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Peserta Sesi</span>
              <h4 className="text-2xl font-black text-slate-800 mt-1">{totalRegistered}</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">{uniqueClasses.length} Kelas Terdata</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </Card>

          {/* Card 2: Sedang Mengerjakan (Active Live) */}
          <Card className="p-5 bg-emerald-50/70 rounded-3xl border border-emerald-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">Sedang Mengerjakan</span>
              </div>
              <h4 className="text-2xl font-black text-emerald-950 mt-1">{countInProgress}</h4>
              <p className="text-[11px] text-emerald-700 mt-0.5">Aktif di ruang ujian</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Clock className="w-6 h-6 animate-spin-slow" />
            </div>
          </Card>

          {/* Card 3: Sudah Mengumpulkan */}
          <Card className="p-5 bg-sky-50/70 rounded-3xl border border-sky-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">Sudah Mengumpulkan</span>
              <h4 className="text-2xl font-black text-sky-950 mt-1">{countSubmitted}</h4>
              <p className="text-[11px] text-sky-700 mt-0.5">Lembar jawaban terkirim</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </Card>

          {/* Card 4: Terindikasi Curang / Pelanggaran */}
          <Card className={`p-5 rounded-3xl border shadow-sm flex items-center justify-between ${
            countViolations > 0
              ? 'bg-rose-50 border-rose-300 animate-pulse'
              : 'bg-white border-kemenag-100'
          }`}>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black text-rose-800 uppercase tracking-wider">Terdeteksi Curang</span>
                {countViolations > 0 && (
                  <span className="px-1.5 py-0.2 rounded-md bg-rose-600 text-white text-[10px] font-bold">ALARM</span>
                )}
              </div>
              <h4 className="text-2xl font-black text-rose-950 mt-1">{countViolations} Peserta</h4>
              <p className="text-[11px] text-rose-800 mt-0.5">Keluar layar / Pindah tab</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-sm">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </Card>
        </div>

        {/* Bar Filter & Pencarian Peserta */}
        <div className="bg-white p-4 rounded-3xl border border-kemenag-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama peserta, username, kelas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
            {/* Filter Status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:outline-none"
            >
              <option value="ALL">Semua Status ({rawParticipants.length})</option>
              <option value="in_progress">Sedang Mengerjakan ({countInProgress})</option>
              <option value="submitted">Sudah Selesai ({countSubmitted})</option>
              <option value="violation">Ada Pelanggaran ({countViolations})</option>
            </select>

            {/* Filter Kelas */}
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:outline-none"
            >
              <option value="ALL">Semua Kelas</option>
              {uniqueClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Toggle View Mode (Grid / List Table) */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-xl transition ${viewMode === 'grid' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-400'}`}
                title="Tampilan Kartu"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-xl transition ${viewMode === 'table' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-400'}`}
                title="Tampilan Tabel"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* DAFTAR MONITOR PESERTA */}
        {filteredParticipants.length === 0 ? (
          <Card className="p-12 text-center text-slate-400 text-sm bg-white rounded-3xl border border-kemenag-100">
            <Radio className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-slate-600">Tidak ada data peserta yang cocok dengan kriteria filter.</p>
            <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau ganti sesi ujian aktif.</p>
          </Card>
        ) : viewMode === 'grid' ? (
          /* TAMPILAN GRID KARTU */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredParticipants.map((p) => {
              const hasViolations = Number(p.violations) > 0;
              const isFinished = p.status === 'submitted';
              const isWorking = p.status === 'in_progress';
              const progressPct = p.total_questions > 0 ? Math.round((p.answered_count / p.total_questions) * 100) : 0;

              return (
                <Card
                  key={p.participant_id}
                  className={`p-5 rounded-3xl border transition shadow-sm space-y-3 relative overflow-hidden ${
                    hasViolations
                      ? 'bg-rose-50/50 border-rose-300 ring-2 ring-rose-200'
                      : isWorking
                        ? 'bg-white border-emerald-200'
                        : 'bg-white border-slate-200'
                  }`}
                >
                  {/* Badge Header Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-8 h-8 rounded-xl font-extrabold text-xs flex items-center justify-center ${
                        hasViolations
                          ? 'bg-rose-600 text-white'
                          : isWorking
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                      }`}>
                        {(p.full_name || 'P')[0]?.toUpperCase()}
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs leading-snug line-clamp-1">
                          {p.full_name}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {p.username || p.identifier} • {p.kelas}
                        </p>
                      </div>
                    </div>

                    {/* Status Pill */}
                    {isFinished ? (
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-sky-600" /> Selesai
                      </span>
                    ) : isWorking ? (
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Mengerjakan
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-slate-100 text-slate-600">
                        Belum Mulai
                      </span>
                    )}
                  </div>

                  {/* Anti-Cheat Warning Badge */}
                  <div className={`p-2.5 rounded-2xl border text-xs flex items-center justify-between ${
                    hasViolations
                      ? 'bg-rose-100/80 border-rose-300 text-rose-950 font-bold'
                      : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  }`}>
                    <div className="flex items-center gap-2">
                      {hasViolations ? (
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 animate-bounce" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      <div>
                        <span className="block text-[11px]">
                          {hasViolations
                            ? `⚠️ ${p.violations}x Pelanggaran Layar!`
                            : 'Fokus Ujian Aman (0 Pelanggaran)'}
                        </span>
                        {p.last_violation_msg && (
                          <span className="block text-[10px] text-rose-700 font-normal">
                            {p.last_violation_msg}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progres Pengerjaan Soal */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Progres Jawaban:</span>
                      <strong className="text-slate-800 font-mono">
                        {p.answered_count} / {p.total_questions} Soal ({progressPct}%)
                      </strong>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isFinished ? 'bg-sky-500' : progressPct >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, progressPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Nilai jika sudah selesai */}
                  {isFinished && p.score !== null && (
                    <div className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-xs flex items-center justify-between">
                      <span className="text-sky-800 font-semibold">Skor Akhir:</span>
                      <strong className="font-mono font-black text-sky-950 text-sm">{p.score} Poin</strong>
                    </div>
                  )}

                  {/* Tombol Aksi Pengawas */}
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setTargetParticipant(p);
                        setWarningMessage(`Halo ${p.full_name}, pengawas mendeteksi Anda berpindah tab. Harap tetap berada di lembar soal!`);
                        setShowWarnModal(true);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1.5 transition flex-1 justify-center"
                    >
                      <Send className="w-3 h-3 text-amber-600" /> Tegur Layar
                    </button>

                    {isWorking && (
                      <button
                        onClick={() => handleForceSubmit(p)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1.5 transition shrink-0"
                        title="Paksa peserta mengumpulkan ujian sekarang"
                      >
                        <LogOut className="w-3 h-3 text-rose-600" /> Kumpulkan Paksa
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          /* TAMPILAN TABEL DETIL */
          <div className="bg-white rounded-3xl border border-kemenag-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5 pl-5">Peserta</th>
                    <th className="p-3.5">Kelas / Rombel</th>
                    <th className="p-3.5">Status Ujian</th>
                    <th className="p-3.5">Progres Terjawab</th>
                    <th className="p-3.5">Pelanggaran / Curang</th>
                    <th className="p-3.5">Nilai Akhir</th>
                    <th className="p-3.5 pr-5 text-right">Aksi Pengawas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredParticipants.map((p) => {
                    const hasViolations = Number(p.violations) > 0;
                    const isFinished = p.status === 'submitted';
                    const isWorking = p.status === 'in_progress';
                    const progressPct = p.total_questions > 0 ? Math.round((p.answered_count / p.total_questions) * 100) : 0;

                    return (
                      <tr key={p.participant_id} className={`hover:bg-slate-50/80 transition ${hasViolations ? 'bg-rose-50/30' : ''}`}>
                        <td className="p-3.5 pl-5">
                          <div className="font-bold text-slate-900">{p.full_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{p.username}</div>
                        </td>
                        <td className="p-3.5">
                          <span className="font-medium text-slate-700">{p.kelas || '-'}</span>
                          <div className="text-[10px] text-slate-400">{p.paket || 'Pretest'}</div>
                        </td>
                        <td className="p-3.5">
                          {isFinished ? (
                            <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-sky-600" /> Selesai
                            </span>
                          ) : isWorking ? (
                            <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Mengerjakan
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-500">
                              Belum Mulai
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <div className="font-mono font-bold text-slate-800">{p.answered_count} / {p.total_questions} ({progressPct}%)</div>
                          <div className="w-24 bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${progressPct}%` }} />
                          </div>
                        </td>
                        <td className="p-3.5">
                          {hasViolations ? (
                            <span className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1 animate-pulse">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> {p.violations}x Pindah Tab
                            </span>
                          ) : (
                            <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Bersih
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          {p.score !== null ? (
                            <span className="font-mono font-bold text-sky-950 text-xs px-2 py-0.5 rounded-lg bg-sky-50 border border-sky-200">
                              {p.score} Poin
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="p-3.5 pr-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setTargetParticipant(p);
                                setWarningMessage(`Halo ${p.full_name}, pengawas mendeteksi Anda berpindah tab. Harap tetap berada di lembar soal!`);
                                setShowWarnModal(true);
                              }}
                              className="p-1.5 rounded-xl text-amber-700 hover:bg-amber-100 border border-amber-200"
                              title="Kirim Teguran Langsung ke Layar Peserta"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            {isWorking && (
                              <button
                                onClick={() => handleForceSubmit(p)}
                                className="p-1.5 rounded-xl text-rose-700 hover:bg-rose-100 border border-rose-200"
                                title="Paksa Kumpulkan Ujian"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Modal Kirim Teguran Langsung ke Layar Peserta */}
      {showWarnModal && targetParticipant && (
        <Modal
          isOpen={showWarnModal}
          onClose={() => setShowWarnModal(false)}
          title={`Kirim Peringatan ke Layar: ${targetParticipant.full_name}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSendWarning} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold">Notifikasi Peringatan Instan</p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Pesan ini akan langsung muncul sebagai popup di tengah layar komputer/HP peserta dan menghentikan aktivitas ujian hingga mereka mengklik tombol konfirmasi.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Pilih Template Pesan Pengawas:
              </label>
              <div className="space-y-1.5">
                {[
                  'Harap tetap fokus pada lembar soal dan jangan membuka tab lain!',
                  'Peringatan Terakhir: Pengawas mendeteksi Anda keluar dari halaman ujian!',
                  'Dilarang membuka browser lain atau berdiskusi selama ujian berlangsung.'
                ].map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setWarningMessage(tmpl)}
                    className="w-full text-left p-2 rounded-xl border border-slate-200 text-[11px] text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 transition"
                  >
                    • {tmpl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ketik / Edit Pesan:
              </label>
              <textarea
                value={warningMessage}
                onChange={(e) => setWarningMessage(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowWarnModal(false)}
                disabled={sendingAction}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                type="submit"
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                disabled={sendingAction}
                icon={Send}
              >
                {sendingAction ? 'Mengirim...' : 'Kirim Peringatan'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </AdminLayout>
  );
};
