import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { HeaderBar } from '../../components/layout/HeaderBar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { getMinuteRotatingToken, getSecondsRemainingInCurrentMinute } from '../../utils/rotatingToken';
import { User, Lock, Eye, EyeOff, RotateCw, AlertCircle, Clock } from 'lucide-react';

export const TokenLoginPage = () => {
  const navigate = useNavigate();
  const { loginParticipant } = useAuth();

  // Tahap pengerjaan: 1 = Login (Gambar 1), 2 = Konfirmasi Data Peserta (Gambar 3)
  const [stage, setStage] = useState(1);

  // Form Tahap 1: Login Awal
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form Tahap 2: Konfirmasi Data Peserta (Tanggal Lahir Dihapus Sesuai Permintaan)
  const [gender, setGender] = useState('Laki-Laki');
  const [confirmFullName, setConfirmFullName] = useState('');
  const [userKelas, setUserKelas] = useState('Kelas A');
  const [userPaket, setUserPaket] = useState('Pretest');
  const [tokenInput, setTokenInput] = useState('');

  // Info Sesi & Token Berputar Otomatis Setiap 1 Menit
  const [activeSession, setActiveSession] = useState(null);
  const [rotatingToken, setRotatingToken] = useState(() => getMinuteRotatingToken());
  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsRemainingInCurrentMinute());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Timer interval untuk memutar token setiap 60 detik (1 menit)
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = getSecondsRemainingInCurrentMinute();
      setSecondsLeft(remaining);

      // Setiap kali detik mencapai 60/0 (pergantian menit), perbarui token
      if (remaining === 60 || remaining === 59) {
        setRotatingToken(getMinuteRotatingToken(activeSession?.session_id || 'PAI_TOT'));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSession]);

  useEffect(() => {
    loadDefaultSession();
  }, []);

  const loadDefaultSession = async () => {
    try {
      const res = await gasApi.getSession('TOT2026');
      if (res.status === 'success') {
        setActiveSession(res.session);
        setRotatingToken(getMinuteRotatingToken(res.session.session_id || 'PAI_TOT'));
      }
    } catch (e) {
      setActiveSession({
        session_id: 'SES-001',
        title: 'Pretest Pelatihan Guru PAI (Paket 1)',
        token: 'TOT2026',
        duration_minutes: 60
      });
    }
  };

  const handleManualRefreshToken = () => {
    const refreshed = getMinuteRotatingToken(activeSession?.session_id || 'PAI_TOT');
    setRotatingToken(refreshed);
    setSecondsLeft(getSecondsRemainingInCurrentMinute());
  };

  // Handler Tahap 1: Login berdasarkan Akun yang Dibuat Admin
  const handleStage1Login = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Silakan masukkan username dan password Anda.');
      return;
    }

    setLoading(true);
    try {
      const res = await gasApi.participantLogin({
        username: username.trim(),
        password: password.trim()
      });

      if (res.status === 'success' && res.participant) {
        const p = res.participant;
        setConfirmFullName(p.full_name || username.toUpperCase() + ' - PESERTA PAI');
        setGender(p.gender || 'Laki-Laki');
        setUserKelas(p.kelas || 'Kelas A');
        setUserPaket(p.paket || 'Pretest');
        setStage(2);
      }
    } catch (err) {
      setError(err.message || 'Username atau password tidak cocok.');
    } finally {
      setLoading(false);
    }
  };

  // Handler Tahap 2: Konfirmasi & Masuk Ujian
  const handleStage2Submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!confirmFullName.trim()) {
      setError('Ketikkan Nama Peserta untuk konfirmasi identitas.');
      return;
    }

    if (!tokenInput.trim()) {
      setError('Ketikkan Token Ujian yang tertera di sebelah kiri.');
      return;
    }

    setLoading(true);
    try {
      const res = await gasApi.startExam({
        token: tokenInput.trim().toUpperCase(),
        fullName: confirmFullName.trim(),
        identifier: username.trim(),
        gender: gender,
        kelas: userKelas,
        paket: userPaket,
        sessionSalt: activeSession?.session_id || 'PAI_TOT'
      });

      if (res.status === 'success') {
        loginParticipant(
          {
            participantId: res.participantId,
            fullName: confirmFullName.trim(),
            identifier: username.trim(),
            gender: gender,
            kelas: userKelas,
            paket: userPaket,
            token: tokenInput.trim().toUpperCase(),
            startTime: res.startTime
          },
          res.session
        );
        navigate('/exam');
      } else {
        setError(res.message || 'Token ujian tidak sesuai atau sudah kadaluarsa.');
      }
    } catch (err) {
      setError(err.message || 'Gagal memulai ujian. Periksa kembali token Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-mint-grid">
      {/* Loading Overlay saat memverifikasi atau menyiapkan ujian */}
      {loading && (
        <LoadingScreen
          fullScreen
          message={stage === 1 ? 'Memverifikasi Akun Peserta...' : 'Menyiapkan Lembar Soal Ujian...'}
          submessage="Sedang memeriksa kredensial dan mengalokasikan paket soal CBT Anda..."
        />
      )}

      {/* Header Bar dengan Logo Asli Kemenag RI & UIN Jakarta */}
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

                <Button
                  type="submit"
                  variant="blue"
                  size="lg"
                  className="w-full rounded-2xl font-bold text-sm shadow-md shadow-blue-200 py-3.5"
                >
                  Login
                </Button>
              </form>
            </Card>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAHAP 2: KONFIRMASI DATA PESERTA (SESUAI GAMBAR 3)         */}
        {/* ========================================================= */}
        {stage === 2 && (
          <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-6 items-start my-auto">
            {/* Kolom Kiri: Kartu Rilis Token Dinamis 1 Menit (Sesuai Gambar 3) */}
            <div className="md:col-span-5 space-y-4">
              <Card className="p-5 md:p-6 bg-white rounded-3xl shadow-lg shadow-kemenag-900/5 border border-kemenag-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-slate-700">Token :</span>
                    <span className="font-mono text-2xl font-black text-kemenag-800 tracking-wider">
                      {rotatingToken}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleManualRefreshToken}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
                    title="Perbarui token sekarang"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Refresh
                  </button>
                </div>

                {/* Indikator Token Berputar Setiap 1 Menit */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span className="flex items-center gap-1 text-kemenag-700 font-medium">
                    <Clock className="w-3.5 h-3.5 text-kemenag-600" />
                    Token berputar setiap 1 menit
                  </span>
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                    Ganti dlm: {secondsLeft}s
                  </span>
                </div>
              </Card>

              {/* Info Panduan Peserta */}
              <Card className="p-5 bg-kemenag-50/70 border border-kemenag-200 rounded-3xl text-xs text-kemenag-900 space-y-2">
                <h4 className="font-bold text-kemenag-800 text-sm">Petunjuk Konfirmasi:</h4>
                <ul className="list-disc list-inside space-y-1 text-slate-600 leading-relaxed">
                  <li>Periksa kembali data nama dan mata ujian Anda.</li>
                  <li>Salin 6 digit Token di atas ke dalam kolom Token di samping.</li>
                  <li>Klik tombol <strong>Submit</strong> untuk memulai ujian.</li>
                </ul>
                <button
                  onClick={() => setStage(1)}
                  className="text-xs font-semibold text-rose-600 hover:underline pt-2 block"
                >
                  &larr; Ganti Akun / Kembali ke Login
                </button>
              </Card>
            </div>

            {/* Kolom Kanan: Kartu Konfirmasi Data Peserta (Tanpa Tanggal Lahir) */}
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

                  {/* Kelas & Paket yang Ditugaskan oleh Admin */}
                  <div className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase">Kelas</label>
                      <span className="text-xs font-extrabold px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 inline-block">
                        {userKelas}
                      </span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase">Paket Ujian</label>
                      <span className={`text-xs font-extrabold px-2.5 py-1 rounded-xl border inline-block uppercase ${
                        userPaket.toLowerCase().includes('post')
                          ? 'bg-purple-100 text-purple-900 border-purple-200'
                          : 'bg-amber-100 text-amber-900 border-amber-200'
                      }`}>
                        {userPaket}
                      </span>
                    </div>
                  </div>

                  {/* Mata Ujian */}
                  <div className="border-b border-slate-100 pb-2">
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase">Mata Ujian</label>
                    <span className="text-sm font-bold text-kemenag-700">
                      Pelatihan Guru PAI ({userPaket})
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

                  {/* Input: Token Dinamis */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-blue-600">Token</label>
                      <button
                        type="button"
                        onClick={() => setTokenInput(rotatingToken)}
                        className="text-[11px] text-blue-600 hover:underline font-semibold"
                      >
                        Salin Token Otomatis ({rotatingToken})
                      </button>
                    </div>
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
