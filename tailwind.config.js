/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palet warna resmi sesuai Gambar 2 (Pelatihan Guru PAI - Kemenag & FITK UIN Jakarta)
        kemenag: {
          50: '#F0FDF8',
          100: '#E6F9F2',
          200: '#C7F1E2',
          300: '#96E3CA',
          400: '#4EC8A5',
          500: '#1FAF86',
          600: '#0D7A5F', // Primary Green PAI / UIN
          700: '#09634D',
          800: '#064E3B',
          900: '#04382A',
        },
        uin: {
          blue: '#1A569E',
          gold: '#E5A91E',
          mint: '#EBF8F4',
          surface: '#F4FAF7'
        }
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      }
    },
  },
  plugins: [],
}
