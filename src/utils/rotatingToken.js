/**
 * Utilitas Token Ujian Berputar Otomatis Setiap 1 Menit (Time-Windowed Dynamic Token)
 * Sesuai Standar ANBK / PUSMENDIK CBT.
 */

// Karakter alfanumerik bebas ambiguitas (tanpa angka 0, 1, dan huruf O, I)
const TOKEN_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Menghasilkan token 6 digit berdasarkan menit saat ini
 * @param {string} sessionSalt - Kunci unik sesi (default: 'PAI_TOT')
 * @param {number} offsetMinutes - Geser menit (0 = menit ini, -1 = menit sebelumnya untuk grace period)
 */
export function getMinuteRotatingToken(sessionSalt = 'PAI_TOT', offsetMinutes = 0) {
  const currentMinuteEpoch = Math.floor(Date.now() / 60000) + offsetMinutes;
  const seedString = `${sessionSalt}_MIN_${currentMinuteEpoch}`;
  
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = ((hash << 5) - hash) + seedString.charCodeAt(i);
    hash |= 0;
  }

  let token = '';
  let pseudoRandom = Math.abs(hash);
  for (let i = 0; i < 6; i++) {
    pseudoRandom = (pseudoRandom * 9301 + 49297) % 233280;
    const index = Math.floor((pseudoRandom / 233280) * TOKEN_CHARSET.length);
    token += TOKEN_CHARSET[index];
  }

  return token;
}

/**
 * Mendapatkan sisa detik sebelum token berganti di menit berikutnya
 */
export function getSecondsRemainingInCurrentMinute() {
  const now = new Date();
  return 60 - now.getSeconds();
}

/**
 * Memvalidasi apakah token yang dimasukkan peserta cocok dengan:
 * 1. Token menit saat ini
 * 2. Token menit sebelumnya (toleransi 60 detik jika baru saja berputar)
 * 3. Token statis sesi master (misal TOT2026 dari admin)
 */
export function validateRotatingToken(inputToken, masterToken = 'TOT2026', sessionSalt = 'PAI_TOT') {
  if (!inputToken) return false;
  const clean = String(inputToken).trim().toUpperCase();

  const currentMinToken = getMinuteRotatingToken(sessionSalt, 0);
  const prevMinToken = getMinuteRotatingToken(sessionSalt, -1);

  if (clean === currentMinToken || clean === prevMinToken) {
    return true;
  }

  if (masterToken && clean === String(masterToken).trim().toUpperCase()) {
    return true;
  }

  return false;
}
