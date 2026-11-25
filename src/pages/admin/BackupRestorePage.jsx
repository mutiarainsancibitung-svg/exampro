import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import * as XLSX from 'xlsx';
import {
  Database,
  Download,
  Upload,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Layers,
  Users,
  Award,
  BookOpen,
  Calendar,
  ShieldCheck,
  Check
} from 'lucide-react';

export const BackupRestorePage = () => {
  const { adminSecretKey } = useAuth();

  // Export State
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  const [exportSuccess, setExportSuccess] = useState('');

  // Restore State
  const [restoreFile, setRestoreFile] = useState(null);
  const [parsedBackup, setParsedBackup] = useState(null);
  const [parseError, setParseError] = useState('');
  const [restoreMode, setRestoreMode] = useState('append'); // 'append' | 'overwrite'
  const [confirmText, setConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);

  // 1. Handler Ekspor Master Backup ke File Excel (.xlsx) 5 Sheet
  const handleExportExcelMaster = async () => {
    setExportingXlsx(true);
    setExportSuccess('');
    try {
      const res = await gasApi.exportFullBackup(adminSecretKey);
      if (res.status !== 'success') {
        throw new Error(res.message || 'Gagal mengambil data dari Google Sheets');
      }

      const wb = XLSX.utils.book_new();

      // Tab 1: Sessions
      const wsSessions = XLSX.utils.json_to_sheet(res.sessions || []);
      XLSX.utils.book_append_sheet(wb, wsSessions, 'Sessions');

      // Tab 2: Questions
      const questionsExport = (res.questions || []).map(q => ({
        question_id: q.question_id || '',
        session_id: q.session_id || 'SES-001',
        paket: q.paket || 'Pretest',
        type: q.type || 'single_choice',
        question_text: q.question_text || '',
        image_url: q.image_url || '',
        options_json: typeof q.options === 'object' ? JSON.stringify(q.options) : (q.options_json || '[]'),
        key_answer: q.key_answer || '',
        weight: q.weight || 1
      }));
      const wsQuestions = XLSX.utils.json_to_sheet(questionsExport);
      XLSX.utils.book_append_sheet(wb, wsQuestions, 'Questions');

      // Tab 3: Participants
      const wsParticipants = XLSX.utils.json_to_sheet(res.participants || []);
      XLSX.utils.book_append_sheet(wb, wsParticipants, 'Participants');

      // Tab 4: Submissions
      const wsSubmissions = XLSX.utils.json_to_sheet(res.submissions || []);
      XLSX.utils.book_append_sheet(wb, wsSubmissions, 'Submissions');

      // Tab 5: Admins
      const wsAdmins = XLSX.utils.json_to_sheet(res.admins || []);
      XLSX.utils.book_append_sheet(wb, wsAdmins, 'Admins');

      const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
      const fileName = `Master_Backup_ExamPro_PAI_${nowStr}.xlsx`;
      XLSX.writeFile(wb, fileName);

      setExportSuccess(`Master Backup Excel berhasil diunduh (${fileName}) dengan 5 sheet lengkap!`);
    } catch (err) {
      alert('Gagal mengekspor backup: ' + err.message);
    } finally {
      setExportingXlsx(false);
    }
  };

  // 2. Handler Ekspor Snapshot JSON
  const handleExportJson = async () => {
    setExportingJson(true);
    setExportSuccess('');
    try {
      const res = await gasApi.exportFullBackup(adminSecretKey);
      if (res.status !== 'success') throw new Error(res.message);

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(res, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `Snapshot_ExamPro_PAI_${nowStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setExportSuccess('Snapshot JSON berhasil diunduh!');
    } catch (err) {
      alert('Gagal mengunduh JSON: ' + err.message);
    } finally {
      setExportingJson(false);
    }
  };

  // 3. Handler Parsing File Restore (.xlsx atau .json)
  const handleSelectRestoreFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setRestoreFile(file);
    setParseError('');
    setParsedBackup(null);
    setRestoreResult(null);

    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const json = JSON.parse(text);
        setParsedBackup({
          sessions: json.sessions || [],
          questions: json.questions || [],
          participants: json.participants || [],
          submissions: json.submissions || [],
          admins: json.admins || []
        });
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const data = {};

        wb.SheetNames.forEach(sheetName => {
          const lower = sheetName.toLowerCase().trim();
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
          if (lower.includes('session')) data.sessions = rows;
          else if (lower.includes('question') || lower.includes('soal')) data.questions = rows;
          else if (lower.includes('participant') || lower.includes('peserta')) data.participants = rows;
          else if (lower.includes('submission') || lower.includes('nilai')) data.submissions = rows;
          else if (lower.includes('admin')) data.admins = rows;
        });

        if (!data.sessions && !data.questions && !data.participants) {
          throw new Error('File Excel tidak memiliki lembar kerja standar (Sessions, Questions, atau Participants).');
        }

        setParsedBackup({
          sessions: data.sessions || [],
          questions: data.questions || [],
          participants: data.participants || [],
          submissions: data.submissions || [],
          admins: data.admins || []
        });
      } else {
        throw new Error('Format file tidak didukung. Harap pilih file .xlsx atau .json.');
      }
    } catch (err) {
      setParseError(err.message || 'Gagal membaca file backup.');
    }
  };

  // 4. Eksekusi Restore ke Database
  const handleExecuteRestore = async () => {
    if (!parsedBackup) return;

    if (restoreMode === 'overwrite' && confirmText.trim().toUpperCase() !== 'PULIHKAN') {
      alert('Untuk mode Timpa Bersih, Anda wajib mengetik kata "PULIHKAN" pada kolom konfirmasi.');
      return;
    }

    setRestoring(true);
    setRestoreResult(null);
    try {
      const res = await gasApi.restoreFullBackup(adminSecretKey, parsedBackup, restoreMode);
      setRestoreResult({
        status: 'success',
        message: res.message || 'Pemulihan data selesai!',
        report: res.report || {}
      });
      alert('Pemulihan database berhasil dieksekusi!');
      setParsedBackup(null);
      setRestoreFile(null);
      setConfirmText('');
    } catch (err) {
      alert('Gagal memulihkan database: ' + err.message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <AdminLayout title="Pusat Cadangan & Pemulihan (Backup & Restore)">
      <div className="space-y-6">

        {/* Banner Penjelasan */}
        <div className="p-5 bg-emerald-50/80 border border-emerald-200 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-kemenag-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-kemenag-200">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Pusat Cadangan & Pemulihan Data Master ExamPro
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Lindungi seluruh aset evaluasi pembelajaran (Mata Ujian, Bank Soal, Peserta, Rekap Nilai, dan Akun) dengan cadangan instan.
              </p>
            </div>
          </div>
          <span className="px-3.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
            5 Tabel Master Terproteksi
          </span>
        </div>

        {exportSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-900 font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{exportSuccess}</span>
          </div>
        )}

        {/* 2 Kolom: Kiri Ekspor (Backup) & Kanan Impor (Restore) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* CARD 1: PENCADANGAN DATABASE (BACKUP) */}
          <Card className="p-6 bg-white rounded-3xl border border-kemenag-100 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Download className="w-5 h-5 text-kemenag-600" />
                <h4 className="font-bold text-sm text-slate-800">1. Unduh Cadangan Data (Backup)</h4>
              </div>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl">
                Ekspor Cloud
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Unduh salinan resmi seluruh isi sistem Google Sheets ke dalam format Microsoft Excel multi-sheet. Sangat cocok untuk arsip akreditasi, pelaporan dekanat, atau cadangan mingguan.
            </p>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <span className="font-bold text-slate-700 block">Isi Lembar Kerja yang Dicadangkan:</span>
              <ul className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Sheet 1: Sessions
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Sheet 2: Questions (Opsi A-E)
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Sheet 3: Participants
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Sheet 4: Submissions (Nilai)
                </li>
                <li className="flex items-center gap-1.5 col-span-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Sheet 5: Admins (Pengguna & Role)
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="primary"
                className="flex-1 justify-center py-2.5 text-xs font-bold"
                onClick={handleExportExcelMaster}
                disabled={exportingXlsx}
                icon={FileSpreadsheet}
              >
                {exportingXlsx ? 'Mengekspor Excel...' : 'Unduh Master Backup (.xlsx)'}
              </Button>

              <Button
                variant="secondary"
                className="flex-1 justify-center py-2.5 text-xs font-bold"
                onClick={handleExportJson}
                disabled={exportingJson}
                icon={FileText}
              >
                {exportingJson ? 'Menyiapkan JSON...' : 'Unduh Snapshot JSON'}
              </Button>
            </div>
          </Card>

          {/* CARD 2: PEMULIHAN DATABASE (RESTORE) */}
          <Card className="p-6 bg-white rounded-3xl border border-kemenag-100 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Upload className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-sm text-slate-800">2. Pemulihan Data (Restore)</h4>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl">
                Impor Pemulihan
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Pulihkan database dari file cadangan yang sebelumnya pernah diunduh. Sistem akan menganalisis isi file sebelum diterapkan.
            </p>

            {/* Input File */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Pilih File Cadangan (.xlsx / .json):
              </label>
              <input
                type="file"
                accept=".xlsx, .xls, .json"
                onChange={handleSelectRestoreFile}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-kemenag-50 file:text-kemenag-700 hover:file:bg-kemenag-100 cursor-pointer"
              />
            </div>

            {parseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Pratinjau Data yang Terdeteksi */}
            {parsedBackup && (
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
                <span className="font-bold text-xs text-emerald-950 block flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  Pratinjau Data Cadangan Terdeteksi:
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-white rounded-xl border border-emerald-100">
                    <span className="text-slate-400 text-[10px] block">Sesi Ujian</span>
                    <strong className="text-emerald-900 text-sm font-mono">{parsedBackup.sessions?.length || 0}</strong>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-emerald-100">
                    <span className="text-slate-400 text-[10px] block">Bank Soal</span>
                    <strong className="text-emerald-900 text-sm font-mono">{parsedBackup.questions?.length || 0}</strong>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-emerald-100">
                    <span className="text-slate-400 text-[10px] block">Peserta</span>
                    <strong className="text-emerald-900 text-sm font-mono">{parsedBackup.participants?.length || 0}</strong>
                  </div>
                </div>

                {/* Pemilihan Mode Restore */}
                <div className="pt-2 border-t border-emerald-200/80 space-y-2 text-xs">
                  <span className="font-bold text-slate-700 block">Pilih Strategi Pemulihan:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center gap-2 ${
                      restoreMode === 'append' ? 'bg-white border-emerald-600 ring-1 ring-emerald-600' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <input
                        type="radio"
                        name="restoreMode"
                        value="append"
                        checked={restoreMode === 'append'}
                        onChange={() => setRestoreMode('append')}
                      />
                      <div>
                        <strong className="text-slate-800 block text-xs">Mode Gabung</strong>
                        <span className="text-[10px] text-slate-500">Tambah data baru</span>
                      </div>
                    </label>

                    <label className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center gap-2 ${
                      restoreMode === 'overwrite' ? 'bg-white border-rose-600 ring-1 ring-rose-600' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <input
                        type="radio"
                        name="restoreMode"
                        value="overwrite"
                        checked={restoreMode === 'overwrite'}
                        onChange={() => setRestoreMode('overwrite')}
                      />
                      <div>
                        <strong className="text-rose-800 block text-xs">Timpa Bersih</strong>
                        <span className="text-[10px] text-rose-500">Reset sesuai backup</span>
                      </div>
                    </label>
                  </div>

                  {restoreMode === 'overwrite' && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5 text-xs text-rose-800">
                      <p className="font-bold">⚠️ Perhatian: Mode Timpa Bersih akan menghapus isi database saat ini.</p>
                      <p className="text-[11px]">Ketik kata <strong>PULIHKAN</strong> di bawah untuk konfirmasi:</p>
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="Ketik PULIHKAN..."
                        className="w-full px-3 py-1.5 rounded-lg border border-rose-300 font-mono text-xs uppercase"
                      />
                    </div>
                  )}
                </div>

                <Button
                  variant="primary"
                  className="w-full justify-center py-2.5 text-xs font-bold"
                  onClick={handleExecuteRestore}
                  disabled={restoring || (restoreMode === 'overwrite' && confirmText.trim().toUpperCase() !== 'PULIHKAN')}
                  icon={RefreshCw}
                >
                  {restoring ? 'Memproses Pemulihan Data...' : 'Mulai Pulihkan Data ke Database'}
                </Button>
              </div>
            )}

            {restoreResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{restoreResult.message}</span>
              </div>
            )}
          </Card>
        </div>

      </div>
    </AdminLayout>
  );
};
