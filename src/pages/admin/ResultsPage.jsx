import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { Award, AlertTriangle, Eye, Check } from 'lucide-react';

export const ResultsPage = () => {
  const { adminSecretKey, isAdminLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [activeSub, setActiveSub] = useState(null);
  const [essayScoreInput, setEssayScoreInput] = useState(0);

  useEffect(() => {
    if (!isAdminLoggedIn) {
      navigate('/admin/login');
      return;
    }
    loadData();
  }, [isAdminLoggedIn, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await gasApi.getAdminDashboard(adminSecretKey);
      if (res.status === 'success') {
        setSubmissions(res.submissions || []);
        setParticipants(res.participants || []);
        setSessions(res.sessions || []);
        setQuestions(res.questions || []);
        if (res.sessions.length > 0 && !selectedSession) {
          setSelectedSession(res.sessions[0].session_id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGradeModal = (sub) => {
    setActiveSub(sub);
    setEssayScoreInput(sub.essay_score || 0);
  };

  const handleSaveGrade = async () => {
    if (!activeSub) return;
    try {
      await gasApi.gradeEssay(adminSecretKey, activeSub.submission_id, essayScoreInput);
      setActiveSub(null);
      loadData();
    } catch (err) {
      alert('Gagal menyimpan nilai essay: ' + err.message);
    }
  };

  const enrichedSubmissions = submissions.map(sub => {
    const part = participants.find(p => p.participant_id === sub.participant_id);
    const sess = sessions.find(s => s.session_id === sub.session_id);
    return {
      ...sub,
      participantName: part?.full_name || 'Peserta PAI',
      participantIdentifier: part?.identifier || '-',
      sessionTitle: sess?.title || '-'
    };
  });

  const filtered = selectedSession
    ? enrichedSubmissions.filter(s => s.session_id === selectedSession)
    : enrichedSubmissions;

  if (loading) {
    return (
      <AdminLayout title="Rekapitulasi Nilai & Penilaian Essay">
        <LoadingScreen
          message="Memuat Rekapitulasi Nilai Peserta..."
          submessage="Sedang mengambil lembar jawaban peserta dan kalkulasi skor..."
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Rekapitulasi Nilai & Penilaian Essay">
      <div className="space-y-6">
        {/* Filter Sesi */}
        <div className="flex items-center justify-between bg-white p-5 rounded-3xl border border-kemenag-100 shadow-sm">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-700">Filter Sesi Ujian:</label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="px-3.5 py-2 rounded-2xl border border-slate-200 text-sm bg-kemenag-50/50 font-medium text-slate-800"
            >
              <option value="">Semua Sesi Ujian</option>
              {sessions.map(s => (
                <option key={s.session_id} value={s.session_id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-kemenag-800 font-bold bg-kemenag-50 px-3 py-1.5 rounded-2xl border border-kemenag-200">
            Total Submisi: {filtered.length} peserta
          </span>
        </div>

        {/* Tabel Rekap Nilai */}
        <Card className="overflow-hidden bg-white rounded-3xl border border-kemenag-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-kemenag-50/70 border-b border-kemenag-100 text-kemenag-900 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Peserta</th>
                  <th className="p-4">Nomor Induk / NIP</th>
                  <th className="p-4">Skor PG</th>
                  <th className="p-4">Skor Essay</th>
                  <th className="p-4">Total Nilai</th>
                  <th className="p-4">Pelanggaran Tab</th>
                  <th className="p-4">Waktu Submit</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      Belum ada lembar jawaban yang dikumpulkan untuk sesi ini.
                    </td>
                  </tr>
                ) : (
                  filtered.map((sub) => (
                    <tr key={sub.submission_id} className="hover:bg-kemenag-50/40 transition">
                      <td className="p-4 font-bold text-slate-800">{sub.participantName}</td>
                      <td className="p-4 text-slate-500 font-mono">{sub.participantIdentifier}</td>
                      <td className="p-4 font-bold text-kemenag-700">{sub.pg_score}</td>
                      <td className="p-4 font-bold text-purple-700">{sub.essay_score || 0}</td>
                      <td className="p-4">
                        <span className="font-extrabold text-sm px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {sub.total_score}
                        </span>
                      </td>
                      <td className="p-4">
                        {Number(sub.tab_switch_count) > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-xl">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {sub.tab_switch_count}x
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium">0 (Tertib)</span>
                        )}
                      </td>
                      <td className="p-4 text-slate-400 font-medium">
                        {new Date(sub.submitted_at).toLocaleTimeString('id-ID')}
                      </td>
                      <td className="p-4 text-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Eye}
                          onClick={() => handleOpenGradeModal(sub)}
                        >
                          Review & Nilai
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

      {/* Modal Review Jawaban & Nilai Essay */}
      <Modal
        isOpen={Boolean(activeSub)}
        onClose={() => setActiveSub(null)}
        title={`Review Jawaban: ${activeSub?.participantName}`}
        maxWidth="max-w-2xl"
      >
        {activeSub && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-kemenag-50 border border-kemenag-200 flex justify-between text-xs text-kemenag-900 font-medium">
              <span>Peserta: <strong>{activeSub.participantName}</strong></span>
              <span>Skor PG Otomatis: <strong className="text-kemenag-700">{activeSub.pg_score}/100</strong></span>
            </div>

            {/* Jawaban Essay Peserta */}
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {questions
                .filter(q => q.session_id === activeSub.session_id && q.type === 'essay')
                .map((q, idx) => {
                  let parsedAnswers = {};
                  try {
                    parsedAnswers = typeof activeSub.answers_json === 'string'
                      ? JSON.parse(activeSub.answers_json)
                      : (activeSub.answers_json || {});
                  } catch(e) {}

                  const essayAnswer = parsedAnswers[q.question_id] || '(Tidak dijawab)';

                  return (
                    <div key={q.question_id} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2 text-xs">
                      <p className="font-bold text-slate-800">
                        Soal Essay #{idx + 1}: {q.question_text}
                      </p>
                      <div className="p-3 bg-slate-50 rounded-xl text-slate-700 italic border border-slate-100 whitespace-pre-line font-medium">
                        "{essayAnswer}"
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Rubrik Kunci: {q.key_answer}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Input Nilai Essay */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Beri Nilai Essay (0-100):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={essayScoreInput}
                  onChange={(e) => setEssayScoreInput(Number(e.target.value))}
                  className="w-32 px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-bold text-kemenag-700"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setActiveSub(null)}>
                  Batal
                </Button>
                <Button variant="primary" onClick={handleSaveGrade} icon={Check}>
                  Simpan Nilai
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
};
