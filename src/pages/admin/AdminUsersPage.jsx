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
  ShieldCheck,
  UserPlus,
  Trash2,
  Edit3,
  Search,
  Check,
  AlertCircle,
  GraduationCap,
  Eye,
  EyeOff,
  Lock,
  User,
  KeyRound,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

export const AdminUsersPage = () => {
  const { adminSecretKey, adminUser, adminRole, isAdminLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});

  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    role: 'instructor',
    is_active: true
  });

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
        setAdmins(res.admins || []);
      }
    } catch (err) {
      console.error('Gagal memuat data admin:', err);
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (adminId) => {
    setShowPasswords(prev => ({ ...prev, [adminId]: !prev[adminId] }));
  };

  // Simpan Admin Baru
  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim() || !form.name.trim()) {
      alert('Nama, Username, dan Password wajib diisi!');
      return;
    }

    try {
      await gasApi.saveAdminUser(adminSecretKey, {
        username: form.username.trim().toLowerCase(),
        password: form.password.trim(),
        name: form.name.trim(),
        role: form.role,
        is_active: form.is_active
      });
      setShowAddModal(false);
      setForm({
        username: '',
        password: '',
        name: '',
        role: 'instructor',
        is_active: true
      });
      loadData();
      alert('Pengguna admin baru berhasil ditambahkan!');
    } catch (err) {
      alert('Gagal menambah admin: ' + err.message);
    }
  };

  // Update Admin
  const handleUpdateAdmin = async (e) => {
    e.preventDefault();
    if (!editingAdmin) return;

    try {
      await gasApi.saveAdminUser(adminSecretKey, editingAdmin);
      setShowEditModal(false);
      setEditingAdmin(null);
      loadData();
      alert('Data pengguna admin berhasil diperbarui!');
    } catch (err) {
      alert('Gagal memperbarui admin: ' + err.message);
    }
  };

  // Toggle Status Aktif / Nonaktif
  const handleToggleStatus = async (admin) => {
    try {
      await gasApi.saveAdminUser(adminSecretKey, {
        ...admin,
        is_active: !admin.is_active
      });
      loadData();
    } catch (err) {
      alert('Gagal mengubah status: ' + err.message);
    }
  };

  // Hapus Admin
  const handleDeleteAdmin = async (adminId) => {
    if (adminUser?.admin_id === adminId) {
      alert('Anda tidak dapat menghapus akun yang sedang Anda gunakan untuk login!');
      return;
    }

    const superAdminCount = admins.filter(a => a.role === 'superadmin').length;
    const target = admins.find(a => a.admin_id === adminId);
    if (target?.role === 'superadmin' && superAdminCount <= 1) {
      alert('Tidak dapat menghapus Super Admin terakhir pada sistem.');
      return;
    }

    if (!window.confirm(`Yakin ingin menghapus pengguna admin "${target?.name || adminId}"?`)) {
      return;
    }

    try {
      await gasApi.deleteAdminUser(adminSecretKey, adminId);
      loadData();
      alert('Pengguna admin berhasil dihapus.');
    } catch (err) {
      alert('Gagal menghapus admin: ' + err.message);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'superadmin':
        return {
          label: 'Super Admin',
          icon: ShieldCheck,
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200'
        };
      case 'instructor':
        return {
          label: 'Pengajar / Dosen',
          icon: GraduationCap,
          className: 'bg-blue-50 text-blue-800 border-blue-200'
        };
      case 'proctor':
        return {
          label: 'Pengawas Ujian',
          icon: Eye,
          className: 'bg-purple-50 text-purple-800 border-purple-200'
        };
      default:
        return {
          label: role || 'Admin',
          icon: ShieldCheck,
          className: 'bg-slate-50 text-slate-700 border-slate-200'
        };
    }
  };

  const filteredAdmins = admins.filter(a => {
    const matchSearch =
      (a.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.username || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = filterRole === 'ALL' || a.role === filterRole;
    return matchSearch && matchRole;
  });

  if (loading) {
    return (
      <AdminLayout title="Manajemen Pengguna Admin & Hak Akses (Role)">
        <LoadingScreen
          message="Memuat Pengguna Admin..."
          submessage="Sedang mengambil data akun staf, penguji, dan konfigurasi hak akses..."
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Manajemen Pengguna Admin & Hak Akses (Role)">
      <div className="space-y-6">

        {/* Ringkasan Peran / Roles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 bg-white rounded-3xl border border-kemenag-100 shadow-sm flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-800 text-sm">Super Admin</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Akses penuh: Kelola akun admin, konfigurasi sesi, bank soal, penugasan peserta, & penilaian.
              </p>
            </div>
          </Card>

          <Card className="p-5 bg-white rounded-3xl border border-kemenag-100 shadow-sm flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-blue-50 text-blue-700">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-800 text-sm">Pengajar / Dosen</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Fokus pedagogis: Mengelola bank soal, menentukan paket ujian per kelas, & mengoreksi jawaban esai.
              </p>
            </div>
          </Card>

          <Card className="p-5 bg-white rounded-3xl border border-kemenag-100 shadow-sm flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-purple-50 text-purple-700">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-800 text-sm">Pengawas Ujian (Proctor)</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Integritas CBT: Memantau token berputar 1 menit, kehadiran, status pengerjaan, & pelanggaran anti-cheat.
              </p>
            </div>
          </Card>
        </div>

        {/* Bar Filter & Tambah Admin */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-kemenag-100 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari Nama / Username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-2xl border border-slate-200 text-xs w-60 bg-slate-50 focus:bg-white focus:outline-none focus:border-kemenag-600 font-medium"
              />
            </div>

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-xs bg-slate-50 font-bold text-slate-700"
            >
              <option value="ALL">Semua Role</option>
              <option value="superadmin">Super Admin</option>
              <option value="instructor">Pengajar / Dosen</option>
              <option value="proctor">Pengawas Ujian</option>
            </select>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={UserPlus}
            onClick={() => setShowAddModal(true)}
          >
            Tambah Pengguna Admin
          </Button>
        </div>

        {/* Tabel Pengguna Admin */}
        <div className="bg-white rounded-3xl border border-kemenag-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-kemenag-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">
              Daftar Pengguna Panel Admin ({filteredAdmins.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            {filteredAdmins.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                Tidak ada pengguna admin yang cocok.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Nama Lengkap</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Password</th>
                    <th className="py-3 px-4">Peran (Role)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAdmins.map((adm, idx) => {
                    const badge = getRoleBadge(adm.role);
                    const isCurrentUser = adminUser?.admin_id === adm.admin_id;
                    const isPassVisible = showPasswords[adm.admin_id];

                    return (
                      <tr key={adm.admin_id || idx} className="hover:bg-kemenag-50/30 transition">
                        <td className="py-3.5 px-4 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800 block text-sm">
                            {adm.name}
                          </span>
                          {isCurrentUser && (
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg inline-block mt-0.5">
                              Akun Anda Saat Ini
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-kemenag-800 bg-kemenag-50 border border-kemenag-200 px-2 py-0.5 rounded-lg text-xs">
                            @{adm.username}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-700 font-medium">
                              {isPassVisible ? adm.password : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(adm.admin_id)}
                              className="text-slate-400 hover:text-slate-600 p-1"
                              title={isPassVisible ? 'Sembunyikan Password' : 'Lihat Password'}
                            >
                              {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-extrabold border ${badge.className}`}>
                            <badge.icon className="w-3.5 h-3.5" />
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => handleToggleStatus(adm)}
                            className="flex items-center gap-1 text-xs font-semibold"
                            title="Klik untuk mengubah status aktif"
                          >
                            {adm.is_active ? (
                              <span className="text-emerald-600 flex items-center gap-1">
                                <ToggleRight className="w-5 h-5" /> Aktif
                              </span>
                            ) : (
                              <span className="text-slate-400 flex items-center gap-1">
                                <ToggleLeft className="w-5 h-5" /> Nonaktif
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingAdmin(adm);
                                setShowEditModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-kemenag-700 rounded-xl hover:bg-kemenag-50 transition"
                              title="Edit Pengguna"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteAdmin(adm.admin_id)}
                              disabled={isCurrentUser}
                              className={`p-1.5 rounded-xl transition ${
                                isCurrentUser
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              }`}
                              title={isCurrentUser ? 'Tidak bisa menghapus akun sendiri' : 'Hapus Admin'}
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

      {/* Modal Tambah Admin */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Tambah Pengguna Admin Baru"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateAdmin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contoh: Dr. H. Muhammad Ilyas, M.Ag"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-medium"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Username Login</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Contoh: dosen_fikih"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Password admin"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Peran / Hak Akses (Role)</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800"
            >
              <option value="superadmin">Super Admin (Akses Penuh Seluruh Sistem)</option>
              <option value="instructor">Pengajar / Dosen (Bank Soal, Penugasan Paket, & Koreksi Esai)</option>
              <option value="proctor">Pengawas Ujian (Pantau Token, Kehadiran, & Anti-Cheat)</option>
            </select>
          </div>

          <div className="flex gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" className="flex-1" onClick={() => setShowAddModal(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" className="flex-1">
              Simpan Admin Baru
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit Admin */}
      {editingAdmin && (
        <Modal
          isOpen={showEditModal}
          onClose={() => { setShowEditModal(false); setEditingAdmin(null); }}
          title={`Edit Pengguna Admin: ${editingAdmin.name}`}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleUpdateAdmin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
              <input
                type="text"
                value={editingAdmin.name}
                onChange={(e) => setEditingAdmin({ ...editingAdmin, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Username Login</label>
                <input
                  type="text"
                  value={editingAdmin.username}
                  onChange={(e) => setEditingAdmin({ ...editingAdmin, username: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="text"
                  value={editingAdmin.password}
                  onChange={(e) => setEditingAdmin({ ...editingAdmin, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Peran / Hak Akses (Role)</label>
              <select
                value={editingAdmin.role}
                onChange={(e) => setEditingAdmin({ ...editingAdmin, role: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800"
              >
                <option value="superadmin">Super Admin (Akses Penuh Seluruh Sistem)</option>
                <option value="instructor">Pengajar / Dosen (Bank Soal, Penugasan Paket, & Koreksi Esai)</option>
                <option value="proctor">Pengawas Ujian (Pantau Token, Kehadiran, & Anti-Cheat)</option>
              </select>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <Button variant="secondary" className="flex-1" onClick={() => { setShowEditModal(false); setEditingAdmin(null); }}>
                Batal
              </Button>
              <Button variant="primary" type="submit" className="flex-1">
                Simpan Perubahan
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </AdminLayout>
  );
};
