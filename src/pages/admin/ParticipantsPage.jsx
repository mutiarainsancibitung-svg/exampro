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
  downloadParticipantExcelTemplate,
  parseUploadedParticipantFile,
  exportParticipantsToExcel
} from '../../utils/excelTemplate';
import {
  DISABILITY_CATEGORIES,
  getDisabilityMeta,
  normalizeDisabilityType
} from '../../utils/disabilityConfig';
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Download,
  Trash2,
  Edit3,
  Search,
  Check,
  AlertCircle,
  RotateCw,
  AlertTriangle,
  X,
  CheckSquare,
  Accessibility
} from 'lucide-react';

export const ParticipantsPage = () => {
  const { adminSecretKey, isAdminLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState('ALL');
  const [filterKelas, setFilterKelas] = useState('ALL');
  const [filterPaket, setFilterPaket] = useState('ALL');
  const [filterDisability, setFilterDisability] = useState('ALL');
  const [showDisabilityGuideModal, setShowDisabilityGuideModal] = useState(false);

  // Checklist Selection State
  const [selectedParticipantIds, setSelectedParticipantIds] = useState([]);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);

  // Modal Hapus Semua Peserta
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteAllInput, setDeleteAllInput] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Form Tambah Peserta Manual (termasuk keterangan disabilitas)
  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
    gender: '-',
    identifier: '',
    kelas: '',
    institution: '',
    disability_type: 'none',
    disability_note: ''
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
        const parts = res.participants || [];
        const qList = res.questions || [];
        setParticipants(parts);
        setQuestions(qList);
      }
    } catch (err) {
      console.error('Gagal memuat data peserta:', err);
    } finally {
      setLoading(false);
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
        username: form.username.trim(),
        password: form.password.trim() || 'kemenag2026',
        full_name: form.full_name.trim(),
        gender: form.gender || '-',
        identifier: form.identifier.trim(),
        kelas: form.kelas.trim() || '-',
        institution: form.institution.trim(),
        paket: '-',
        disability_type: form.disability_type || 'none',
        disability_note: form.disability_note.trim()
      });
      setShowAddModal(false);
      setForm({
        username: '',
        password: '',
        full_name: '',
        gender: '-',
        identifier: '',
        kelas: '',
        institution: '',
        disability_type: 'none',
        disability_note: ''
      });
      loadData(true);
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
      loadData(true);
    } catch (err) {
      alert('Gagal mengimpor peserta: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  // Buka Modal Edit Peserta
  const handleOpenEdit = (p) => {
    setEditingParticipant({
      ...p,
      username: p.username || '',
      password: p.password || 'kemenag2026',
      full_name: p.full_name || '',
      gender: p.gender || '-',
      identifier: p.identifier || '',
      kelas: p.kelas || '-',
      institution: p.institution || '',
      paket: p.paket || '-',
      status: p.status || 'registered',
      disability_type: normalizeDisabilityType(p.disability_type),
      disability_note: p.disability_note || ''
    });
    setShowEditModal(true);
  };

  // Simpan Pembaruan Peserta
  const handleUpdateParticipant = async (e) => {
    e.preventDefault();
    if (!editingParticipant) return;
    if (!editingParticipant.username.trim() || !editingParticipant.full_name.trim()) {
      alert('Username dan Nama Lengkap wajib diisi!');
      return;
    }

    try {
      await gasApi.saveParticipant(adminSecretKey, {
        ...editingParticipant,
        gender: editingParticipant.gender || '-',
        kelas: editingParticipant.kelas || '-',
        paket: editingParticipant.paket || '-',
        disability_type: editingParticipant.disability_type || 'none',
        disability_note: editingParticipant.disability_note || ''
      });
      setShowEditModal(false);
      setEditingParticipant(null);
      alert('Data peserta berhasil diperbarui!');
      loadData(true);
    } catch (err) {
      alert('Gagal memperbarui data peserta: ' + err.message);
    }
  };

  // Hapus Peserta Tunggal
  const handleDelete = async (participantId) => {
    if (!window.confirm('Yakin ingin menghapus data peserta ini?')) return;
    try {
      await gasApi.deleteParticipant(adminSecretKey, participantId);
      setSelectedParticipantIds(prev => prev.filter(id => id !== participantId));
      loadData(true);
    } catch (err) {
      alert('Gagal menghapus peserta: ' + err.message);
    }
  };

  // Hapus Masal Peserta Berdasarkan Ceklis
  const handleBatchDelete = async () => {
    if (selectedParticipantIds.length === 0) return;
    if (!window.confirm(`Yakin ingin menghapus ${selectedParticipantIds.length} peserta terpilih? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    setIsBatchDeleting(true);
    try {
      const res = await gasApi.batchDeleteParticipants(adminSecretKey, selectedParticipantIds);
      setSelectedParticipantIds([]);
      alert(res.message || `Berhasil menghapus ${selectedParticipantIds.length} peserta terpilih!`);
      loadData(true);
    } catch (err) {
      alert('Gagal menghapus peserta terpilih: ' + err.message);
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // Hapus Seluruh Peserta Sekaligus
  const handleDeleteAll = async () => {
    if (deleteAllInput.trim() !== 'HAPUS SEMUA') {
      alert('Ketik kata "HAPUS SEMUA" secara persis untuk konfirmasi.');
      return;
    }

    setIsDeletingAll(true);
    try {
      const allIds = participants.map(p => p.participant_id).filter(Boolean);
      const res = await gasApi.deleteAllParticipants(adminSecretKey, allIds);
      setShowDeleteAllModal(false);
      setDeleteAllInput('');
      setSelectedParticipantIds([]);
      alert(res.message || 'Seluruh data peserta berhasil dihapus.');
      loadData(true);
    } catch (err) {
      alert('Gagal menghapus semua peserta: ' + err.message);
    } finally {
      setIsDeletingAll(false);
    }
  };

  // Download Backup Excel Peserta
  const handleExportBackup = () => {
    if (participants.length === 0) {
      alert('Tidak ada data peserta untuk diunduh.');
      return;
    }
    exportParticipantsToExcel(participants, `Backup_Data_Peserta_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // EKSTRAK DINAMIS MURNI DARI DATA YANG DIINPUTKAN
  const dynamicClasses = Array.from(new Set(participants.map(p => p.kelas?.trim()).filter(Boolean)));
  const dynamicPackages = Array.from(new Set([
    ...questions.map(q => q.paket?.trim()),
    ...participants.map(p => p.paket?.trim())
  ].filter(Boolean)));

  // Filter Peserta
  const filteredParticipants = participants.filter(p => {
    const matchSearch =
      (p.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.identifier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.institution || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchGender =
      filterGender === 'ALL' || (p.gender || '-').toLowerCase() === filterGender.toLowerCase();

    const matchKelas =
      filterKelas === 'ALL' || (p.kelas || '').trim().toLowerCase() === filterKelas.toLowerCase();

    const matchPaket =
      filterPaket === 'ALL' || (p.paket || '').trim().toLowerCase() === filterPaket.toLowerCase();

    const pDisType = normalizeDisabilityType(p.disability_type);
    const matchDisability =
      filterDisability === 'ALL' ||
      (filterDisability === 'DISABILITY_ONLY' && pDisType !== 'none') ||
      pDisType === filterDisability;

    return matchSearch && matchGender && matchKelas && matchPaket && matchDisability;
  });

  // Checklist Selection Handlers
  const isAllSelected =
    filteredParticipants.length > 0 &&
    filteredParticipants.every(p => selectedParticipantIds.includes(p.participant_id));

  const handleToggleSelect = (pId) => {
    setSelectedParticipantIds(prev =>
      prev.includes(pId) ? prev.filter(id => id !== pId) : [...prev, pId]
    );
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const filteredIdSet = new Set(filteredParticipants.map(p => p.participant_id));
      setSelectedParticipantIds(prev => prev.filter(id => !filteredIdSet.has(id)));
    } else {
      const merged = Array.from(new Set([
        ...selectedParticipantIds,
        ...filteredParticipants.map(p => p.participant_id).filter(Boolean)
      ]));
      setSelectedParticipantIds(merged);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Data & Kelola Akun Peserta Ujian">
        <LoadingScreen
          message="Memuat Data Peserta Ujian..."
          submessage="Sedang mengambil data peserta terdaftar, pembagian kelas, dan status..."
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Data & Kelola Akun Peserta Ujian">
      <div className="space-y-6">
        {/* Bar Filter & Aksi Tambah / Import Excel / Hapus Masal */}
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
                className="pl-9 pr-4 py-2 rounded-2xl border border-slate-200 text-xs w-52 bg-slate-50 focus:bg-white focus:outline-none focus:border-kemenag-600 font-medium"
              />
            </div>

            {/* Filter Kelas Dinamis */}
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-xs bg-slate-50 font-bold text-slate-700"
            >
              <option value="ALL">Semua Kelas ({dynamicClasses.length})</option>
              {dynamicClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>

            {/* Filter Paket / Tugas Dinamis */}
            <select
              value={filterPaket}
              onChange={(e) => setFilterPaket(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-xs bg-slate-50 font-bold text-slate-700"
            >
              <option value="ALL">Semua Paket ({dynamicPackages.length})</option>
              {dynamicPackages.map(pkt => (
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
              <option value="-">- (Belum Ditentukan)</option>
              <option value="Laki-Laki">Laki-Laki</option>
              <option value="Perempuan">Perempuan</option>
            </select>

            {/* Filter Keterangan Disabilitas */}
            <select
              value={filterDisability}
              onChange={(e) => setFilterDisability(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-indigo-200 text-xs bg-indigo-50/70 font-bold text-indigo-800"
            >
              <option value="ALL">Semua Kondisi Peserta</option>
              <option value="none">Hanya Non-Disabilitas</option>
              <option value="DISABILITY_ONLY">Semua Penyandang Disabilitas</option>
              {DISABILITY_CATEGORIES.filter(c => c.key !== 'none').map(c => (
                <option key={c.key} value={c.key}>{c.shortLabel}</option>
              ))}
            </select>
          </div>

          {/* Tombol Aksi Excel & Tambah Peserta */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Panduan Konsep & Matriks Kebutuhan Disabilitas */}
            <Button
              variant="outline"
              size="sm"
              icon={Accessibility}
              onClick={() => setShowDisabilityGuideModal(true)}
              className="border-indigo-300 text-indigo-800 bg-indigo-50/60 hover:bg-indigo-100"
            >
              Panduan Disabilitas
            </Button>
            {/* Tombol Segarkan */}
            <Button
              variant="outline"
              size="sm"
              icon={RotateCw}
              onClick={() => loadData(true)}
              title="Segarkan data peserta dari Google Sheets"
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Segarkan
            </Button>

            {/* Backup Excel */}
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={handleExportBackup}
              title="Ekspor seluruh data peserta ke file Excel (.xlsx)"
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Backup Data (.xlsx)
            </Button>

            {/* Download Template Excel Peserta */}
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              onClick={downloadParticipantExcelTemplate}
              title="Unduh file template Excel (.xlsx)"
              className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
            >
              Template Excel
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
              Import Excel
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

            {/* Hapus Semua Peserta */}
            <button
              onClick={() => {
                setDeleteAllInput('');
                setShowDeleteAllModal(true);
              }}
              title="Hapus seluruh data peserta"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Hapus Semua</span>
            </button>
          </div>
        </div>

        {/* Floating Bulk Action Bar saat ada peserta terceklis */}
        {selectedParticipantIds.length > 0 && (
          <div className="bg-emerald-900 text-white px-5 py-3.5 rounded-2xl shadow-lg flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5 text-xs font-semibold">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white font-bold text-xs">
                {selectedParticipantIds.length}
              </span>
              <span>Peserta dipilih dari daftar</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchDelete}
                disabled={isBatchDeleting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isBatchDeleting ? 'Menghapus...' : `Hapus ${selectedParticipantIds.length} Peserta Terpilih`}</span>
              </button>
              <button
                onClick={() => setSelectedParticipantIds([])}
                className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-emerald-800 transition"
                title="Batalkan Pilihan"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

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
                  Total {filteredParticipants.length} peserta ditampilkan. Ceklis kotak pada baris untuk hapus massal terpilih.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredParticipants.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                Belum ada data peserta yang cocok. Klik <strong>Template Excel</strong> untuk mengunduh template, lalu upload via <strong>Import Excel</strong> atau klik <strong>Tambah Peserta</strong>.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded text-kemenag-600 focus:ring-kemenag-500 border-slate-300 cursor-pointer"
                        title="Pilih Semua Peserta"
                      />
                    </th>
                    <th className="py-3 px-3 w-12 text-center">No</th>
                    <th className="py-3 px-4 min-w-[180px]">Nama Lengkap & NIP/NIM</th>
                    <th className="py-3 px-4 min-w-[160px]">Username & Password</th>
                    <th className="py-3 px-4 min-w-[130px]">Kelas</th>
                    <th className="py-3 px-4 min-w-[110px]">Jenis Kelamin</th>
                    <th className="py-3 px-4 min-w-[200px]">Asal Madrasah / Sekolah</th>
                    <th className="py-3 px-4 min-w-[160px]">Keterangan Disabilitas</th>
                    <th className="py-3 px-4 min-w-[120px]">Paket Soal</th>
                    <th className="py-3 px-4 min-w-[90px]">Status</th>
                    <th className="py-3 px-4 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredParticipants.map((p, idx) => {
                    const isChecked = selectedParticipantIds.includes(p.participant_id);
                    return (
                      <tr
                        key={p.participant_id || idx}
                        className={`transition ${isChecked ? 'bg-emerald-50/60' : 'hover:bg-kemenag-50/30'}`}
                      >
                        {/* Checkbox */}
                        <td className="py-3.5 px-3 text-center align-top">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelect(p.participant_id)}
                            className="w-4 h-4 rounded text-kemenag-600 focus:ring-kemenag-500 border-slate-300 cursor-pointer mt-1"
                          />
                        </td>

                        {/* No */}
                        <td className="py-3.5 px-3 text-center font-bold text-slate-500 align-top">
                          <span className="block mt-0.5">{idx + 1}</span>
                        </td>

                        {/* Nama & NIP */}
                        <td className="py-3.5 px-4 align-top">
                          <span className="font-bold text-slate-800 block text-xs break-words max-w-[200px] leading-snug">
                            {p.full_name || p.username}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                            NIP: {p.identifier || '-'}
                          </span>
                        </td>

                        {/* Username & Password */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block font-mono font-bold text-kemenag-800 bg-kemenag-50 border border-kemenag-200 px-2 py-0.5 rounded-lg text-xs break-all">
                              {p.username || '-'}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono block mt-1">
                            Pass: <strong className="text-slate-800 font-semibold">{p.password || 'kemenag2026'}</strong>
                          </span>
                        </td>

                        {/* Kelas Dinamis (Mitigasi teks menurun/terpotong dengan inline-block dan break-words) */}
                        <td className="py-3.5 px-4 align-top">
                          <span className="inline-block px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 leading-snug break-words max-w-[180px] text-left">
                            {p.kelas || '-'}
                          </span>
                        </td>

                        {/* Gender (jika kosong diisi -) */}
                        <td className="py-3.5 px-4 align-top">
                          {(!p.gender || p.gender === '-') ? (
                            <span className="text-slate-400 font-bold px-1.5 py-0.5 text-xs">-</span>
                          ) : (
                            <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                              p.gender === 'Perempuan'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                              {p.gender}
                            </span>
                          )}
                        </td>

                        {/* Asal Madrasah */}
                        <td className="py-3.5 px-4 align-top text-slate-600 font-medium">
                          <span className="inline-block max-w-[240px] break-words leading-relaxed text-slate-700 font-medium text-left">
                            {p.institution || '-'}
                          </span>
                        </td>

                        {/* Keterangan Disabilitas & Status Anti-Cheat */}
                        <td className="py-3.5 px-4 align-top">
                          {(() => {
                            const meta = getDisabilityMeta(p.disability_type);
                            return (
                              <div className="space-y-1">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold border ${meta.badgeClass}`}
                                  title={meta.needsSummary}
                                >
                                  {meta.key !== 'none' && <Accessibility className="w-3 h-3 shrink-0" />}
                                  {meta.shortLabel}
                                </span>
                                <span className="block text-[10px] text-slate-400">
                                  {meta.skipAntiCheat ? 'Bebas cek pindah tab' : 'Deteksi tab aktif'}
                                </span>
                                {p.disability_note && (
                                  <span className="block text-[10px] text-indigo-700 italic max-w-[170px] break-words">
                                    "{p.disability_note}"
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* Paket Soal yang Ditugaskan */}
                        <td className="py-3.5 px-4 align-top">
                          <span className="inline-block px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 leading-snug break-words max-w-[140px]">
                            {p.paket || '-'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 align-top">
                          <span className={`inline-block px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                            p.status === 'submitted'
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.status === 'in_progress'
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {p.status === 'submitted' ? 'Selesai' : p.status === 'in_progress' ? 'Ujian' : 'Siap'}
                          </span>
                        </td>

                        {/* Aksi: Edit & Hapus */}
                        <td className="py-3.5 px-4 text-center align-top">
                          <div className="flex items-center justify-center gap-1.5 mt-0.5">
                            <button
                              onClick={() => handleOpenEdit(p)}
                              className="p-1.5 rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition border border-emerald-200"
                              title="Edit Data Peserta"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(p.participant_id)}
                              className="p-1.5 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 transition border border-rose-200"
                              title="Hapus Peserta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal Hapus Semua Peserta */}
      {showDeleteAllModal && (
        <Modal
          isOpen={showDeleteAllModal}
          onClose={() => setShowDeleteAllModal(false)}
          title="Konfirmasi Hapus Seluruh Data Peserta"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-900">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>PERINGATAN: Tindakan Ini Permanen!</span>
              </div>
              <p>
                Anda akan menghapus seluruh data peserta (<strong>{participants.length} orang</strong>). Pastikan Anda telah mengunduh file cadangan data Excel terlebih dahulu agar data tidak hilang.
              </p>
            </div>

            <div className="pt-1">
              <Button
                variant="secondary"
                size="sm"
                icon={Download}
                onClick={handleExportBackup}
                className="w-full border-emerald-300 text-emerald-800 hover:bg-emerald-50 mb-3"
              >
                Unduh Cadangan Excel Sebelum Hapus
              </Button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Ketik <span className="text-rose-600 font-mono">HAPUS SEMUA</span> untuk mengonfirmasi:
              </label>
              <input
                type="text"
                value={deleteAllInput}
                onChange={(e) => setDeleteAllInput(e.target.value)}
                placeholder="HAPUS SEMUA"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold tracking-wider text-rose-700 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowDeleteAllModal(false)}
              >
                Batal
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                disabled={deleteAllInput.trim() !== 'HAPUS SEMUA' || isDeletingAll}
                onClick={handleDeleteAll}
                icon={Trash2}
              >
                {isDeletingAll ? 'Menghapus...' : 'Ya, Hapus Semua'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

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
              Kolom wajib: <code>No, Username, Password, Nama_Lengkap, Jenis_Kelamin, NIP_NIM, Kelas, Asal_Madrasah_Sekolah</code>. Kolom opsional baru: <code>Keterangan_Disabilitas, Catatan_Kebutuhan_Khusus</code>.
            </p>
            <p className="text-emerald-800">
              Jika <strong>Jenis_Kelamin</strong> dikosongkan pada Excel, sistem otomatis mengisinya dengan tanda strip (<strong>-</strong>).
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
                        {item.kelas && item.kelas !== '-' && (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            {item.kelas}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700 font-semibold text-[10px]">
                          {item.gender || '-'}
                        </span>
                      </div>
                      <span className="text-slate-400 text-[11px] block mt-0.5">
                        User: <strong className="text-slate-700">{item.username}</strong> • Pass: <strong className="text-slate-700">{item.password || 'kemenag2026'}</strong> • {item.institution || '-'}
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

      {/* Modal Tambah Peserta Manual (Tanpa Field Paket/Tugas) */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Tambah Data Peserta Manual"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveParticipant} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Username Login</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Contoh: peserta01"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password Login</label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Default: kemenag2026"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Contoh: Nama Peserta Lengkap"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kelas</label>
              <input
                type="text"
                list="modal-classes-datalist"
                value={form.kelas}
                onChange={(e) => setForm({ ...form, kelas: e.target.value })}
                placeholder="Ketik/Pilih Kelas"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
              />
              <datalist id="modal-classes-datalist">
                {dynamicClasses.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              >
                <option value="-">- (Belum Ditentukan)</option>
                <option value="Laki-Laki">Laki-Laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">NIP / NIM</label>
              <input
                type="text"
                value={form.identifier}
                onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                placeholder="Nomor Identitas (Opsional)"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Asal Madrasah / Sekolah</label>
              <input
                type="text"
                value={form.institution}
                onChange={(e) => setForm({ ...form, institution: e.target.value })}
                placeholder="Instansi / Madrasah"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
          </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Accessibility className="w-4 h-4 text-indigo-600" />
                  Keterangan Disabilitas & Penyesuaian Ujian
                </label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-200">
                  {getDisabilityMeta(form.disability_type).skipAntiCheat ? 'Tanpa Peringatan Tab' : 'Anti-Cheat Aktif'}
                </span>
              </div>

              <select
                value={form.disability_type}
                onChange={(e) => setForm({ ...form, disability_type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-xs font-bold text-slate-800"
              >
                {DISABILITY_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>

              <p className="text-[11px] text-indigo-900 leading-relaxed">
                {getDisabilityMeta(form.disability_type).needsSummary}
              </p>

              <input
                type="text"
                value={form.disability_note}
                onChange={(e) => setForm({ ...form, disability_note: e.target.value })}
                placeholder="Catatan khusus (opsional), misal: Pakai NVDA / butuh font 24px"
                className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-xs"
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

      {/* Modal Edit Peserta (Tanpa Field Paket/Tugas) */}
      {showEditModal && editingParticipant && (
        <Modal
          isOpen={showEditModal}
          onClose={() => { setShowEditModal(false); setEditingParticipant(null); }}
          title="Edit Data Peserta Ujian"
        >
          <form onSubmit={handleUpdateParticipant} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Username Login</label>
                <input
                  type="text"
                  value={editingParticipant.username}
                  onChange={(e) => setEditingParticipant({ ...editingParticipant, username: e.target.value })}
                  placeholder="Contoh: peserta01"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="text"
                  value={editingParticipant.password}
                  onChange={(e) => setEditingParticipant({ ...editingParticipant, password: e.target.value })}
                  placeholder="Password"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
              <input
                type="text"
                value={editingParticipant.full_name}
                onChange={(e) => setEditingParticipant({ ...editingParticipant, full_name: e.target.value })}
                placeholder="Nama Lengkap Peserta"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kelas</label>
                <input
                  type="text"
                  list="edit-classes-datalist"
                  value={editingParticipant.kelas}
                  onChange={(e) => setEditingParticipant({ ...editingParticipant, kelas: e.target.value })}
                  placeholder="Ketik/Pilih Kelas"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                />
                <datalist id="edit-classes-datalist">
                  {dynamicClasses.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
                <select
                  value={editingParticipant.gender}
                  onChange={(e) => setEditingParticipant({ ...editingParticipant, gender: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                >
                  <option value="-">- (Belum Ditentukan)</option>
                  <option value="Laki-Laki">Laki-Laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">NIP / NIM</label>
                <input
                  type="text"
                  value={editingParticipant.identifier}
                  onChange={(e) => setEditingParticipant({ ...editingParticipant, identifier: e.target.value })}
                  placeholder="Nomor Identitas (Opsional)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status Ujian</label>
                <select
                  value={editingParticipant.status}
                  onChange={(e) => setEditingParticipant({ ...editingParticipant, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                >
                  <option value="registered">Siap / Belum Mulai (registered)</option>
                  <option value="in_progress">Sedang Ujian (in_progress)</option>
                  <option value="submitted">Sudah Selesai (submitted)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Asal Madrasah / Sekolah</label>
              <input
                type="text"
                value={editingParticipant.institution}
                onChange={(e) => setEditingParticipant({ ...editingParticipant, institution: e.target.value })}
                placeholder="Instansi / Madrasah"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Accessibility className="w-4 h-4 text-indigo-600" />
                  Keterangan Disabilitas & Penyesuaian Ujian
                </label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-200">
                  {getDisabilityMeta(editingParticipant.disability_type).skipAntiCheat ? 'Tanpa Peringatan Tab' : 'Anti-Cheat Aktif'}
                </span>
              </div>

              <select
                value={editingParticipant.disability_type || 'none'}
                onChange={(e) => setEditingParticipant({ ...editingParticipant, disability_type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-xs font-bold text-slate-800"
              >
                {DISABILITY_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>

              <p className="text-[11px] text-indigo-900 leading-relaxed">
                {getDisabilityMeta(editingParticipant.disability_type).needsSummary}
              </p>

              <input
                type="text"
                value={editingParticipant.disability_note || ''}
                onChange={(e) => setEditingParticipant({ ...editingParticipant, disability_note: e.target.value })}
                placeholder="Catatan kebutuhan khusus peserta (opsional)"
                className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-xs"
              />
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => { setShowEditModal(false); setEditingParticipant(null); }}
              >
                Batal
              </Button>
              <Button variant="primary" type="submit" className="flex-1">
                Simpan Perubahan
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Panduan Konsep & Matriks Kebutuhan Disabilitas */}
      <Modal
        isOpen={showDisabilityGuideModal}
        onClose={() => setShowDisabilityGuideModal(false)}
        title="Konsep Akomodasi & Penyesuaian Ujian Penyandang Disabilitas"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-3 text-xs max-h-[75vh] overflow-y-auto pr-1">
          <p className="text-slate-600 leading-relaxed bg-indigo-50 p-3 rounded-2xl border border-indigo-200">
            Setiap peserta yang ditandai sebagai <strong>Penyandang Disabilitas</strong> otomatis dibebaskan dari peringatan pelanggaran pindah tab/blur (agar pembaca layar, magnifier, keyboard bantu, dan alat aksesibilitas tidak terblokir) serta menerima tampilan UI & fasilitas ujian yang disesuaikan:
          </p>
          <div className="grid grid-cols-1 gap-3">
            {DISABILITY_CATEGORIES.map((cat) => (
              <div key={cat.key} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`px-2.5 py-0.5 rounded-xl font-bold text-[11px] border ${cat.badgeClass}`}>
                    {cat.label}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600">
                    {cat.extraTimeLabel} • {cat.skipAntiCheat ? 'Tanpa Peringatan Tab' : 'Peringatan Tab Aktif'}
                  </span>
                </div>
                <p className="text-slate-600">{cat.needsSummary}</p>
                <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-0.5 pt-1">
                  {cat.accommodations.map((acc, i) => (
                    <li key={i}>{acc}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
};
