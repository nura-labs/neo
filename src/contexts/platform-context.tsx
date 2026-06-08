"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/auth/firebase-client";

export type PlatformMode = "personal" | "platform";

export type PlatformOrg = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  enabled_at: string;
  created_at?: string;
  updated_at?: string;
};

interface PlatformContextValue {
  isPlatformEnabled: boolean;
  platformOrg: PlatformOrg | null;
  loading: boolean;
  mode: PlatformMode;
  setMode: (mode: PlatformMode) => void;
  refreshPlatform: () => Promise<void>;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

const MODE_LS_KEY = "neo-mode";

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [platformOrg, setPlatformOrg] = useState<PlatformOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setModeState] = useState<PlatformMode>("personal");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(MODE_LS_KEY);
      if (stored === "platform" || stored === "personal") {
        setModeState(stored);
      }
    }
  }, []);

  const refreshPlatform = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) {
      setPlatformOrg(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const token = await u.getIdToken();
      const res = await fetch("/api/platform", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setPlatformOrg(null);
        return;
      }
      const data = (await res.json()) as {
        enabled: boolean;
        organization: PlatformOrg | null;
      };
      setPlatformOrg(data.enabled ? data.organization : null);
    } catch {
      setPlatformOrg(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        refreshPlatform();
      } else {
        setPlatformOrg(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [refreshPlatform]);

  const setMode = useCallback((next: PlatformMode) => {
    setModeState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MODE_LS_KEY, next);
    }
  }, []);

  return (
    <PlatformContext.Provider
      value={{
        isPlatformEnabled: platformOrg !== null,
        platformOrg,
        loading,
        mode,
        setMode,
        refreshPlatform,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error("usePlatform must be used within a PlatformProvider");
  }
  return context;
}
