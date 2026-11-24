import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { downloadExcelTemplate, parseUploadedQuestionsFile } from '../../utils/excelTemplate';
import { Plus, Trash2, Upload, FileSpreadsheet, Download, Check, AlertCircle } from 'lucide-react';

export const QuestionBankPage = () => {
  const { adminSecretKey, isAdminLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importError, setImportError] = useState('');

  const [form, setForm] = useState({
    session_id: '',
    type: 'single_choice',
    question_text: '',
    image_url: '',
    weight: 1,
    key_answer: 'A',
    options: [
      { id: 'A', text: '', image: '' },
      { id: 'B', text: '', image: '' },
      { id: 'C', text: '', image: '' },
      { id: 'D', text: '', image: '' }
    ]
  });

  useEffect(() => {
    if (!isAdminLoggedIn) {
      navigate('/admin/login');
      return;
    }
    loadData();
  }, [isAdminLoggedIn, navigate]);

  const loadData = async () => {
    try {
      const res = await gasApi.getAdminDashboard(adminSecretKey);
      if (res.status === 'success') {
        setQuestions(res.questions || []);
        setSessions(res.sessions || []);
        if (res.sessions.length > 0 && !selectedSession) {
          setSelectedSession(res.sessions[0].session_id);
          setForm(prev => ({ ...prev, session_id: res.sessions[0].session_id }));
        }
      }
    } catch (err) {
      console.error(err);
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
    try {
      await gasApi.saveQuestion(adminSecretKey, form);
      setShowModal(false);
      setForm({
        session_id: selectedSession,
        type: 'single_choice',
        question_text: '',
        image_url: '',
        weight: 1,
        key_answer: 'A',
        options: [
          { id: 'A', text: '', image: '' },
          { id: 'B', text: '', image: '' },
          { id: 'C', text: '', image: '' },
          { id: 'D', text: '', image: '' }
        ]
      });
      loadData();
    } catch (err) {
      alert('Gagal menyimpan soal: ' + err.message);
    }
  };

  // Handler Pilih File Excel / CSV untuk Import
  const handleSelectExcelFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportError('');
    try {
      const parsed = await parseUploadedQuestionsFile(file);
      setImportPreview(parsed);
    } catch (err) {
      setImportError(err.message || 'Gagal membaca format file.');
      setImportPreview([]);
    }
  };

  // Eksekusi Batch Save Soal Hasil Import
  const handleExecuteImport = async () => {
    if (importPreview.length === 0 || !selectedSession) return;
    setImporting(true);
    try {
      for (const q of importPreview) {
        await gasApi.saveQuestion(adminSecretKey, {
          ...q,
          session_id: selectedSession
        });
      }
      setShowImportModal(false);
      setImportPreview([]);
      alert(`Berhasil mengimpor ${importPreview.length} butir soal ke sesi ini!`);
      loadData();
    } catch (err) {
      alert('Gagal mengimpor soal: ' + err.message);
    } finally {
      setImporting(false);
    }
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

  const filteredQuestions = selectedSession
    ? questions.filter(q => q.session_id === selectedSession)
    : questions;

  return (
    <AdminLayout title="Manajemen Bank Soal & Template Excel">
      <div className="space-y-6">
        {/* Bar Filter Sesi & Tombol Aksi */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-kemenag-100 shadow-sm">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-700">Pilih Sesi Ujian:</label>
            <select
              value={selectedSession}
              onChange={(e) => {
                setSelectedSession(e.target.value);
                setForm(prev => ({ ...prev, session_id: e.target.value }));
              }}
              className="px-3.5 py-2 rounded-2xl border border-slate-200 text-sm bg-kemenag-50/50 font-medium text-slate-800"
            >
              {sessions.map(s => (
                <option key={s.session_id} value={s.session_id}>
                  {s.title} ({s.token})
                </option>
              ))}
            </select>
          </div>

          {/* Tombol Aksi Excel & Tambah Soal */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Tombol Download Template Excel */}
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              onClick={downloadExcelTemplate}
              title="Unduh file template Excel (.csv)"
              className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
            >
              Download Template Excel
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
              Import dari Excel / CSV
            </Button>

            {/* Tombol Tambah Soal Manual */}
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowModal(true)}
            >
              Tambah Soal
            </Button>
          </div>
        </div>

        {/* List Soal */}
        <div className="space-y-4">
          {filteredQuestions.length === 0 ? (
            <Card className="p-10 text-center text-slate-500 text-sm bg-white rounded-3xl border border-kemenag-100">
              Belum ada soal pada sesi ini. Anda dapat mengklik <strong>Download Template Excel</strong> lalu mengisinya dan mengunggah kembali via <strong>Import dari Excel</strong>.
            </Card>
          ) : (
            filteredQuestions.map((q, idx) => (
              <Card key={q.question_id} className="p-6 space-y-3 bg-white rounded-3xl border border-kemenag-100 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-kemenag-600 text-white font-extrabold text-xs flex items-center justify-center">
                      {idx + 1}
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

                {/* Info Kunci Jawaban */}
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

      {/* Modal Import Soal dari Excel / CSV */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Bank Soal dari File Excel / CSV"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-1.5">
            <h5 className="font-bold flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Petunjuk Format Excel:
            </h5>
            <p>
              Pastikan kolom sesuai template: <code>No, Jenis_Soal, Teks_Soal, Gambar_URL, Opsi_A, Opsi_B, Opsi_C, Opsi_D, Kunci_Jawaban, Bobot</code>.
            </p>
            <button
              onClick={downloadExcelTemplate}
              className="text-emerald-700 font-bold underline hover:text-emerald-900 inline-block"
            >
              Unduh Template Contoh Di Sini (.csv)
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Pilih File Excel / CSV dari Komputer:
            </label>
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
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
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">#{idx + 1}</span>
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
            <Button variant="secondary" className="flex-1" onClick={() => setShowImportModal(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              disabled={importPreview.length === 0 || importing}
              onClick={handleExecuteImport}
              icon={Check}
            >
              {importing ? 'Mengimpor...' : `Simpan ${importPreview.length} Soal`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Tambah Soal Manual */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Buat Soal Ujian"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveQuestion} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
              <label className="block text-xs font-semibold text-slate-700">Pilihan Jawaban (A-D)</label>
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

          <div className="flex gap-2 pt-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" className="flex-1">
              Simpan Soal
            </Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
};
