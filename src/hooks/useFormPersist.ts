import { useState, useEffect, useCallback } from "react";

/**
 * Persists form state in sessionStorage so users don't lose progress
 * when navigating away and coming back.
 */
export function useFormPersist<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const storageKey = `form_persist_${key}`;

  const [value, setValue] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored) as T;
    } catch {}
    return initialValue;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {}
  }, [storageKey, value]);

  const clear = useCallback(() => {
    sessionStorage.removeItem(storageKey);
  }, [storageKey]);

  return [value, setValue, clear];
}
