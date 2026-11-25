import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { ExamSubNav } from '../../components/layout/ExamSubNav';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { downloadExcelTemplate, parseUploadedQuestionsFile, exportQuestionsToExcel } from '../../utils/excelTemplate';
import { Plus, Trash2, Upload, FileSpreadsheet, Download, Check, AlertCircle, Layers, CheckCircle2, Loader2, Database, Sparkles, AlertTriangle, RotateCw } from 'lucide-react';

export const QuestionBankPage = () => {
  const { adminSecretKey, isAdminLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaket, setSelectedPaket] = useState('SEMUA');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showApiConfigModal, setShowApiConfigModal] = useState(false);
  const [apiUrlInput, setApiUrlInput] = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);
  const [importing, setImporting] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importError, setImportError] = useState('');
  const [importProgress, setImportProgress] = useState({
    active: false,
    current: 0,
    total: 0,
    percentage: 0,
    currentQuestion: null,
    logs: [],
    isCompleted: false,
    successCount: 0,
    failCount: 0
  });

  // State Hapus Soal per Paket
  const [showDeletePaketModal, setShowDeletePaketModal] = useState(false);
  const [targetDeletePaket, setTargetDeletePaket] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingPaket, setDeletingPaket] = useState(false);

  const logContainerRef = useRef(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [importProgress.logs, importProgress.current]);

  const [form, setForm] = useState({
    paket: '',
    type: 'single_choice',
    question_text: '',
    image_url: '',
    weight: 1,
    key_answer: 'A',
    options: [
      { id: 'A', text: '', image: '' },
      { id: 'B', text: '', image: '' },
      { id: 'C', text: '', image: '' },
      { id: 'D', text: '', image: '' },
      { id: 'E', text: '', image: '' }
    ]
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
        setQuestions(res.questions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const res = await gasApi.uploadMedia(adminSecretKey, file);
      if (res.status === 'success') {
        setForm(prev => ({ ...prev, image_url: res.url }));
      } else {
        alert('Gagal upload gambar: ' + res.message);
      }
    } catch (err) {
      alert('Error saat upload: ' + err.message);
    } finally {
      setUploadingImg(false);
    }
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    setSavingManual(true);
    try {
      await gasApi.saveQuestion(adminSecretKey, {
        ...form,
        session_id: form.session_id || 'SES-001'
      });
      setShowModal(false);
      setForm({
        paket: selectedPaket !== 'SEMUA' ? selectedPaket : 'Pretest',
        type: 'single_choice',
        question_text: '',
        image_url: '',
        weight: 1,
        key_answer: 'A',
        options: [
          { id: 'A', text: '', image: '' },
          { id: 'B', text: '', image: '' },
          { id: 'C', text: '', image: '' },
          { id: 'D', text: '', image: '' },
          { id: 'E', text: '', image: '' }
        ]
      });
      await loadData();
    } catch (err) {
      alert('Gagal menyimpan soal: ' + err.message);
    } finally {
      setSavingManual(false);
    }
  };

  // Handler Pilih File Excel untuk Import
  const handleSelectExcelFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportError('');
    setImportProgress({
      active: false,
      current: 0,
      total: 0,
      percentage: 0,
      currentQuestion: null,
      logs: [],
      isCompleted: false,
      successCount: 0,
      failCount: 0
    });
    try {
      const parsed = await parseUploadedQuestionsFile(file);
      setImportPreview(parsed);
    } catch (err) {
      setImportError(err.message || 'Gagal membaca format file.');
      setImportPreview([]);
    }
  };

  // Eksekusi Simpan Soal Hasil Import dengan Akselerasi Cepat (Bulk Batch Array 2D Matrix)
  const handleExecuteImport = async () => {
    if (importPreview.length === 0) return;
    setImporting(true);
    const totalItems = importPreview.length;

    setImportProgress({
      active: true,
      current: 1,
      total: totalItems,
      percentage: 25,
      currentQuestion: importPreview[0],
      logs: [
        {
          index: 1,
          paket: 'Sistem',
          text: `Memvalidasi & Mengemas ${totalItems} butir soal ke paket Batch 2D Matrix...`,
          status: 'saving'
        }
      ],
      isCompleted: false,
      successCount: 0,
      failCount: 0
    });

    try {
      const preparedQuestions = importPreview.map((q, idx) => ({
        ...q,
        session_id: q.session_id || 'SES-001',
        paket: q.paket || 'Pretest'
      }));

      setImportProgress(prev => ({
        ...prev,
        percentage: 60,
        logs: [
          ...prev.logs,
          {
            index: 2,
            paket: 'Cloud GAS',
            text: `Mengirim ${totalItems} butir soal ke Google Sheets dalam 1 kali eksekusi cepat...`,
            status: 'saving'
          }
        ]
      }));

      // Eksekusi Bulk Batch (1 Panggilan Jaringan & 1 Tulis Spreadsheet)
      const res = await gasApi.batchSaveQuestions(adminSecretKey, preparedQuestions, 'SES-001');

      // Tampilkan log sukses butir soal
      const successLogs = preparedQuestions.map((q, idx) => ({
        index: idx + 1,
        paket: q.paket || 'Pretest',
        text: q.question_text,
        status: 'success'
      }));

      setImportProgress({
        active: true,
        current: totalItems,
        total: totalItems,
        percentage: 100,
        currentQuestion: preparedQuestions[totalItems - 1],
        logs: successLogs,
        isCompleted: true,
        successCount: totalItems,
        failCount: 0
      });

      await loadData();
    } catch (err) {
      setImportProgress(prev => ({
        ...prev,
        isCompleted: true,
        failCount: totalItems,
        logs: [
          ...prev.logs,
          {
            index: 999,
            paket: 'Error',
            text: 'Gagal import: ' + err.message,
            status: 'error',
            error: err.message
          }
        ]
      }));
      alert('Gagal mengimpor batch soal: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleCloseImportModal = () => {
    if (importing) {
      if (!window.confirm('Proses pengiriman soal ke database sedang berjalan. Tetap ingin menutup?')) {
        return;
      }
    }
    setShowImportModal(false);
    setImportPreview([]);
    setImportError('');
    setImportProgress({
      active: false,
      current: 0,
      total: 0,
      percentage: 0,
      currentQuestion: null,
      logs: [],
      isCompleted: false,
      successCount: 0,
      failCount: 0
    });
  };

  const handleDelete = async (qId) => {
    if (!window.confirm('Yakin ingin menghapus butir soal ini?')) return;
    try {
      await gasApi.deleteQuestion(adminSecretKey, qId);
      loadData();
    } catch (err) {
      alert('Gagal menghapus soal: ' + err.message);
    }
  };

  // Buka Modal Hapus Paket Soal
  const handleOpenDeletePaket = (pkt) => {
    const defaultPkt = pkt || (selectedPaket !== 'SEMUA' ? selectedPaket : (allPackages[0] || ''));
    setTargetDeletePaket(defaultPkt);
    setDeleteConfirmText('');
    setShowDeletePaketModal(true);
  };

  // Unduh Backup Excel (.xlsx) Soal Paket Tertentu Sebelum Dihapus
  const handleDownloadBackupPaket = () => {
    if (!targetDeletePaket) return;
    const pktQuestions = questions.filter(
      q => (q.paket || 'Pretest').trim().toLowerCase() === targetDeletePaket.trim().toLowerCase()
    );
    if (pktQuestions.length === 0) {
      alert(`Tidak ada soal pada paket "${targetDeletePaket}" untuk diunduh.`);
      return;
    }
    exportQuestionsToExcel(
      pktQuestions,
      `Backup_Soal_${targetDeletePaket}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // Eksekusi Hapus Seluruh Butir Soal dalam Paket
  const handleExecuteDeletePaket = async () => {
    if (!targetDeletePaket) return;
    const isConfirmed = deleteConfirmText.trim().toUpperCase() === 'HAPUS' ||
      deleteConfirmText.trim().toLowerCase() === targetDeletePaket.trim().toLowerCase();

    if (!isConfirmed) {
      alert(`Harap ketik "HAPUS" atau nama paket "${targetDeletePaket}" untuk mengonfirmasi.`);
      return;
    }

    setDeletingPaket(true);
    try {
      const res = await gasApi.deleteQuestionsByPaket(adminSecretKey, targetDeletePaket);
      alert(res.message || `Berhasil menghapus seluruh soal pada paket "${targetDeletePaket}".`);
      setShowDeletePaketModal(false);
      if (selectedPaket.toLowerCase() === targetDeletePaket.toLowerCase()) {
        setSelectedPaket('SEMUA');
      }
      await loadData();
    } catch (err) {
      alert('Gagal menghapus soal per paket: ' + err.message);
    } finally {
      setDeletingPaket(false);
    }
  };

  // Paket yang tersedia murni dibaca dari data soal yang diinput/diimpor
  const allPackages = Array.from(
    new Set(questions.map(q => q.paket?.trim()).filter(Boolean))
  );

  // Filter soal berdasarkan paket yang sedang aktif
  const filteredQuestions = selectedPaket === 'SEMUA'
    ? questions
    : questions.filter(q => (q.paket || '').toLowerCase() === selectedPaket.toLowerCase());

  if (loading) {
    return (
      <AdminLayout title="Manajemen Bank Soal & Template Excel">
        <LoadingScreen
          message="Memuat Bank Soal..."
          submessage="Sedang mengambil data butir soal, opsi pilihan ganda, dan kunci jawaban..."
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Data Bank Soal & Paket (Sub Menu 3)">
      <div className="space-y-6">
        {/* Navigasi Sub Menu 3-Laman */}
        <ExamSubNav active={3} />

        {/* Banner Status Koneksi Google Apps Script */}
        {!gasApi.isConfigured() ? (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-900">Aplikasi Berjalan dalam Mode Mock Lokal</h4>
                <p className="text-xs text-amber-800">
                  Google Apps Script Web App URL belum terhubung. Soal yang diinput tersimpan di browser lokal, belum masuk ke Google Sheets.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              className="shrink-0 text-xs bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                setApiUrlInput(gasApi.getGasApiUrl());
                setShowApiConfigModal(true);
              }}
            >
              Hubungkan Google Sheets
            </Button>
          </div>
        ) : (
          <div className="px-4 py-2 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-semibold">Koneksi Database:</span>
              <span className="text-emerald-950 font-medium">Terhubung ke Google Apps Script Web App</span>
            </div>
            <button
              onClick={() => {
                setApiUrlInput(gasApi.getGasApiUrl());
                setShowApiConfigModal(true);
              }}
              className="text-emerald-700 font-bold hover:underline shrink-0 text-xs"
            >
              Pengaturan URL GAS
            </button>
          </div>
        )}

        {/* Bar Tombol Paket Ujian & Aksi Import */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-kemenag-100 shadow-sm">
          {/* Tombol Tab Paket (Pretest, Postest, Dll) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-kemenag-600" />
              Paket Soal:
            </span>

            {/* Tombol Semua */}
            <button
              onClick={() => setSelectedPaket('SEMUA')}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${
                selectedPaket === 'SEMUA'
                  ? 'bg-kemenag-600 text-white shadow-sm shadow-kemenag-300'
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-kemenag-50 hover:text-kemenag-800'
              }`}
            >
              <span>Semua Paket</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                selectedPaket === 'SEMUA' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {questions.length}
              </span>
            </button>

            {/* Tombol Tiap Paket (Pretest, Postest, dll) */}
            {allPackages.map(pkt => {
              const count = questions.filter(q => (q.paket || 'Pretest').toLowerCase() === pkt.toLowerCase()).length;
              const isActive = selectedPaket.toLowerCase() === pkt.toLowerCase();
              return (
                <button
                  key={pkt}
                  onClick={() => setSelectedPaket(pkt)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${
                    isActive
                      ? 'bg-kemenag-600 text-white shadow-sm shadow-kemenag-300'
                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-kemenag-50 hover:text-kemenag-800'
                  }`}
                >
                  <span>{pkt}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tombol Aksi Excel & Tambah Soal */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Tombol Segarkan */}
            <Button
              variant="outline"
              size="sm"
              icon={RotateCw}
              onClick={() => loadData(true)}
              title="Segarkan data soal dari Google Sheets"
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Segarkan
            </Button>

            {/* Tombol Download Template Excel */}
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              onClick={downloadExcelTemplate}
              title="Unduh file template Excel (.xlsx)"
              className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
            >
              Download Template Excel (.xlsx)
            </Button>

            {/* Tombol Import Excel */}
            <Button
              variant="outline"
              size="sm"
              icon={FileSpreadsheet}
              onClick={() => {
                setImportPreview([]);
                setImportError('');
                setShowImportModal(true);
              }}
              className="border-kemenag-300 text-kemenag-800 hover:bg-kemenag-50"
            >
              Import dari Excel (.xlsx)
            </Button>

            {/* Tombol Hapus per Paket */}
            {allPackages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                icon={Trash2}
                onClick={() => handleOpenDeletePaket(selectedPaket !== 'SEMUA' ? selectedPaket : '')}
                title="Hapus seluruh butir soal dalam satu paket"
                className="border-rose-300 text-rose-700 hover:bg-rose-50"
              >
                Hapus Soal per Paket
              </Button>
            )}

            {/* Tombol Tambah Soal Manual */}
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => {
                setForm(prev => ({
                  ...prev,
                  paket: selectedPaket !== 'SEMUA' ? selectedPaket : 'Pretest'
                }));
                setShowModal(true);
              }}
            >
              Tambah Soal
            </Button>
          </div>
        </div>

        {/* List Soal Sesuai Paket yang Diklik */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Menampilkan {filteredQuestions.length} Soal untuk Paket: <span className="text-kemenag-700 font-extrabold">{selectedPaket}</span>
            </h4>
            {selectedPaket !== 'SEMUA' && filteredQuestions.length > 0 && (
              <button
                onClick={() => handleOpenDeletePaket(selectedPaket)}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Seluruh Soal Paket {selectedPaket} ({filteredQuestions.length} Soal)
              </button>
            )}
          </div>

          {filteredQuestions.length === 0 ? (
            <Card className="p-10 text-center text-slate-500 text-sm bg-white rounded-3xl border border-kemenag-100">
              Belum ada soal untuk paket <strong>{selectedPaket}</strong>. Anda dapat mengklik <strong>Download Template Excel (.xlsx)</strong> lalu mengisi kolom <code>Paket</code> dengan <strong>{selectedPaket}</strong> dan mengunggahnya via <strong>Import dari Excel</strong>.
            </Card>
          ) : (
            filteredQuestions.map((q, idx) => (
              <Card key={q.question_id || idx} className="p-6 space-y-3 bg-white rounded-3xl border border-kemenag-100 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-8 h-8 rounded-xl bg-kemenag-600 text-white font-extrabold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    {/* Badge Paket */}
                    <span className={`text-xs font-bold px-3 py-1 rounded-xl uppercase tracking-wider border ${
                      (q.paket || 'Pretest').toLowerCase().includes('post')
                        ? 'bg-purple-100 text-purple-900 border-purple-200'
                        : 'bg-amber-100 text-amber-900 border-amber-200'
                    }`}>
                      Paket: {q.paket || 'Pretest'}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-kemenag-50 text-kemenag-700 border border-kemenag-200 uppercase">
                      {q.type}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Bobot: {q.weight} poin
                    </span>
                  </div>

                  <button
                    onClick={() => handleDelete(q.question_id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-sm text-slate-800 font-medium whitespace-pre-line leading-relaxed">
                  {q.question_text}
                </p>

                {q.image_url && (
                  <img src={q.image_url} alt="Media" className="max-h-44 rounded-2xl border object-contain" />
                )}

                {/* Info Opsi & Kunci Jawaban */}
                {q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                    {q.options.map(opt => (
                      <div key={opt.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                        <span className="font-bold text-slate-700 w-5 h-5 rounded-lg bg-white flex items-center justify-center border text-[11px]">
                          {opt.id}
                        </span>
                        <span className="text-slate-800">{opt.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 text-xs text-slate-600">
                  <strong>Kunci Jawaban:</strong>{' '}
                  <span className="font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                    {q.key_answer}
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Modal Import Soal dari Excel (.xlsx) */}
      <Modal
        isOpen={showImportModal}
        onClose={handleCloseImportModal}
        title={importProgress.active ? "Progres Penyimpanan Soal ke Database" : "Import Bank Soal dari File Excel (.xlsx)"}
        maxWidth="max-w-2xl"
      >
        {importProgress.active ? (
          /* TAMPILAN PROGRES BERTAHAP MASUK KE SISTEM & DATABASE */
          <div className="space-y-4">
            {/* Banner Status */}
            <div className={`p-4 rounded-2xl border transition-all ${
              importProgress.isCompleted
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-emerald-50/70 border-emerald-200/80'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                    importProgress.isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-kemenag-600 text-white shadow-kemenag-200'
                  }`}>
                    {importProgress.isCompleted ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      {importProgress.isCompleted
                        ? 'Seluruh Soal Berhasil Masuk ke Database!'
                        : 'Sedang Menyimpan Soal ke Database Google Sheets'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {importProgress.isCompleted
                        ? `${importProgress.successCount} soal sukses tersimpan di Google Sheets.${importProgress.failCount > 0 ? ` (${importProgress.failCount} butir gagal)` : ''}`
                        : `Memproses butir ${importProgress.current} dari ${importProgress.total} soal...`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-black ${importProgress.isCompleted ? 'text-emerald-700' : 'text-kemenag-700'}`}>
                    {importProgress.percentage}%
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Bar Dinamis */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Database className={`w-3.5 h-3.5 ${importProgress.isCompleted ? 'text-emerald-600' : 'text-kemenag-600 animate-pulse'}`} />
                  Progress Sinkronisasi Database
                </span>
                <span className="font-bold text-slate-700">
                  {importProgress.logs.filter(l => l.status === 'success').length} / {importProgress.total} Tersimpan
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-200 shadow-inner">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-teal-500 to-kemenag-600 h-full rounded-full transition-all duration-300 ease-out shadow-sm"
                  style={{ width: `${importProgress.percentage}%` }}
                />
              </div>
            </div>

            {/* Soal yang sedang aktif dikirim (Live Preview) */}
            {!importProgress.isCompleted && importProgress.currentQuestion && (
              <div className="p-3 bg-amber-50/70 border border-amber-200/90 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                    Sedang menulis baris ke database Google Sheets:
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-amber-200/90 text-amber-900 font-bold text-[10px] uppercase">
                    {importProgress.currentQuestion.paket || 'Pretest'}
                  </span>
                </div>
                <p className="text-xs text-slate-800 line-clamp-1 italic font-medium">
                  "#{importProgress.current}: {importProgress.currentQuestion.question_text}"
                </p>
              </div>
            )}

            {/* Log / Checklist Bertahap Real-Time */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Status Riwayat Masuk Database:
                </span>
                <span className="text-[11px] text-slate-400 font-normal">Auto-scroll live update</span>
              </div>
              <div
                ref={logContainerRef}
                className="max-h-60 overflow-y-auto border border-slate-200 rounded-2xl p-2 bg-slate-50/70 space-y-1.5 shadow-inner"
              >
                {importProgress.logs.map((log) => (
                  <div
                    key={log.index}
                    className={`p-2.5 rounded-xl transition-all flex items-start justify-between gap-3 ${
                      log.status === 'saving'
                        ? 'bg-amber-50 border border-amber-300 shadow-sm'
                        : log.status === 'success'
                        ? 'bg-white border border-emerald-200 shadow-sm'
                        : 'bg-rose-50 border border-rose-200'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 font-bold text-slate-700 text-xs flex items-center justify-center shrink-0">
                        {log.index}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                            {log.paket}
                          </span>
                          <span className="text-slate-800 text-xs font-medium truncate max-w-[340px]">
                            {log.text}
                          </span>
                        </div>
                        {log.error && (
                          <p className="text-[11px] text-rose-600 mt-0.5 font-medium">{log.error}</p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center">
                      {log.status === 'saving' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-[11px] font-bold animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin text-amber-700" />
                          Menyimpan...
                        </span>
                      )}
                      {log.status === 'success' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Masuk DB
                        </span>
                      )}
                      {log.status === 'error' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-[11px] font-bold">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          Gagal
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="pt-2 border-t border-slate-100">
              {importProgress.isCompleted ? (
                <Button
                  variant="primary"
                  className="w-full py-2.5 text-sm font-bold"
                  onClick={handleCloseImportModal}
                  icon={Check}
                >
                  Selesai & Muat Ulang Bank Soal
                </Button>
              ) : (
                <div className="p-3 bg-slate-100 rounded-xl text-center text-xs text-slate-500 font-semibold flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-kemenag-600" />
                  <span>Sedang memproses penyimpanan ke database cloud. Mohon jangan menutup halaman ini...</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* FORM PILIH FILE & PREVIEW SEBELUM IMPOR */
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-1.5">
              <h5 className="font-bold flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                Petunjuk Format Kolom Excel (.xlsx):
              </h5>
              <p>
                Kolom template: <code>No, Paket, Jenis_Soal, Teks_Soal, Gambar_URL, Opsi_A, Opsi_B, Opsi_C, Opsi_D, Opsi_E, Kunci_Jawaban, Bobot</code>.
              </p>
              <p className="text-emerald-800">
                Isi kolom <strong>Paket</strong> dengan <strong>Pretest</strong> atau <strong>Postest</strong>. Soal akan otomatis terkelompokkan ke dalam paket masing-masing saat diimpor!
              </p>
              <button
                onClick={downloadExcelTemplate}
                className="text-emerald-700 font-bold underline hover:text-emerald-900 inline-block pt-1"
              >
                Unduh Template Bank Soal Di Sini (.xlsx)
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Pilih File Excel (.xlsx / .xls) dari Komputer:
              </label>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleSelectExcelFile}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-kemenag-50 file:text-kemenag-700 hover:file:bg-kemenag-100 cursor-pointer"
              />
            </div>

            {importError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {/* Pratinjau Soal yang Terdeteksi */}
            {importPreview.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Pratinjau Soal ({importPreview.length} butir terdeteksi):</span>
                  <span className="text-emerald-600 font-medium">Siap Diimpor</span>
                </div>
                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-2xl divide-y text-xs p-2 bg-slate-50">
                  {importPreview.map((item, idx) => (
                    <div key={idx} className="p-2 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800">#{idx + 1}</span>
                        <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-bold text-[10px] uppercase">
                          {item.paket || 'Pretest'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 uppercase font-semibold text-[10px]">
                          {item.type}
                        </span>
                        <span className="text-emerald-700 font-mono font-bold">Kunci: {item.key_answer}</span>
                      </div>
                      <p className="text-slate-700 truncate">{item.question_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" className="flex-1" onClick={handleCloseImportModal}>
                Batal
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                disabled={importPreview.length === 0 || importing}
                onClick={handleExecuteImport}
                icon={Check}
              >
                {importing ? 'Mengimpor...' : `Mulai Simpan ${importPreview.length} Soal`}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Tambah Soal Manual */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Buat Soal Ujian"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveQuestion} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Paket / Tugas</label>
              <input
                type="text"
                list="dynamic-pkts-bank"
                value={form.paket}
                onChange={(e) => setForm({ ...form, paket: e.target.value })}
                placeholder="Ketik/Pilih Paket..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-kemenag-800"
                required
              />
              <datalist id="dynamic-pkts-bank">
                {allPackages.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe Soal</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              >
                <option value="single_choice">Pilihan Ganda Tunggal</option>
                <option value="multiple_choice">Pilihan Ganda Jamak</option>
                <option value="essay">Uraian / Essay</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bobot Nilai</label>
              <input
                type="number"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Teks Pertanyaan</label>
            <textarea
              rows={3}
              value={form.question_text}
              onChange={(e) => setForm({ ...form, question_text: e.target.value })}
              placeholder="Tuliskan butir soal..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              required
            />
          </div>

          {/* Upload Gambar ke Google Drive */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Gambar Soal (Google Drive Upload)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-kemenag-50 file:text-kemenag-700 hover:file:bg-kemenag-100"
              />
              {uploadingImg && <span className="text-xs text-kemenag-600 font-medium animate-pulse">Mengupload ke Drive...</span>}
            </div>
            {form.image_url && (
              <img src={form.image_url} alt="Preview" className="max-h-24 mt-2 rounded-xl border object-contain" />
            )}
          </div>

          {/* Opsi Jawaban (Jika Pilihan Ganda) */}
          {form.type !== 'essay' && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700">Pilihan Jawaban (A-E)</label>
              {form.options.map((opt, i) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-kemenag-50 text-kemenag-800 font-bold text-xs flex items-center justify-center shrink-0">
                    {opt.id}
                  </span>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => {
                      const updated = [...form.options];
                      updated[i].text = e.target.value;
                      setForm({ ...form, options: updated });
                    }}
                    placeholder={`Teks Opsi ${opt.id}`}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                    required
                  />
                </div>
              ))}
            </div>
          )}

          {/* Kunci Jawaban */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kunci Jawaban {form.type === 'multiple_choice' ? '(Pisahkan koma, misal: A,B)' : ''}
            </label>
            <input
              type="text"
              value={form.key_answer}
              onChange={(e) => setForm({ ...form, key_answer: e.target.value.toUpperCase() })}
              placeholder={form.type === 'essay' ? 'Rubrik jawaban' : 'Contoh: A'}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold uppercase font-mono"
              required
            />
          </div>

          {savingManual && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-700 shrink-0" />
              <span>Sedang memproses dan menyimpan butir soal ke database Google Sheets...</span>
            </div>
          )}

          <div className="flex gap-2 pt-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)} disabled={savingManual}>
              Batal
            </Button>
            <Button variant="primary" type="submit" className="flex-1" disabled={savingManual}>
              {savingManual ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan ke Database...
                </span>
              ) : (
                'Simpan Soal'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Konfirmasi Hapus Soal per Paket */}
      {showDeletePaketModal && (
        <Modal
          isOpen={showDeletePaketModal}
          onClose={() => {
            if (!deletingPaket) {
              setShowDeletePaketModal(false);
              setDeleteConfirmText('');
            }
          }}
          title="Hapus Seluruh Soal per Paket"
          maxWidth="max-w-lg"
        >
          {(() => {
            const targetQuestions = questions.filter(
              q => (q.paket || 'Pretest').trim().toLowerCase() === (targetDeletePaket || '').trim().toLowerCase()
            );
            const pgCount = targetQuestions.filter(q => q.type === 'single_choice' || q.type === 'multiple_choice').length;
            const essayCount = targetQuestions.filter(q => q.type === 'essay').length;
            const totalWeight = targetQuestions.reduce((acc, curr) => acc + (Number(curr.weight) || 1), 0);
            const isMatch = deleteConfirmText.trim().toUpperCase() === 'HAPUS' ||
              (targetDeletePaket && deleteConfirmText.trim().toLowerCase() === targetDeletePaket.trim().toLowerCase());

            return (
              <div className="space-y-4">
                {/* Pilih Paket yang ingin dihapus */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Pilih Paket Soal yang Akan Dihapus:
                  </label>
                  <select
                    value={targetDeletePaket}
                    onChange={(e) => {
                      setTargetDeletePaket(e.target.value);
                      setDeleteConfirmText('');
                    }}
                    disabled={deletingPaket}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    {allPackages.map(p => {
                      const c = questions.filter(q => (q.paket || 'Pretest').trim().toLowerCase() === p.toLowerCase()).length;
                      return (
                        <option key={p} value={p}>
                          Paket: {p} ({c} Butir Soal)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Ringkasan Paket */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Nama Paket Terpilih:</span>
                    <strong className="text-rose-700 font-extrabold px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200">
                      {targetDeletePaket || '-'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Total Butir Soal:</span>
                    <strong className="text-slate-800 font-mono text-sm">{targetQuestions.length} Soal</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Komposisi:</span>
                    <span className="text-slate-700 font-medium">{pgCount} Pilihan Ganda • {essayCount} Uraian/Esai</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Total Akumulasi Bobot:</span>
                    <span className="text-slate-700 font-mono">{totalWeight} Poin</span>
                  </div>
                </div>

                {/* Tombol Pengaman: Unduh Cadangan Excel Sebelum Hapus */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <h5 className="font-bold text-emerald-900">Ingin Mengamankan Soal?</h5>
                    <p className="text-[11px] text-emerald-700">Unduh cadangan Excel sebelum data dihapus permanen.</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Download}
                    onClick={handleDownloadBackupPaket}
                    disabled={deletingPaket || targetQuestions.length === 0}
                    className="shrink-0 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                  >
                    Unduh Excel (.xlsx)
                  </Button>
                </div>

                {/* Peringatan Bahaya */}
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-rose-900 space-y-1">
                    <p className="font-bold">Peringatan Penghapusan Permanen!</p>
                    <p className="text-[11px] leading-relaxed text-rose-800">
                      Seluruh <strong>{targetQuestions.length} butir soal</strong> dalam paket <strong>"{targetDeletePaket}"</strong> akan dihapus dari Google Sheets dan tidak dapat dikembalikan kecuali diimpor ulang dari file Excel.
                    </p>
                  </div>
                </div>

                {/* Input Konfirmasi Pengaman */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ketik <span className="text-rose-600 font-mono font-black">HAPUS</span> atau <span className="text-rose-600 font-mono font-black">{targetDeletePaket}</span> untuk konfirmasi:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    disabled={deletingPaket}
                    placeholder={`Ketik HAPUS atau ${targetDeletePaket}`}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                {/* Tombol Aksi */}
                <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setShowDeletePaketModal(false);
                      setDeleteConfirmText('');
                    }}
                    disabled={deletingPaket}
                  >
                    Batal
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    disabled={!isMatch || deletingPaket || targetQuestions.length === 0}
                    onClick={handleExecuteDeletePaket}
                  >
                    {deletingPaket ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Menghapus Soal...
                      </span>
                    ) : (
                      `Ya, Hapus ${targetQuestions.length} Soal`
                    )}
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* Modal Pengaturan URL Google Apps Script */}
      <Modal
        isOpen={showApiConfigModal}
        onClose={() => setShowApiConfigModal(false)}
        title="Pengaturan Koneksi Google Apps Script"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Tempelkan URL Web App dari deployment Google Apps Script Anda (berakhiran <code>/exec</code>) agar Bank Soal dan Data Ujian langsung tersinkronisasi ke Google Sheets secara real-time.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Google Apps Script Web App URL:
            </label>
            <input
              type="url"
              value={apiUrlInput}
              onChange={(e) => setApiUrlInput(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" className="flex-1" onClick={() => setShowApiConfigModal(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                gasApi.setGasApiUrl(apiUrlInput.trim());
                setShowApiConfigModal(false);
                loadData();
              }}
            >
              Simpan & Hubungkan
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
};
