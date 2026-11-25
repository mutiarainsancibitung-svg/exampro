import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { HeaderBar } from '../../components/layout/HeaderBar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { Lock, User, ShieldCheck, ArrowLeft, AlertCircle, Eye, EyeOff } from 'lucide-react';

export const AdminLoginPage = () => {
  const navigate = useNavigate();
  const { loginAdmin } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Silakan masukkan username dan password admin.');
      return;
    }

    setLoading(true);
    try {
      const res = await gasApi.adminLogin({
        username: username.trim(),
        password: password.trim()
      });

      if (res.status === 'success') {
        loginAdmin(res.secretKey || 'admin123', res.user);
        navigate('/admin/dashboard');
      } else {
        setError(res.message || 'Username atau password admin salah.');
      }
    } catch (err) {
      setError(err.message || 'Gagal login ke panel admin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-mint-grid">
      {/* Loading Overlay saat memverifikasi kredensial */}
      {loading && (
        <LoadingScreen
          fullScreen
          message="Memverifikasi Akses Admin..."
          submessage="Sedang memeriksa hak akses dan kredensial Anda di server FITK UIN Jakarta..."
        />
      )}

      <HeaderBar />

      <main className="flex-1 flex items-center justify-center p-4 my-auto">
        <div className="w-full max-w-md space-y-5">
          <Card className="p-8 md:p-9 bg-white rounded-3xl shadow-xl shadow-kemenag-900/5 border border-kemenag-100 space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-kemenag-50 text-kemenag-700 border border-kemenag-200 shadow-sm">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                Panel Pengajar & Admin
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Silakan login dengan Username dan Password Anda
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Username Admin
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Contoh: admin / dosen_pai"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-kemenag-600 focus:ring-2 focus:ring-kemenag-100 text-sm font-medium"
                    required
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-kemenag-600 focus:ring-2 focus:ring-kemenag-100 text-sm font-medium"
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-slate-400 hover:text-slate-600 absolute right-3 top-2.5"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full font-bold text-sm shadow-md py-3"
                disabled={loading}
              >
                {loading ? 'Memverifikasi...' : 'Masuk Panel Admin'}
              </Button>
            </form>

            {/* Catatan Keamanan Panel Admin */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="text-[11px] text-slate-400">
                Akses khusus staf penguji & panitia FITK
              </span>
              <a
                href="/"
                className="text-slate-500 hover:text-kemenag-700 font-semibold transition"
              >
                &larr; Masuk Peserta
              </a>
            </div>
          </Card>

          <div className="text-center">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-kemenag-700 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Halaman Masuk Peserta
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};
