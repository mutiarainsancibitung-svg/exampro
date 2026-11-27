import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook Timer yang terhubung dengan timestamp mulai (start_time) dan batas akhir sesi (endAt)
 * Menjamin durasi tidak di-reset saat refresh, tidak drift, dan langsung memicu submit saat 0.
 */
export const useServerTimer = ({ startTime, durationMinutes, endAt, onTimeUp, isActive = true }) => {
  const calculateRemainingSeconds = useCallback(() => {
    if (!startTime || !durationMinutes) return null;
    const startMs = new Date(startTime).getTime();
    if (isNaN(startMs)) return null;

    let effectiveEndMs = startMs + Number(durationMinutes) * 60 * 1000;
    if (endAt) {
      const scheduleEndMs = new Date(endAt).getTime();
      if (!isNaN(scheduleEndMs)) {
        effectiveEndMs = Math.min(effectiveEndMs, scheduleEndMs);
      }
    }

    const remainingMs = effectiveEndMs - Date.now();
    return Math.max(0, Math.floor(remainingMs / 1000));
  }, [startTime, durationMinutes, endAt]);

  const [secondsLeft, setSecondsLeft] = useState(() => {
    const initial = calculateRemainingSeconds();
    return initial !== null ? initial : 0;
  });
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    hasTriggeredRef.current = false;
    const rem = calculateRemainingSeconds();
    if (rem !== null) {
      setSecondsLeft(rem);
    }
  }, [calculateRemainingSeconds]);

  useEffect(() => {
    if (!isActive) return;

    const initialRem = calculateRemainingSeconds();
    if (initialRem === null) return;

    if (initialRem <= 0) {
      setSecondsLeft(0);
      if (!hasTriggeredRef.current && onTimeUpRef.current) {
        hasTriggeredRef.current = true;
        onTimeUpRef.current();
      }
      return;
    }

    const interval = setInterval(() => {
      const currentRem = calculateRemainingSeconds();
      if (currentRem === null) return;

      setSecondsLeft(currentRem);
      if (currentRem <= 0) {
        clearInterval(interval);
        if (!hasTriggeredRef.current && onTimeUpRef.current) {
          hasTriggeredRef.current = true;
          onTimeUpRef.current();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, calculateRemainingSeconds]);

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
