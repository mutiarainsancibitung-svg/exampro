import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
  downloadParticipantExcelTemplate,
  parseUploadedParticipantFile
} from '../../utils/excelTemplate';
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Download,
  Trash2,
  Search,
  Check,
  AlertCircle,
  Building,
  IdCard,
  Lock,
  Layers,
  GraduationCap,
  Sparkles
} from 'lucide-react';

export const ParticipantsPage = () => {
  const { adminSecretKey, isAdminLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [participants, setParticipants] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState('ALL');
  const [filterKelas, setFilterKelas] = useState('ALL');
  const [filterPaket, setFilterPaket] = useState('ALL');

  // State Aksi Massal Berdasarkan Kelas
  const [bulkClass, setBulkClass] = useState('');
  const [bulkPackage, setBulkPackage] = useState('Pretest');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);

  // Form Tambah Peserta Manual (Username & Password ditentukan admin)
  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
    gender: 'Laki-Laki',
    identifier: '',
    kelas: 'Kelas A',
    institution: '',
    paket: 'Pretest'
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
        const parts = res.participants || [];
        setParticipants(parts);
        if (parts.length > 0 && !bulkClass) {
          const firstClass = parts.find(p => p.kelas)?.kelas || 'Kelas A';
          setBulkClass(firstClass);
        }
      }
    } catch (err) {
      console.error('Gagal memuat data peserta:', err);
    }
  };

  // Simpan Peserta Manual
  const handleSaveParticipant = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.full_name.trim()) {
      alert('Username dan Nama Lengkap wajib diisi!');
      return;
    }

    try {
      await gasApi.saveParticipant(adminSecretKey, {
        ...form,
        username: form.username.trim(),
        password: form.password.trim() || 'kemenag2026',
        full_name: form.full_name.trim(),
        kelas: form.kelas.trim() || 'Kelas A',
        paket: form.paket.trim() || 'Pretest'
      });
      setShowAddModal(false);
      setForm({
        username: '',
        password: '',
        full_name: '',
        gender: 'Laki-Laki',
        identifier: '',
        kelas: 'Kelas A',
        institution: '',
        paket: 'Pretest'
      });
      loadData();
      alert('Data peserta berhasil disimpan!');
    } catch (err) {
      alert('Gagal menyimpan peserta: ' + err.message);
    }
  };

  // Handler Pilih File Excel Peserta
  const handleSelectExcelFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportError('');
    try {
      const parsed = await parseUploadedParticipantFile(file);
      setImportPreview(parsed);
    } catch (err) {
      setImportError(err.message || 'Gagal membaca format file Excel peserta.');
      setImportPreview([]);
    }
  };

  // Eksekusi Batch Save Peserta dari Excel
  const handleExecuteImport = async () => {
    if (importPreview.length === 0) return;
    setImporting(true);
    try {
      await gasApi.batchSaveParticipants(adminSecretKey, importPreview);
      setShowImportModal(false);
      setImportPreview([]);
      alert(`Berhasil mengimpor ${importPreview.length} data peserta dari file Excel!`);
      loadData();
    } catch (err) {
      alert('Gagal mengimpor peserta: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  // Aksi 1: Penentuan Paket Berdasarkan Kelas (Massal)
  const handleApplyPackageByClass = async () => {
    if (!bulkClass) {
      alert('Pilih kelas terlebih dahulu!');
      return;
    }
    const targetParticipants = participants.filter(
      p => (p.kelas || '').toLowerCase() === bulkClass.toLowerCase()
    );

    if (targetParticipants.length === 0) {
      alert(`Tidak ada peserta yang terdaftar pada ${bulkClass}.`);
      return;
    }

    if (!window.confirm(`Yakin ingin menetapkan Paket "${bulkPackage}" untuk SEMUA (${targetParticipants.length}) peserta di ${bulkClass}?`)) {
      return;
    }

    setBulkUpdating(true);
    try {
      const updatedList = targetParticipants.map(p => ({
        ...p,
        paket: bulkPackage
      }));
      await gasApi.batchSaveParticipants(adminSecretKey, updatedList);
      alert(`Berhasil menetapkan Paket ${bulkPackage} ke ${targetParticipants.length} peserta di ${bulkClass}!`);
      loadData();
    } catch (err) {
      alert('Gagal menetapkan paket kelas: ' + err.message);
    } finally {
      setBulkUpdating(false);
    }
  };

  // Aksi 2: Penentuan Paket Berdasarkan Individu
  const handleAssignIndividualPackage = async (participant, newPackage) => {
    try {
      await gasApi.saveParticipant(adminSecretKey, {
        ...participant,
        paket: newPackage
      });
      // Update state locally for instant snappy feedback
      setParticipants(prev =>
        prev.map(p => (p.participant_id === participant.participant_id ? { ...p, paket: newPackage } : p))
      );
    } catch (err) {
      alert('Gagal memperbarui paket peserta: ' + err.message);
      loadData();
    }
  };

  // Hapus Peserta
  const handleDelete = async (participantId) => {
    if (!window.confirm('Yakin ingin menghapus data peserta ini?')) return;
    try {
      await gasApi.deleteParticipant(adminSecretKey, participantId);
      loadData();
    } catch (err) {
      alert('Gagal menghapus peserta: ' + err.message);
    }
  };

  // Ekstrak Kelas & Paket Dinamis untuk Filter
  const detectedClasses = Array.from(new Set(participants.map(p => p.kelas || 'Kelas A').filter(Boolean)));
  const classList = detectedClasses.length > 0 ? detectedClasses : ['Kelas A', 'Kelas B'];

  const detectedPackages = Array.from(new Set(participants.map(p => p.paket || 'Pretest').filter(Boolean)));
  const packageList = Array.from(new Set(['Pretest', 'Postest', ...detectedPackages]));

  // Filter Peserta
  const filteredParticipants = participants.filter(p => {
    const matchSearch =
      (p.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.identifier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.institution || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchGender =
      filterGender === 'ALL' || (p.gender || '').toLowerCase() === filterGender.toLowerCase();

    const matchKelas =
      filterKelas === 'ALL' || (p.kelas || 'Kelas A').toLowerCase() === filterKelas.toLowerCase();

    const matchPaket =
      filterPaket === 'ALL' || (p.paket || 'Pretest').toLowerCase() === filterPaket.toLowerCase();

    return matchSearch && matchGender && matchKelas && matchPaket;
  });

  return (
    <AdminLayout title="Data Peserta, Pemetaan Kelas & Paket Ujian">
      <div className="space-y-6">

        {/* Panel Aksi Penentuan Paket Berdasarkan Kelas */}
        <div className="bg-white p-5 rounded-3xl border border-kemenag-100 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-kemenag-50 text-kemenag-700">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">
                  Penentuan Aksi Paket Berdasarkan Kelas
                </h3>
                <p className="text-xs text-slate-500">
                  Tetapkan paket ujian (Pretest / Postest) secara massal ke seluruh peserta dalam satu kelas sekaligus.
                </p>
              </div>
            </div>

            {/* Form Aksi Kelas */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-600">Pilih Kelas:</span>
                <select
                  value={bulkClass || (classList[0] || '')}
                  onChange={(e) => setBulkClass(e.target.value)}
                  className="bg-transparent text-xs font-extrabold text-kemenag-800 focus:outline-none cursor-pointer"
                >
                  {classList.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-600">Tugaskan Paket:</span>
                <select
                  value={bulkPackage}
                  onChange={(e) => setBulkPackage(e.target.value)}
                  className="bg-transparent text-xs font-extrabold text-emerald-800 focus:outline-none cursor-pointer"
                >
                  <option value="Pretest">Pretest</option>
                  <option value="Postest">Postest</option>
                </select>
              </div>

              <Button
                variant="primary"
                size="sm"
                icon={Check}
                disabled={bulkUpdating}
                onClick={handleApplyPackageByClass}
                className="shadow-sm"
              >
                {bulkUpdating ? 'Menerapkan...' : 'Terapkan ke Kelas'}
              </Button>
            </div>
          </div>
        </div>

        {/* Bar Filter & Aksi Tambah / Import Excel */}
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
                className="pl-9 pr-4 py-2 rounded-2xl border border-slate-200 text-xs w-56 bg-slate-50 focus:bg-white focus:outline-none focus:border-kemenag-600 font-medium"
              />
            </div>

            {/* Filter Kelas */}
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-xs bg-slate-50 font-bold text-slate-700"
            >
              <option value="ALL">Semua Kelas</option>
              {classList.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>

            {/* Filter Paket */}
            <select
              value={filterPaket}
              onChange={(e) => setFilterPaket(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-xs bg-slate-50 font-bold text-slate-700"
            >
              <option value="ALL">Semua Paket</option>
              {packageList.map(pkt => (
                <option key={pkt} value={pkt}>{pkt}</option>
              ))}
            </select>

            {/* Filter Gender */}
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-xs bg-slate-50 font-medium text-slate-700"
            >
              <option value="ALL">Semua Gender</option>
              <option value="Laki-Laki">Laki-Laki</option>
              <option value="Perempuan">Perempuan</option>
            </select>
          </div>

          {/* Tombol Aksi Excel & Tambah Peserta */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Download Template Excel Peserta */}
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              onClick={downloadParticipantExcelTemplate}
              title="Unduh file template Excel (.xlsx)"
              className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
            >
              Download Template Excel (.xlsx)
            </Button>

            {/* Import Excel Peserta */}
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

            {/* Tambah Peserta Manual */}
            <Button
              variant="primary"
              size="sm"
              icon={UserPlus}
              onClick={() => setShowAddModal(true)}
            >
              Tambah Peserta
            </Button>
          </div>
        </div>

        {/* Tabel Data Peserta */}
        <div className="bg-white rounded-3xl border border-kemenag-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-kemenag-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-kemenag-50 text-kemenag-700">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Daftar Peserta Pelatihan Guru PAI</h3>
                <p className="text-xs text-slate-500">
                  Total {filteredParticipants.length} peserta ditampilkan. Username dan Password dikelola penuh oleh Admin.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredParticipants.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                Belum ada data peserta yang cocok. Klik <strong>Download Template Excel (.xlsx)</strong> untuk mengunduh template dengan header Kelas & Paket, lalu upload via <strong>Import dari Excel (.xlsx)</strong>.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Nama Lengkap & NIP/NIM</th>
                    <th className="py-3 px-4">Username & Password Admin</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4">Aksi: Paket Ujian</th>
                    <th className="py-3 px-4">Jenis Kelamin</th>
                    <th className="py-3 px-4">Asal Madrasah / Sekolah</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredParticipants.map((p, idx) => (
                    <tr key={p.participant_id || idx} className="hover:bg-kemenag-50/30 transition">
                      <td className="py-3.5 px-4 text-center font-bold text-slate-500">
                        {idx + 1}
                      </td>

                      {/* Nama & NIP */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800 block text-sm">
                          {p.full_name || p.username}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          NIP: {p.identifier || '-'}
                        </span>
                      </td>

                      {/* Username & Password yang Ditentukan Admin */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-kemenag-800 bg-kemenag-50 border border-kemenag-200 px-2.5 py-0.5 rounded-lg text-xs">
                            {p.username || '-'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono block mt-1">
                          Pass: <strong className="text-slate-800 font-semibold">{p.password || 'kemenag2026'}</strong>
                        </span>
                      </td>

                      {/* Kelas */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {p.kelas || 'Kelas A'}
                        </span>
                      </td>

                      {/* Aksi: Pemilihan Paket Individu Langsung di Baris */}
                      <td className="py-3.5 px-4">
                        <select
                          value={p.paket || 'Pretest'}
                          onChange={(e) => handleAssignIndividualPackage(p, e.target.value)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            (p.paket || 'Pretest').toLowerCase().includes('post')
                              ? 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
                              : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                          }`}
                          title="Klik untuk mengubah paket ujian peserta ini"
                        >
                          <option value="Pretest">Pretest</option>
                          <option value="Postest">Postest</option>
                        </select>
                      </td>

                      {/* Gender */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          p.gender === 'Perempuan'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {p.gender || 'Laki-Laki'}
                        </span>
                      </td>

                      {/* Asal Madrasah */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {p.institution || 'Madrasah / Sekolah'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                          p.status === 'submitted'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-800 animate-pulse'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {p.status === 'submitted' ? 'Selesai' : p.status === 'in_progress' ? 'Ujian' : 'Siap'}
                        </span>
                      </td>

                      {/* Aksi Hapus */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleDelete(p.participant_id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition"
                          title="Hapus Peserta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal Import Peserta dari Excel (.xlsx) */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Data Peserta dari File Excel (.xlsx)"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-1.5">
            <h5 className="font-bold flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Petunjuk Kolom Template Excel (.xlsx):
            </h5>
            <p>
              Pastikan kolom sesuai template: <code>No, Username, Password, Nama_Lengkap, Jenis_Kelamin, NIP_NIM, Kelas, Asal_Madrasah_Sekolah, Paket</code>.
            </p>
            <p className="text-emerald-800">
              Kolom <strong>Kelas</strong> dan <strong>Paket</strong> (Pretest/Postest) akan langsung dipetakan ke sistem, dan <strong>Username & Password</strong> akan menjadi akun login resmi peserta!
            </p>
            <button
              onClick={downloadParticipantExcelTemplate}
              className="text-emerald-700 font-bold underline hover:text-emerald-900 inline-block pt-1"
            >
              Unduh Template Data Peserta (.xlsx) Di Sini
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

          {/* Pratinjau Data Peserta */}
          {importPreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Pratinjau Data ({importPreview.length} peserta terdeteksi):</span>
                <span className="text-emerald-600 font-medium">Format Valid</span>
              </div>
              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-2xl divide-y text-xs p-2 bg-slate-50">
                {importPreview.map((item, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">#{idx + 1} {item.full_name}</span>
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          {item.kelas || 'Kelas A'}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-bold text-[10px]">
                          {item.paket || 'Pretest'}
                        </span>
                      </div>
                      <span className="text-slate-400 text-[11px] block mt-0.5">
                        User: <strong className="text-slate-700">{item.username}</strong> • Pass: <strong className="text-slate-700">{item.password || 'kemenag2026'}</strong> • {item.institution}
                      </span>
                    </div>
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
              {importing ? 'Mengimpor...' : `Simpan ${importPreview.length} Peserta`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Tambah Peserta Manual */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Tambah Data Peserta Manual"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveParticipant} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Username Login (Admin)</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Contoh: guru_pai_05"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password Login (Admin)</label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Default: kemenag2026"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Contoh: Drs. H. Ahmad Fauzi, M.Pd"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kelas Peserta</label>
              <input
                type="text"
                value={form.kelas}
                onChange={(e) => setForm({ ...form, kelas: e.target.value })}
                placeholder="Contoh: Kelas A / Kelas B"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Aksi: Paket Ujian</label>
              <select
                value={form.paket}
                onChange={(e) => setForm({ ...form, paket: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-kemenag-800"
              >
                <option value="Pretest">Pretest</option>
                <option value="Postest">Postest</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              >
                <option value="Laki-Laki">Laki-Laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">NIP / NIM</label>
              <input
                type="text"
                value={form.identifier}
                onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                placeholder="Contoh: 198501012010121001"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Asal Madrasah / Sekolah</label>
            <input
              type="text"
              value={form.institution}
              onChange={(e) => setForm({ ...form, institution: e.target.value })}
              placeholder="Contoh: MAN 1 Kota Jakarta / MTsN 2"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>

          <div className="flex gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" className="flex-1" onClick={() => setShowAddModal(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" className="flex-1">
              Simpan Peserta
            </Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
};
