/**
 * usePredictionRefresh — Auto-refreshes predictions on a timer.
 *
 * Predictions are time-relative (survival functions shift with the current
 * moment), so they become stale as real time passes. This hook recalculates
 * every `intervalMs` milliseconds while the document is visible.
 *
 * Uses the Page Visibility API to pause background computation when the
 * PWA is backgrounded, preserving battery on mobile.
 */

import { useEffect, useRef } from 'react';
import { usePetStore } from '../store/usePetStore';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function usePredictionRefresh(
  intervalMs: number = DEFAULT_INTERVAL_MS,
): void {
  const refreshPredictions = usePetStore((state) => state.refreshPredictions);
  const activePetId = usePetStore((state) => state.activePetId);
  const modelState = usePetStore((state) => state.modelState);

  // Stable ref so the interval callback always sees the latest function
  const refreshRef = useRef(refreshPredictions);
  refreshRef.current = refreshPredictions;

  useEffect(() => {
    // Don't schedule refreshes if there's nothing to refresh
    if (!activePetId || !modelState) return;

    let timerId: ReturnType<typeof setInterval> | null = null;

    function startInterval(): void {
      // Clear any existing interval before starting a new one
      if (timerId !== null) {
        clearInterval(timerId);
      }

      timerId = setInterval(() => {
        // Double-check visibility before each refresh to guard against
        // intervals firing just before the visibility handler fires
        if (document.visibilityState === 'visible') {
          refreshRef.current().catch((error: unknown) => {
            console.error('[PawClock] Prediction refresh failed:', error);
          });
        }
      }, intervalMs);
    }

    function stopInterval(): void {
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    }

    function handleVisibilityChange(): void {
      if (document.visibilityState === 'visible') {
        // Refresh immediately on tab focus, then resume scheduled interval
        refreshRef.current().catch((error: unknown) => {
          console.error(
            '[PawClock] Prediction refresh on visibility change failed:',
            error,
          );
        });
        startInterval();
      } else {
        stopInterval();
      }
    }

    // Start the interval only if the tab is currently visible
    if (document.visibilityState === 'visible') {
      startInterval();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activePetId, modelState, intervalMs]);
}
