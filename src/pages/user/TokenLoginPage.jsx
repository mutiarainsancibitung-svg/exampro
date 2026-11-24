import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { HeaderBar } from '../../components/layout/HeaderBar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { User, Lock, Eye, EyeOff, RotateCw, AlertCircle, Sparkles } from 'lucide-react';

export const TokenLoginPage = () => {
  const navigate = useNavigate();
  const { loginParticipant } = useAuth();

  // Tahap pengerjaan: 1 = Login (Gambar 1), 2 = Konfirmasi Data Peserta (Gambar 3)
  const [stage, setStage] = useState(1);

  // Form Tahap 1: Login Awal
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form Tahap 2: Konfirmasi Data Peserta
  const [gender, setGender] = useState('Laki-Laki');
  const [confirmFullName, setConfirmFullName] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [tokenInput, setTokenInput] = useState('');

  // Info Sesi Aktif
  const [activeSession, setActiveSession] = useState(null);
  const [sessionToken, setSessionToken] = useState('TOT2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Muat sesi default jika ada
  useEffect(() => {
    loadDefaultSession();
  }, []);

  const loadDefaultSession = async () => {
    try {
      const res = await gasApi.getSession(sessionToken);
      if (res.status === 'success') {
        setActiveSession(res.session);
        setSessionToken(res.session.token || 'TOT2026');
      }
    } catch (e) {
      // Fallback sesi lokal
      setActiveSession({
        title: 'Pretest Pelatihan Guru PAI (Paket 1)',
        token: 'TOT2026',
        duration_minutes: 60
      });
    }
  };

  // Handler Tahap 1: Login
  const handleStage1Login = (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Silakan masukkan username dan password Anda.');
      return;
    }

    // Default nama peserta jika belum diisi
    if (!confirmFullName) {
      setConfirmFullName(username.toUpperCase() + ' - PESERTA PAI');
    }

    // Berpindah ke Tahap 2: Konfirmasi Data Peserta
    setStage(2);
  };

  // Handler Tahap 2: Konfirmasi & Masuk Ujian
  const handleStage2Submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!confirmFullName.trim()) {
      setError('Ketikkan Nama Peserta untuk konfirmasi identitas.');
      return;
    }

    if (!birthDay || !birthMonth || !birthYear) {
      setError('Harap lengkapi tanggal, bulan, dan tahun lahir.');
      return;
    }

    if (!tokenInput.trim()) {
      setError('Ketikkan Token Ujian yang diberikan oleh pengawas.');
      return;
    }

    setLoading(true);
    try {
      const birthDateStr = `${birthDay.padStart(2, '0')}-${birthMonth.padStart(2, '0')}-${birthYear}`;
      const res = await gasApi.startExam({
        token: tokenInput.trim().toUpperCase(),
        fullName: confirmFullName.trim(),
        identifier: username.trim(),
        gender: gender,
        birthDate: birthDateStr
      });

      if (res.status === 'success') {
        loginParticipant(
          {
            participantId: res.participantId,
            fullName: confirmFullName.trim(),
            identifier: username.trim(),
            gender: gender,
            birthDate: birthDateStr,
            token: tokenInput.trim().toUpperCase(),
            startTime: res.startTime
          },
          res.session
        );
        navigate('/exam');
      } else {
        setError(res.message || 'Token ujian tidak valid atau sesi belum dibuka.');
      }
    } catch (err) {
      setError(err.message || 'Gagal memulai ujian. Periksa kembali token Anda.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo Autofill
  const fillDemoAccount = () => {
    setUsername('guru_pai_01');
    setPassword('kemenag2026');
    setConfirmFullName('Drs. H. Ahmad Fauzi, M.Pd');
    setGender('Laki-Laki');
    setBirthDay('15');
    setBirthMonth('08');
    setBirthYear('1985');
    setTokenInput('TOT2026');
    setError('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-mint-grid">
      {/* Top Header Bar dengan Logo Kemenag RI & UIN Jakarta */}
      <HeaderBar
        participantInfo={stage === 2 ? { username, fullName: confirmFullName } : null}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        {/* ========================================================= */}
        {/* TAHAP 1: FORM LOGIN AWAL (SESUAI GAMBAR 1)                 */}
        {/* ========================================================= */}
        {stage === 1 && (
          <div className="w-full max-w-md my-auto">
            <Card className="p-8 md:p-10 bg-white rounded-3xl shadow-xl shadow-kemenag-900/5 border border-kemenag-100 space-y-6">
              <div className="space-y-1.5">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">
                  Selamat Datang
                </h2>
                <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
                  Silakan login dengan menggunakan username dan password yang anda miliki
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleStage1Login} className="space-y-5">
                {/* Input Username */}
                <div>
                  <div className="relative border-b-2 border-slate-200 focus-within:border-kemenag-600 transition-colors pb-1 flex items-center gap-3">
                    <User className="w-5 h-5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username"
                      className="w-full py-2 bg-transparent text-sm text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium"
                      required
                    />
                  </div>
                </div>

                {/* Input Password */}
                <div>
                  <div className="relative border-b-2 border-slate-200 focus-within:border-kemenag-600 transition-colors pb-1 flex items-center gap-3">
                    <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full py-2 bg-transparent text-sm text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium pr-8"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Tombol Login Biru / Hijau PAI */}
                <Button
                  type="submit"
                  variant="blue"
                  size="lg"
                  className="w-full rounded-2xl font-bold text-sm shadow-md shadow-blue-200 py-3.5"
                >
                  Login
                </Button>
              </form>

              {/* Shortcut Akun Demo */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={fillDemoAccount}
                  className="inline-flex items-center gap-1.5 text-kemenag-700 hover:text-kemenag-900 font-semibold"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Isi Akun Demo Otomatis
                </button>

                <a
                  href="/admin/login"
                  className="text-slate-400 hover:text-kemenag-700 font-medium transition"
                >
                  Panel Pengajar &rarr;
                </a>
              </div>
            </Card>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAHAP 2: KONFIRMASI DATA PESERTA (SESUAI GAMBAR 3)         */}
        {/* ========================================================= */}
        {stage === 2 && (
          <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-6 items-start my-auto">
            {/* Kolom Kiri: Kartu Rilis Token (Sesuai Gambar 3 Kiri) */}
            <div className="md:col-span-5 space-y-4">
              <Card className="p-5 md:p-6 bg-white rounded-3xl shadow-lg shadow-kemenag-900/5 border border-kemenag-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">Token :</span>
                  <span className="font-mono text-xl font-extrabold text-kemenag-700 tracking-wider">
                    {sessionToken}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={loadDefaultSession}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </Card>

              {/* Info Panduan PAI */}
              <Card className="p-5 bg-kemenag-50/70 border border-kemenag-200 rounded-3xl text-xs text-kemenag-900 space-y-2">
                <h4 className="font-bold text-kemenag-800 text-sm">Petunjuk Pengisian:</h4>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>Pastikan nama peserta sesuai dengan data pendaftaran resmi.</li>
                  <li>Masukkan tanggal lahir dengan format 2 digit hari, 2 digit bulan, dan 4 digit tahun.</li>
                  <li>Salin Token di atas ke dalam kolom Token di samping, lalu klik <strong>Submit</strong>.</li>
                </ul>
                <button
                  onClick={() => setStage(1)}
                  className="text-xs font-semibold text-rose-600 hover:underline pt-2 block"
                >
                  &larr; Ganti Akun / Kembali ke Login
                </button>
              </Card>
            </div>

            {/* Kolom Kanan: Kartu Konfirmasi Data Peserta (Sesuai Gambar 3 Kanan) */}
            <div className="md:col-span-7">
              <Card className="p-6 md:p-8 bg-white rounded-3xl shadow-xl shadow-kemenag-900/5 border border-kemenag-100 space-y-5">
                <h3 className="text-xl font-bold text-slate-800 tracking-tight pb-2 border-b border-slate-100">
                  Konfirmasi data Peserta
                </h3>

                {error && (
                  <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleStage2Submit} className="space-y-4">
                  {/* Readonly: Username */}
                  <div className="border-b border-slate-100 pb-2">
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase">Username</label>
                    <span className="text-sm font-semibold text-slate-800">{username}</span>
                  </div>

                  {/* Readonly: Nama Peserta Status */}
                  <div className="border-b border-slate-100 pb-2">
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase">Nama Peserta</label>
                    <span className="text-sm font-semibold text-slate-800">{username} - PESERTA PAI</span>
                  </div>

                  {/* Jenis Kelamin */}
                  <div className="border-b border-slate-100 pb-2">
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Jenis Kelamin</label>
                    <div className="flex items-center gap-6 text-sm text-slate-700 font-medium">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="gender"
                          value="Laki-Laki"
                          checked={gender === 'Laki-Laki'}
                          onChange={() => setGender('Laki-Laki')}
                          className="text-kemenag-600 focus:ring-kemenag-500"
                        />
                        <span>Laki-Laki</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="gender"
                          value="Perempuan"
                          checked={gender === 'Perempuan'}
                          onChange={() => setGender('Perempuan')}
                          className="text-kemenag-600 focus:ring-kemenag-500"
                        />
                        <span>Perempuan</span>
                      </label>
                    </div>
                  </div>

                  {/* Mata Ujian */}
                  <div className="border-b border-slate-100 pb-2">
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase">Mata Ujian</label>
                    <span className="text-sm font-bold text-kemenag-700">
                      {activeSession?.title || 'Pretest Pelatihan Guru PAI (Paket 1)'}
                    </span>
                  </div>

                  {/* Input Konfirmasi: Nama Peserta */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Peserta</label>
                    <input
                      type="text"
                      value={confirmFullName}
                      onChange={(e) => setConfirmFullName(e.target.value)}
                      placeholder="Ketikkan Nama Peserta"
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-sm text-slate-800 font-medium"
                      required
                    />
                  </div>

                  {/* Input: Tanggal Lahir (Hari, Bulan, Tahun - 3 Kotak) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Lahir</label>
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        maxLength={2}
                        value={birthDay}
                        onChange={(e) => setBirthDay(e.target.value)}
                        placeholder="Hari"
                        className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-600 text-center text-sm font-medium"
                        required
                      />
                      <input
                        type="text"
                        maxLength={2}
                        value={birthMonth}
                        onChange={(e) => setBirthMonth(e.target.value)}
                        placeholder="Bulan"
                        className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-600 text-center text-sm font-medium"
                        required
                      />
                      <input
                        type="text"
                        maxLength={4}
                        value={birthYear}
                        onChange={(e) => setBirthYear(e.target.value)}
                        placeholder="Tahun"
                        className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-600 text-center text-sm font-medium"
                        required
                      />
                    </div>
                  </div>

                  {/* Input: Token */}
                  <div>
                    <label className="block text-xs font-bold text-blue-600 mb-1">Token</label>
                    <input
                      type="text"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                      placeholder="Ketikkan token di sini"
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-sm font-mono font-bold tracking-wider uppercase text-slate-800"
                      required
                    />
                  </div>

                  {/* Tombol Submit */}
                  <Button
                    type="submit"
                    variant="blue"
                    size="lg"
                    className="w-full rounded-2xl font-bold text-sm shadow-md shadow-blue-200 py-3 mt-2"
                    disabled={loading}
                  >
                    {loading ? 'Memvalidasi...' : 'Submit'}
                  </Button>
                </form>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
