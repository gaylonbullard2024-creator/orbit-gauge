import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'mcg_lead_captured';

type StoredLead = { email: string; ts: number };

function readStored(): StoredLead | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLead;
    if (parsed && typeof parsed.email === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function useLeadGate() {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIsUnlocked(!!readStored());
    setHydrated(true);
  }, []);

  const unlock = useCallback((email: string) => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ email, ts: Date.now() } satisfies StoredLead)
      );
    } catch {
      // ignore storage failures
    }
    setIsUnlocked(true);
  }, []);

  return { isUnlocked, unlock, hydrated };
}
