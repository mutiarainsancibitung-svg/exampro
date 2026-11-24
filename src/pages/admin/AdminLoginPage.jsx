import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { HeaderBar } from '../../components/layout/HeaderBar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Lock, User, ShieldCheck, Sparkles, ArrowLeft, AlertCircle, KeyRound, Eye, EyeOff, GraduationCap, Eye as EyeIcon } from 'lucide-react';

export const AdminLoginPage = () => {
  const navigate = useNavigate();
  const { loginAdmin } = useAuth();

  const [loginMode, setLoginMode] = useState('account'); // 'account' atau 'pin'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    setLoading(true);
    try {
      let res;
      if (loginMode === 'account') {
        if (!username.trim() || !password.trim()) {
          setError('Silakan isi username dan password admin.');
          setLoading(false);
          return;
        }
        res = await gasApi.adminLogin({ username: username.trim(), password: password.trim() });
      } else {
        if (!secretKey.trim()) {
          setError('Silakan masukkan Secret Key / PIN Admin.');
          setLoading(false);
          return;
        }
        res = await gasApi.adminLogin(secretKey.trim());
      }

      if (res.status === 'success') {
        loginAdmin(res.secretKey || 'admin123', res.user);
        navigate('/admin/dashboard');
      } else {
        setError(res.message || 'Kredensial login admin tidak sesuai.');
      }
    } catch (err) {
      setError(err.message || 'Gagal login.');
    } finally {
      setLoading(false);
    }
  };

  const fillAccount = (u, p) => {
    setLoginMode('account');
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-mint-grid">
      <HeaderBar />

      <main className="flex-1 flex items-center justify-center p-4 my-auto">
        <div className="w-full max-w-md space-y-5">
          <Card className="p-8 md:p-9 bg-white rounded-3xl shadow-xl shadow-kemenag-900/5 border border-kemenag-100 space-y-5">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-kemenag-50 text-kemenag-700 border border-kemenag-200 shadow-sm">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                Panel Pengajar & Admin
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Pilih atau masukkan akun sesuai peran (Role) Anda
              </p>
            </div>

            {/* Toggle Mode Login: Akun / PIN */}
            <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => { setLoginMode('account'); setError(''); }}
                className={`flex-1 py-2 rounded-xl transition ${
                  loginMode === 'account'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Login Akun & Role
              </button>
              <button
                type="button"
                onClick={() => { setLoginMode('pin'); setError(''); }}
                className={`flex-1 py-2 rounded-xl transition ${
                  loginMode === 'pin'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                PIN / Secret Key
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {loginMode === 'account' ? (
                <>
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
                </>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Secret Key / Master PIN Admin
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      placeholder="Masukkan PIN Admin (default: admin123)"
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-kemenag-600 focus:ring-2 focus:ring-kemenag-100 text-sm font-medium"
                      required
                    />
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  </div>
                </div>
              )}

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

            {/* Quick Demo Role Logins */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block text-center">
                Pilih Akun Demo Cepat:
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => fillAccount('admin', 'admin123')}
                  className="flex items-center justify-between p-2 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 text-emerald-900 text-xs font-semibold transition"
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <strong>Super Admin:</strong> @admin
                  </span>
                  <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-lg font-bold">
                    admin123
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => fillAccount('dosen_pai', 'dosen123')}
                  className="flex items-center justify-between p-2 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-50 text-blue-900 text-xs font-semibold transition"
                >
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-blue-700" />
                    <strong>Pengajar / Dosen:</strong> @dosen_pai
                  </span>
                  <span className="text-[10px] bg-blue-200/80 text-blue-900 px-2 py-0.5 rounded-lg font-bold">
                    dosen123
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => fillAccount('pengawas01', 'awas123')}
                  className="flex items-center justify-between p-2 rounded-xl border border-purple-200 bg-purple-50/60 hover:bg-purple-50 text-purple-900 text-xs font-semibold transition"
                >
                  <span className="flex items-center gap-1.5">
                    <EyeIcon className="w-4 h-4 text-purple-700" />
                    <strong>Pengawas Ujian:</strong> @pengawas01
                  </span>
                  <span className="text-[10px] bg-purple-200/80 text-purple-900 px-2 py-0.5 rounded-lg font-bold">
                    awas123
                  </span>
                </button>
              </div>
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
