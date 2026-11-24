import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook Timer yang terhubung dengan timestamp mulai (start_time)
 * Menjamin durasi tidak di-reset hanya dengan me-refresh browser.
 */
export const useServerTimer = ({ startTime, durationMinutes, onTimeUp, isActive = true }) => {
  const calculateRemainingSeconds = useCallback(() => {
    if (!startTime || !durationMinutes) return 0;
    const startMs = new Date(startTime).getTime();
    const durationMs = durationMinutes * 60 * 1000;
    const endMs = startMs + durationMs;
    const nowMs = Date.now();
    const remainingMs = endMs - nowMs;
    return Math.max(0, Math.floor(remainingMs / 1000));
  }, [startTime, durationMinutes]);

  const [secondsLeft, setSecondsLeft] = useState(calculateRemainingSeconds);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    setSecondsLeft(calculateRemainingSeconds());
  }, [calculateRemainingSeconds]);

  useEffect(() => {
    if (!isActive || secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onTimeUpRef.current) {
            onTimeUpRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, secondsLeft]);

  // Format detik menjadi format HH:MM:SS atau MM:SS
  const formatTime = () => {
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;

    const pad = (n) => String(n).padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const isLowTime = secondsLeft > 0 && secondsLeft <= 300; // < 5 Menit
  const isCriticalTime = secondsLeft > 0 && secondsLeft <= 60; // < 1 Menit

  return {
    secondsLeft,
    formatTime,
    isLowTime,
    isCriticalTime,
    isTimeUp: secondsLeft <= 0
  };
};
