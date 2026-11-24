import { useEffect, useState, useCallback } from 'react';

/**
 * Hook Anti-Kecurangan (Anti-Cheating Safeguards):
 * - Deteksi perpindahan tab browser (visibilitychange & blur)
 * - Peringatan visual popup
 * - Pencegahan context menu (klik kanan), copy-paste, dan pintasan inspect element
 */
export const useAntiCheat = ({ onViolation, isExamActive = true }) => {
  const [violationCount, setViolationCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');

  const triggerViolation = useCallback((msg) => {
    if (!isExamActive) return;
    setViolationCount(prev => prev + 1);
    setWarningMessage(msg);
    setShowWarning(true);
    if (onViolation) onViolation();
  }, [isExamActive, onViolation]);

  useEffect(() => {
    if (!isExamActive) return;

    // 1. Deteksi perpindahan tab browser
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation('Anda terdeteksi berpindah tab atau meminimalkan browser!');
      }
    };

    // 2. Deteksi kehilangan fokus window
    const handleWindowBlur = () => {
      triggerViolation('Jendela ujian kehilangan fokus. Harap tetap berada di halaman ujian!');
    };

    // 3. Pencegahan klik kanan
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // 4. Pencegahan shortcut keyboard mencurigakan (Ctrl+C, Ctrl+V, F12, Ctrl+Shift+I, dll)
    const handleKeyDown = (e) => {
      // F12 / DevTools
      if (e.key === 'F12') {
        e.preventDefault();
        triggerViolation('Pintasan Developer Tools diblokir.');
        return false;
      }
      // Ctrl+Shift+I atau Ctrl+Shift+J atau Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
        e.preventDefault();
        triggerViolation('Akses inspeksi elemen diblokir.');
        return false;
      }
      // Ctrl+U (View Source)
      if (e.ctrlKey && e.key.toUpperCase() === 'U') {
        e.preventDefault();
        return false;
      }
      // Ctrl+C / Ctrl+V
      if (e.ctrlKey && ['C', 'V'].includes(e.key.toUpperCase())) {
        // Izinkan paste di textarea jika essay, tapi blokir copy soal
        if (e.key.toUpperCase() === 'C') {
          e.preventDefault();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExamActive, triggerViolation]);

  const closeWarning = () => {
    setShowWarning(false);
  };

  // Fungsi utilitas untuk meminta mode Fullscreen
  const requestFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (document.documentElement.webkitRequestFullscreen) {
        await document.documentElement.webkitRequestFullscreen();
      }
    } catch (err) {
      console.warn('Mode fullscreen ditolak browser:', err);
    }
  };

  return {
    violationCount,
    showWarning,
    warningMessage,
    closeWarning,
    requestFullscreen
  };
};
