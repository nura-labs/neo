"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlatform } from "@/contexts/platform-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const tabs = [
  { href: "/platform", label: "Overview" },
  { href: "/platform/workspaces", label: "Workspaces" },
  { href: "/platform/tenants", label: "Tenants" },
  { href: "/platform/keys", label: "API Keys" },
  { href: "/platform/usage", label: "Usage" },
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isPlatformEnabled, loading } = usePlatform();

  useEffect(() => {
    if (!loading && !isPlatformEnabled) {
      router.push("/settings?tab=platform");
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

  const isTabActive = (href: string) =>
    href === "/platform" ? pathname === "/platform" : pathname.startsWith(href);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="neo-heading text-2xl">Platform</h1>
        <p className="text-sm neo-text-muted mt-1">
          Build with Neo — multi-tenant context API for your product
        </p>
      </div>

      <div
        className="flex gap-1 border-b overflow-x-auto"
        style={{ borderColor: "var(--neo-border)" }}
      >
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap"
            style={{
              color: isTabActive(t.href) ? "var(--neo-fg)" : "var(--neo-fg-muted)",
              borderBottom: isTabActive(t.href)
                ? "2px solid var(--neo-fg)"
                : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
