"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import { auth } from "@/lib/auth/firebase-client";

export type Workspace = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  scope?: string;
  role: "owner" | "member";
  memberCount?: number;
};

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspaceSlug: (slug: string) => void;
  refreshWorkspaces: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const WORKSPACE_LS_KEY = "neo-workspace";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);

  const refreshWorkspaces = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) {
      setWorkspaces([]);
      return;
    }
    const token = await u.getIdToken();
    const res = await fetch("/api/workspaces", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setWorkspaces([]);
      return;
    }
    const data = (await res.json()) as { workspaces: Workspace[] };
    setWorkspaces(data.workspaces);

    // Resolve currentSlug: prefer localStorage if still in list, else first
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(WORKSPACE_LS_KEY)
        : null;
    const resolved =
      data.workspaces.find((w) => w.slug === stored)?.slug ??
      data.workspaces[0]?.slug ??
      null;
    setCurrentSlug(resolved);
    if (resolved && typeof window !== "undefined") {
      window.localStorage.setItem(WORKSPACE_LS_KEY, resolved);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await refreshWorkspaces();
      } else {
        setWorkspaces([]);
        setCurrentSlug(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [refreshWorkspaces]);

  const setCurrentWorkspaceSlug = useCallback((slug: string) => {
    setCurrentSlug(slug);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WORKSPACE_LS_KEY, slug);
    }
  }, []);

  const signOut = async () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(WORKSPACE_LS_KEY);
    }
    await firebaseSignOut(auth);
  };

  const getIdToken = async () => {
    const u = auth.currentUser;
    if (!u) return null;
    return u.getIdToken();
  };

  const currentWorkspace =
    workspaces.find((w) => w.slug === currentSlug) ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        workspaces,
        currentWorkspace,
        setCurrentWorkspaceSlug,
        refreshWorkspaces,
        signOut,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
