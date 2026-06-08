"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: "var(--neo-bg)" }}
      >
        <span className="neo-text-muted text-sm">Loading...</span>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen" style={{ background: "var(--neo-bg)" }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
