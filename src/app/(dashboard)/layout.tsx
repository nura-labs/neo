"use client";

import { useAuth } from "@/contexts/auth-context";
import { PlatformProvider } from "@/contexts/platform-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";

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
    <PlatformProvider>
      <div className="flex h-screen" style={{ background: "var(--neo-bg)" }}>
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          <div
            className="flex items-center gap-3 px-6 py-3 shrink-0"
            style={{ borderBottom: "1px solid var(--neo-border)" }}
          >
            <div className="max-w-xs w-full">
              <WorkspaceSwitcher />
            </div>
          </div>
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </PlatformProvider>
  );
}
