import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { HeaderBar } from '../../components/layout/HeaderBar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Lock, ShieldCheck, Sparkles, ArrowLeft, AlertCircle } from 'lucide-react';

export const AdminLoginPage = () => {
  const navigate = useNavigate();
  const { loginAdmin } = useAuth();
  const [secretKey, setSecretKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!secretKey.trim()) {
      setError('Masukkan Secret Key / PIN Admin.');
      return;
    }

    setLoading(true);
    try {
      const res = await gasApi.adminLogin(secretKey.trim());
      if (res.status === 'success') {
        loginAdmin(secretKey.trim());
        navigate('/admin/dashboard');
      } else {
        setError(res.message || 'Secret Key salah.');
      }
    } catch (err) {
      setError(err.message || 'Gagal login.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoPin = () => {
    setSecretKey('admin123');
    setError('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-mint-grid">
      <HeaderBar />

      <main className="flex-1 flex items-center justify-center p-4 my-auto">
        <div className="w-full max-w-md space-y-6">
          <Card className="p-8 md:p-10 bg-white rounded-3xl shadow-xl shadow-kemenag-900/5 border border-kemenag-100 space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-kemenag-50 text-kemenag-700 border border-kemenag-200 shadow-sm">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">
                Panel Pengajar / Admin
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Sistem Evaluasi Pelatihan Guru PAI - FITK UIN Jakarta
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
                  Secret Key / PIN Admin
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="Masukkan PIN Admin"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-kemenag-600 focus:ring-2 focus:ring-kemenag-100 text-sm font-medium"
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full font-bold text-sm shadow-md py-3"
                disabled={loading}
              >
                {loading ? 'Memverifikasi...' : 'Masuk Dashboard'}
              </Button>
            </form>

            <div className="pt-2 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={fillDemoPin}
                className="inline-flex items-center gap-1.5 text-xs text-kemenag-700 hover:text-kemenag-900 font-semibold py-1 px-2 rounded-xl hover:bg-kemenag-50 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Gunakan PIN Demo: admin123
              </button>
            </div>
          </Card>

          <div className="text-center">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-kemenag-700 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Halaman Peserta
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};
