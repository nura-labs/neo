"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import { auth } from "@/lib/auth/firebase-client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const getIdToken = async () => {
    if (!user) return null;
    return user.getIdToken();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, getIdToken }}>
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
