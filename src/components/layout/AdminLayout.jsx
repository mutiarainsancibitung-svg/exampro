import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Award,
  LogOut,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Sliders,
  Database
} from 'lucide-react';

export const AdminLayout = ({ children, title }) => {
  const { logoutAdmin, adminUser, adminRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutAdmin();
    navigate('/admin/login');
  };

  const roleMeta = {
    superadmin: {
      label: 'Super Admin',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      dotClass: 'bg-emerald-500'
    },
    instructor: {
      label: 'Pengajar / Dosen',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      dotClass: 'bg-amber-500'
    },
    proctor: {
      label: 'Pengawas Ujian',
      badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
      dotClass: 'bg-sky-500'
    }
  };

  const currentRole = adminRole || 'superadmin';
  const roleInfo = roleMeta[currentRole] || roleMeta.superadmin;

  // Navigasi berbasis RBAC (Role-Based Access Control)
  const allNavItems = [
    { label: 'Dashboard & Sesi', path: '/admin/dashboard', icon: LayoutDashboard, roles: ['superadmin', 'instructor', 'proctor'] },
    { label: 'Atur Ujian & Mata Ujian', path: '/admin/exam-setup', icon: Sliders, roles: ['superadmin', 'instructor'] },
    { label: 'Bank Soal & Excel', path: '/admin/questions', icon: BookOpen, roles: ['superadmin', 'instructor'] },
    { label: 'Data Peserta & Excel', path: '/admin/participants', icon: Users, roles: ['superadmin', 'instructor', 'proctor'] },
    { label: 'Rekap Nilai & Essay', path: '/admin/results', icon: Award, roles: ['superadmin', 'instructor'] },
    { label: 'Cadangan & Pemulihan', path: '/admin/backup-restore', icon: Database, roles: ['superadmin'] },
    { label: 'Kelola Admin & Role', path: '/admin/users', icon: ShieldCheck, roles: ['superadmin'] }
  ];

  const navItems = allNavItems.filter((item) => item.roles.includes(currentRole));

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-mint-grid">
      {/* Sidebar Desktop */}
      <aside className="w-full md:w-64 bg-white border-r border-kemenag-100 flex flex-col shrink-0 shadow-sm">
        <div className="p-5 border-b border-kemenag-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Logo Kemenag RI & UIN Jakarta */}
            <img
              src="/Logo_Kemenag.png"
              alt="Logo Kemenag"
              className="w-8 h-8 object-contain shrink-0"
            />
            <img
              src="/Logo_UIN.png"
              alt="Logo UIN"
              className="w-8 h-8 object-contain shrink-0"
            />
            <div>
              <h1 className="font-extrabold text-slate-800 text-sm leading-tight">Guru PAI CBT</h1>
              <span className="text-[10px] font-bold tracking-wider text-kemenag-700 uppercase">FITK UIN JAKARTA</span>
            </div>
          </div>
        </div>

        {/* Profil Admin yang Sedang Aktif */}
        <div className="p-4 mx-3 my-3 bg-kemenag-50/70 border border-kemenag-200/60 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-kemenag-600 text-white font-black flex items-center justify-center text-sm shadow-sm shrink-0">
              {(adminUser?.name || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-800 text-xs truncate">
                {adminUser?.name || 'Administrator'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono truncate">
                @{adminUser?.username || 'admin'}
              </div>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleInfo.badgeClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${roleInfo.dotClass}`}></span>
              {roleInfo.label}
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-emerald-600" /> Aktif
            </span>
          </div>
        </div>

        {/* Menu Navigasi Berdasarkan Role */}
        <nav className="px-3 py-2 space-y-1 flex-1">
          <div className="px-3 pb-1 text-[10px] font-bold tracking-wider uppercase text-slate-400">
            Menu Navigasi
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-kemenag-600 text-white shadow-sm shadow-kemenag-200'
                    : 'text-slate-600 hover:bg-kemenag-50 hover:text-kemenag-800'
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-kemenag-100 space-y-2">
          <NavLink
            to="/"
            target="_blank"
            className="flex items-center justify-between px-3.5 py-2 rounded-2xl text-xs text-slate-500 hover:bg-kemenag-50 transition"
          >
            <span>Halaman Masuk Peserta</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </NavLink>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
          >
            <LogOut className="w-4 h-4" />
            Keluar Panel Admin
          </button>
        </div>
      </aside>

      {/* Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/90 backdrop-blur border-b border-kemenag-100 px-6 py-4 flex items-center justify-between shadow-sm">
          <div>
            <h2 className="font-bold text-slate-800 text-lg leading-tight">{title || 'Dashboard'}</h2>
            <p className="text-xs text-slate-500">Panel Manajemen Ujian Terpadu CBT FITK UIN Jakarta</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${roleInfo.badgeClass}`}>
              <span className={`w-2 h-2 rounded-full ${roleInfo.dotClass}`}></span>
              {roleInfo.label}: {adminUser?.name || 'Administrator'}
            </span>
            <span className="text-xs px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
              Terhubung Google Workspace
            </span>
          </div>
        </header>

        <main className="p-6 md:p-8 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
