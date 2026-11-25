import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import {
  exportDetailedResultsToExcel,
  exportSingleParticipantResultToExcel
} from '../../utils/excelTemplate';
import {
  Award,
  AlertTriangle,
  Eye,
  Check,
  RotateCw,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Filter,
  FileSpreadsheet,
  BookOpen,
  Calendar,
  Layers,
  GraduationCap
} from 'lucide-react';

export const ResultsPage = () => {
  const { adminSecretKey, isAdminLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [questions, setQuestions] = useState([]);

  // Filter State
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedKelas, setSelectedKelas] = useState('ALL');
  const [selectedPaket, setSelectedPaket] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Active Review Modal State
  const [activeSub, setActiveSub] = useState(null);
  const [essayScoreInput, setEssayScoreInput] = useState(0);
  const [savingGrade, setSavingGrade] = useState(false);
  const [reviewFilter, setReviewFilter] = useState('all'); // 'all', 'correct', 'wrong', 'essay'

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
        setSubmissions(res.submissions || []);
        setParticipants(res.participants || []);
        setSessions(res.sessions || []);
        setQuestions(res.questions || []);
        if (res.sessions?.length > 0 && !selectedSession) {
          setSelectedSession(res.sessions[0].session_id);
        }
      }
    } catch (err) {
      console.error('Gagal memuat rekap nilai:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper evaluasi butir jawaban
  const evaluateQuestion = (q, userAns) => {
    if (q.type === 'essay') {
      return { isEssay: true, isCorrect: false, userText: String(userAns || '').trim() };
    }

    const key = String(q.key_answer || '').trim().toUpperCase();
    if (!userAns) {
      return { isCorrect: false, isBlank: true, userText: '(Kosong)', key };
    }

    if (q.type === 'single_choice') {
      const u = String(userAns).trim().toUpperCase();
      const isCorrect = u === key;
      return { isCorrect, isBlank: false, userText: u, key };
    }

    if (q.type === 'multiple_choice') {
      const u = Array.isArray(userAns)
        ? userAns.map(a => String(a).trim().toUpperCase()).sort().join(',')
        : String(userAns).split(',').map(a => a.trim().toUpperCase()).sort().join(',');
      const k = key.split(',').map(a => a.trim().toUpperCase()).sort().join(',');
      const isCorrect = u === k && u.length > 0;
      return { isCorrect, isBlank: false, userText: u, key: k };
    }

    return { isCorrect: false, isBlank: false, userText: String(userAns), key };
  };

  // Buka Modal Review Hasil Jawaban
  const handleOpenReviewModal = (sub) => {
    setActiveSub(sub);
    setEssayScoreInput(sub.essay_score || 0);
    setReviewFilter('all');
  };

  // Simpan Nilai Essay
  const handleSaveGrade = async () => {
    if (!activeSub) return;
    setSavingGrade(true);
    try {
      await gasApi.gradeEssay(adminSecretKey, activeSub.submission_id, essayScoreInput);
      alert('Nilai essay berhasil disimpan!');
      setActiveSub(prev => prev ? { ...prev, essay_score: essayScoreInput, total_score: Math.round(((prev.pg_score || 0) + essayScoreInput) / 2) } : null);
      loadData(true);
    } catch (err) {
      alert('Gagal menyimpan nilai essay: ' + err.message);
    } finally {
      setSavingGrade(false);
    }
  };

  // Unduh Rekap Lengkap Seluruh Peserta
  const handleExportAll = () => {
    if (filteredSubmissions.length === 0) {
      alert('Tidak ada data submisi untuk diunduh.');
      return;
    }
    const sessionObj = sessions.find(s => s.session_id === selectedSession);
    const sessionName = (sessionObj?.title || 'Semua_Sesi').replace(/[^a-zA-Z0-9_]/g, '_');
    exportDetailedResultsToExcel(
      filteredSubmissions,
      questions,
      participants,
      sessions,
      `Rekap_Hasil_Ujian_${sessionName}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // Unduh Lembar Hasil Perorangan Peserta
  const handleExportSingle = () => {
    if (!activeSub) return;
    const part = participants.find(p => p.participant_id === activeSub.participant_id);
    const sess = sessions.find(s => s.session_id === activeSub.session_id);
    const cleanName = (part?.full_name || part?.username || 'Peserta').replace(/[^a-zA-Z0-9_]/g, '_');
    exportSingleParticipantResultToExcel(
      activeSub,
      questions,
      part,
      sess,
      `Hasil_Ujian_${cleanName}.xlsx`
    );
  };

  // Ekstrak Kelas & Paket Dinamis
  const dynamicClasses = Array.from(new Set(participants.map(p => p.kelas?.trim()).filter(Boolean)));
  const dynamicPackages = Array.from(new Set([
    ...questions.map(q => q.paket?.trim()),
    ...participants.map(p => p.paket?.trim())
  ].filter(Boolean)));

  // Gabungkan info peserta & sesi ke data submisi
  const enrichedSubmissions = submissions.map(sub => {
    const part = participants.find(p => p.participant_id === sub.participant_id);
    const sess = sessions.find(s => s.session_id === sub.session_id);

    let parsedAnswers = {};
    try {
      parsedAnswers = typeof sub.answers_json === 'string'
        ? JSON.parse(sub.answers_json)
        : (sub.answers_json || {});
    } catch (e) {}

    const sessQuestions = questions.filter(q => q.session_id === sub.session_id && q.type !== 'essay');
    let correctCount = 0;
    let wrongCount = 0;

    sessQuestions.forEach(q => {
      const evalRes = evaluateQuestion(q, parsedAnswers[q.question_id]);
      if (evalRes.isCorrect) correctCount++;
      else wrongCount++;
    });

    return {
      ...sub,
      participantName: part?.full_name || part?.username || 'Peserta PAI',
      participantUsername: part?.username || '-',
      participantIdentifier: part?.identifier || '-',
      participantKelas: part?.kelas || '-',
      participantInstitution: part?.institution || '-',
      participantPaket: part?.paket || '-',
      sessionTitle: sess?.title || '-',
      correctCount,
      wrongCount,
      parsedAnswers
    };
  });

  // Filter Submisi
  const filteredSubmissions = enrichedSubmissions.filter(s => {
    const matchSession = !selectedSession || s.session_id === selectedSession;
    const matchKelas = selectedKelas === 'ALL' || (s.participantKelas || '').toLowerCase() === selectedKelas.toLowerCase();
    const matchPaket = selectedPaket === 'ALL' || (s.participantPaket || '').toLowerCase() === selectedPaket.toLowerCase();
    const matchSearch =
      (s.participantName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.participantUsername || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.participantIdentifier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.participantInstitution || '').toLowerCase().includes(searchTerm.toLowerCase());

    return matchSession && matchKelas && matchPaket && matchSearch;
  });

  // Hitung detail pertanyaan untuk activeSub saat modal review terbuka
  const activeQuestions = activeSub
    ? questions.filter(q => q.session_id === activeSub.session_id)
    : [];

  const analyzedActiveQuestions = activeQuestions.map((q, idx) => {
    const userAns = activeSub?.parsedAnswers ? activeSub.parsedAnswers[q.question_id] : undefined;
    const evalRes = evaluateQuestion(q, userAns);

    let parsedOptions = [];
    try {
      parsedOptions = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []);
    } catch (e) {}

    return {
      ...q,
      originalIndex: idx + 1,
      userAns,
      evalRes,
      parsedOptions
    };
  });

  // Filter pertanyaan di dalam modal review
  const filteredActiveQuestions = analyzedActiveQuestions.filter(item => {
    if (reviewFilter === 'correct') return item.evalRes.isCorrect;
    if (reviewFilter === 'wrong') return !item.evalRes.isCorrect && !item.evalRes.isEssay;
    if (reviewFilter === 'essay') return item.evalRes.isEssay;
    return true;
  });

  if (loading) {
    return (
      <AdminLayout title="Rekapitulasi Nilai & Penilaian Essay">
        <LoadingScreen
          message="Memuat Rekapitulasi Nilai & Jawaban Peserta..."
          submessage="Sedang mengevaluasi lembar jawaban dan skor butir soal..."
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Rekapitulasi Nilai & Penilaian Essay">
      <div className="space-y-6">
        {/* Bar Filter & Aksi Ekspor */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-kemenag-100 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Input Pencarian */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari Nama, NIP, Username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-2xl border border-slate-200 text-xs w-48 bg-slate-50 focus:bg-white focus:outline-none focus:border-kemenag-600 font-medium"
              />
            </div>

            {/* Filter Sesi Ujian */}
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-xs bg-slate-50 font-bold text-slate-700"
            >
              <option value="">Semua Sesi Ujian</option>
              {sessions.map(s => (
                <option key={s.session_id} value={s.session_id}>
                  {s.title}
                </option>
              ))}
            </select>

            {/* Filter Kelas Dinamis */}
            <select
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-xs bg-slate-50 font-bold text-slate-700"
            >
              <option value="ALL">Semua Kelas ({dynamicClasses.length})</option>
              {dynamicClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>

            {/* Filter Paket Dinamis */}
            <select
              value={selectedPaket}
              onChange={(e) => setSelectedPaket(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-xs bg-slate-50 font-bold text-slate-700"
            >
              <option value="ALL">Semua Paket ({dynamicPackages.length})</option>
              {dynamicPackages.map(pkt => (
                <option key={pkt} value={pkt}>{pkt}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs text-kemenag-800 font-bold bg-kemenag-50 px-3 py-2 rounded-2xl border border-kemenag-200">
              Total Submisi: {filteredSubmissions.length} peserta
            </span>

            {/* Tombol Segarkan */}
            <Button
              variant="outline"
              size="sm"
              icon={RotateCw}
              onClick={() => loadData(true)}
              title="Segarkan data hasil ujian dari Google Sheets"
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Segarkan
            </Button>

            {/* Tombol Ekspor Rekap Lengkap & Analisis Jawaban (.xlsx) */}
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              onClick={handleExportAll}
              title="Unduh seluruh rekap nilai beserta status benar/salah setiap butir soal ke file Excel (.xlsx)"
              className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
            >
              Unduh Rekap Lengkap & Jawaban (.xlsx)
            </Button>
          </div>
        </div>

        {/* Tabel Rekap Nilai Peserta */}
        <Card className="overflow-hidden bg-white rounded-3xl border border-kemenag-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">No</th>
                  <th className="py-3 px-4 min-w-[180px]">Peserta & NIP</th>
                  <th className="py-3 px-4 min-w-[120px]">Kelas</th>
                  <th className="py-3 px-4 min-w-[110px]">Paket</th>
                  <th className="py-3 px-4 text-center min-w-[90px]">Skor PG</th>
                  <th className="py-3 px-4 text-center min-w-[90px]">Skor Essay</th>
                  <th className="py-3 px-4 text-center min-w-[100px]">Total Nilai</th>
                  <th className="py-3 px-4 text-center min-w-[130px]">Analisis PG (B/S)</th>
                  <th className="py-3 px-4 text-center min-w-[100px]">Pelanggaran</th>
                  <th className="py-3 px-4 min-w-[110px]">Waktu Selesai</th>
                  <th className="py-3 px-4 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-10 text-center text-slate-400">
                      Belum ada lembar jawaban yang dikumpulkan untuk kriteria yang dipilih.
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((sub, idx) => (
                    <tr key={sub.submission_id} className="hover:bg-kemenag-50/40 transition">
                      <td className="py-3.5 px-3 text-center font-bold text-slate-500 align-top">
                        {idx + 1}
                      </td>

                      {/* Peserta */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="font-bold text-slate-800 block text-xs break-words max-w-[200px] leading-snug">
                          {sub.participantName}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                          NIP: {sub.participantIdentifier}
                        </span>
                      </td>

                      {/* Kelas */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="inline-block px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 leading-snug break-words max-w-[140px]">
                          {sub.participantKelas}
                        </span>
                      </td>

                      {/* Paket */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="inline-block px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 leading-snug break-words max-w-[120px]">
                          {sub.participantPaket}
                        </span>
                      </td>

                      {/* Skor PG */}
                      <td className="py-3.5 px-4 text-center font-bold text-kemenag-700 text-sm align-top">
                        {sub.pg_score}
                      </td>

                      {/* Skor Essay */}
                      <td className="py-3.5 px-4 text-center font-bold text-purple-700 text-sm align-top">
                        {sub.essay_score || 0}
                      </td>

                      {/* Total Nilai */}
                      <td className="py-3.5 px-4 text-center align-top">
                        <span className="font-extrabold text-sm px-3 py-1 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 inline-block shadow-sm">
                          {sub.total_score}
                        </span>
                      </td>

                      {/* Analisis PG (Benar / Salah) */}
                      <td className="py-3.5 px-4 text-center align-top">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                          <span className="font-bold text-emerald-700 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            {sub.correctCount}
                          </span>
                          <span className="text-slate-300">/</span>
                          <span className="font-bold text-rose-700 flex items-center gap-0.5">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            {sub.wrongCount}
                          </span>
                        </div>
                      </td>

                      {/* Pelanggaran */}
                      <td className="py-3.5 px-4 text-center align-top">
                        {Number(sub.tab_switch_count) > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-xl text-xs">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            {sub.tab_switch_count}x
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold text-xs">0 (Tertib)</span>
                        )}
                      </td>

                      {/* Waktu Submit */}
                      <td className="py-3.5 px-4 text-slate-500 font-medium text-xs align-top">
                        {sub.submitted_at ? new Date(sub.submitted_at).toLocaleTimeString('id-ID') : '-'}
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-center align-top">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Eye}
                          onClick={() => handleOpenReviewModal(sub)}
                          className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs py-1 px-2.5"
                        >
                          Lihat Detail
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Modal Visual Hasil Jawaban dengan Nilai & Betul/Salah */}
      {activeSub && (
        <Modal
          isOpen={Boolean(activeSub)}
          onClose={() => setActiveSub(null)}
          title={`Detail Hasil Ujian: ${activeSub.participantName}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-5">
            {/* Kartu Ringkasan Nilai & Metrik Peserta */}
            <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-base">{activeSub.participantName}</h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    NIP: {activeSub.participantIdentifier} • Kelas: <strong className="text-emerald-800">{activeSub.participantKelas}</strong> • Paket: <strong className="text-amber-900">{activeSub.participantPaket}</strong> • {activeSub.participantInstitution}
                  </p>
                </div>
                {/* Tombol Ekspor Perorangan */}
                <Button
                  variant="outline"
                  size="sm"
                  icon={Download}
                  onClick={handleExportSingle}
                  className="border-emerald-400 text-emerald-800 hover:bg-emerald-50 text-xs font-bold shrink-0"
                >
                  Unduh Lembar Hasil (.xlsx)
                </Button>
              </div>

              {/* Grid 5 Metrik Nilai & Betul/Salah */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Nilai Total</span>
                  <span className="text-2xl font-black text-kemenag-800">{activeSub.total_score}</span>
                </div>
                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Skor PG</span>
                  <span className="text-2xl font-black text-emerald-700">{activeSub.pg_score}</span>
                </div>
                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Skor Essay</span>
                  <span className="text-2xl font-black text-purple-700">{activeSub.essay_score || 0}</span>
                </div>
                <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-emerald-700 block mb-0.5">Jawaban Benar</span>
                  <span className="text-2xl font-black text-emerald-800 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    {activeSub.correctCount}
                  </span>
                </div>
                <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-200 shadow-sm col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold uppercase text-rose-700 block mb-0.5">Jawaban Salah</span>
                  <span className="text-2xl font-black text-rose-800 flex items-center justify-center gap-1">
                    <XCircle className="w-5 h-5 text-rose-600" />
                    {activeSub.wrongCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Filter Pill Tab di dalam Modal */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
              <button
                onClick={() => setReviewFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  reviewFilter === 'all'
                    ? 'bg-kemenag-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua Soal ({analyzedActiveQuestions.length})
              </button>
              <button
                onClick={() => setReviewFilter('correct')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  reviewFilter === 'correct'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Benar Saja ({analyzedActiveQuestions.filter(q => q.evalRes.isCorrect).length})
              </button>
              <button
                onClick={() => setReviewFilter('wrong')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  reviewFilter === 'wrong'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                Salah Saja ({analyzedActiveQuestions.filter(q => !q.evalRes.isCorrect && !q.evalRes.isEssay).length})
              </button>
              {analyzedActiveQuestions.some(q => q.evalRes.isEssay) && (
                <button
                  onClick={() => setReviewFilter('essay')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    reviewFilter === 'essay'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  Soal Essay ({analyzedActiveQuestions.filter(q => q.evalRes.isEssay).length})
                </button>
              )}
            </div>

            {/* Daftar Visual Soal & Status Betul/Salah */}
            <div className="space-y-4 max-h-[480px] overflow-y-auto pr-2">
              {filteredActiveQuestions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Tidak ada butir soal yang cocok dengan filter yang dipilih.
                </div>
              ) : (
                filteredActiveQuestions.map((q) => {
                  const evalRes = q.evalRes;

                  return (
                    <div
                      key={q.question_id}
                      className={`p-4 rounded-3xl border transition ${
                        evalRes.isEssay
                          ? 'bg-purple-50/30 border-purple-200'
                          : evalRes.isCorrect
                          ? 'bg-emerald-50/30 border-emerald-200'
                          : 'bg-rose-50/30 border-rose-200'
                      }`}
                    >
                      {/* Baris Atas: Nomor Soal, Bobot, & Status Badge */}
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs px-2.5 py-1 rounded-xl bg-slate-800 text-white">
                            Soal #{q.originalIndex}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 uppercase">
                            {q.type === 'single_choice' ? 'Pilihan Ganda' : q.type === 'multiple_choice' ? 'Pilihan Jamak' : 'Essay'} • {q.weight || 1} Poin
                          </span>
                        </div>

                        {/* Status Betul / Salah Badge */}
                        {evalRes.isEssay ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300">
                            Dinilai Essay ({activeSub.essay_score || 0}/100)
                          </span>
                        ) : evalRes.isCorrect ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-sm">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                            BETUL (BENAR)
                          </span>
                        ) : evalRes.isBlank ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300">
                            <HelpCircle className="w-4 h-4 text-slate-500" />
                            KOSONG / TIDAK DIJAWAB
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300 shadow-sm">
                            <XCircle className="w-4 h-4 text-rose-700" />
                            SALAH
                          </span>
                        )}
                      </div>

                      {/* Teks Soal */}
                      <p className="font-semibold text-slate-800 text-xs leading-relaxed mb-3">
                        {q.question_text}
                      </p>

                      {/* Gambar Soal (jika ada) */}
                      {q.image_url && (
                        <div className="mb-3">
                          <img
                            src={q.image_url}
                            alt="Ilustrasi Soal"
                            className="max-h-48 rounded-2xl border border-slate-200 object-contain bg-white"
                          />
                        </div>
                      )}

                      {/* Tampilan Visual Opsi Pilihan Ganda */}
                      {q.type !== 'essay' && q.parsedOptions && q.parsedOptions.length > 0 && (
                        <div className="space-y-1.5 mb-3">
                          {q.parsedOptions.map((opt) => {
                            const optId = String(opt.id || '').toUpperCase();
                            const isChosen = q.type === 'single_choice'
                              ? String(evalRes.userText || '').toUpperCase() === optId
                              : String(evalRes.userText || '').toUpperCase().split(',').includes(optId);

                            const isKey = q.type === 'single_choice'
                              ? String(evalRes.key || '').toUpperCase() === optId
                              : String(evalRes.key || '').toUpperCase().split(',').includes(optId);

                            let optStyle = 'bg-white border-slate-200 text-slate-700';
                            if (isChosen && isKey) {
                              optStyle = 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold';
                            } else if (isChosen && !isKey) {
                              optStyle = 'bg-rose-100 border-rose-400 text-rose-950 font-bold';
                            } else if (isKey) {
                              optStyle = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold';
                            }

                            return (
                              <div
                                key={opt.id}
                                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${optStyle}`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                    isChosen ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {opt.id}
                                  </span>
                                  <span>{opt.text}</span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isChosen && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                      isKey ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                                    }`}>
                                      Pilihan Peserta
                                    </span>
                                  )}
                                  {isKey && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-600 text-white flex items-center gap-1">
                                      <Check className="w-3 h-3" /> Kunci
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Ringkasan Perbandingan Jawaban Peserta vs Kunci */}
                      {q.type !== 'essay' && (
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium">Jawaban Peserta:</span>
                            <span className={`font-mono font-bold px-2 py-0.5 rounded-lg ${
                              evalRes.isCorrect
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : evalRes.isBlank
                                ? 'bg-slate-100 text-slate-500 border border-slate-300'
                                : 'bg-rose-100 text-rose-900 border border-rose-300'
                            }`}>
                              {evalRes.userText || '(Kosong)'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium">Kunci Jawaban:</span>
                            <span className="font-mono font-bold px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300">
                              {evalRes.key}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Detail Soal Essay: Jawaban Peserta, Rubrik, & Penilaian */}
                      {evalRes.isEssay && (
                        <div className="space-y-3 pt-2">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">
                              Jawaban Essay Peserta:
                            </label>
                            <div className="p-3 bg-white rounded-2xl border border-purple-200 text-slate-800 text-xs whitespace-pre-line font-medium shadow-sm">
                              {evalRes.userText ? `"${evalRes.userText}"` : <span className="text-slate-400 italic">(Peserta tidak mengisi jawaban)</span>}
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-900">
                            <strong className="block text-[11px] uppercase tracking-wider mb-0.5">Rubrik Penilaian:</strong>
                            <p className="text-slate-700">{q.key_answer || 'Tidak ada rubrik khusus.'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Nilai Essay & Footer Modal */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Beri / Perbarui Nilai Essay (0-100):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={essayScoreInput}
                    onChange={(e) => setEssayScoreInput(Number(e.target.value))}
                    className="w-32 px-3 py-1.5 rounded-xl border border-slate-300 text-sm font-bold text-purple-800 focus:outline-none focus:border-purple-600"
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveGrade}
                  disabled={savingGrade}
                  icon={Check}
                  className="mt-4"
                >
                  {savingGrade ? 'Menyimpan...' : 'Simpan Nilai'}
                </Button>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => setActiveSub(null)}
                >
                  Tutup
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
};
