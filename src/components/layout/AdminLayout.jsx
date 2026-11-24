import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, BookOpen, Users, Award, LogOut, ExternalLink } from 'lucide-react';

export const AdminLayout = ({ children, title }) => {
  const { logoutAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutAdmin();
    navigate('/admin/login');
  };

  const navItems = [
    { label: 'Dashboard & Sesi', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Bank Soal & Excel', path: '/admin/questions', icon: BookOpen },
    { label: 'Data Peserta & Excel', path: '/admin/participants', icon: Users },
    { label: 'Rekap Nilai & Essay', path: '/admin/results', icon: Award }
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-mint-grid">
      {/* Sidebar Desktop */}
      <aside className="w-full md:w-64 bg-white border-r border-kemenag-100 flex flex-col shrink-0 shadow-sm">
        <div className="p-6 border-b border-kemenag-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Logo Kemenag RI & UIN Jakarta dari file gambar lokal */}
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

        {/* Menu Navigasi */}
        <nav className="p-4 space-y-1.5 flex-1">
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
          <h2 className="font-bold text-slate-800 text-lg">{title || 'Dashboard'}</h2>
          <span className="text-xs px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
            Terhubung Google Workspace
          </span>
        </header>

        <main className="p-6 md:p-8 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
