"use client";

import { usePlatform } from "@/contexts/platform-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isPlatformEnabled, loading } = usePlatform();

  useEffect(() => {
    if (!loading && !isPlatformEnabled) {
      router.push("/settings");
    }
  }, [loading, isPlatformEnabled, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="neo-text-muted text-sm">Loading…</span>
      </div>
    );
  }

  if (!isPlatformEnabled) return null;

  return <>{children}</>;
}
