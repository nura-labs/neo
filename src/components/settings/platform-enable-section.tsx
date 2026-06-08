"use client";

import { useState } from "react";
import Link from "next/link";
import { DOCS_URL } from "@/lib/constants/urls";
import { useAuth } from "@/contexts/auth-context";
import { usePlatform } from "@/contexts/platform-context";
import { apiFetch } from "@/lib/api";
import { Building2 } from "lucide-react";

export function PlatformEnableSection() {
  const { currentWorkspace, refreshWorkspaces } = useAuth();
  const { isPlatformEnabled, refreshPlatform } = usePlatform();
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState("");

  const isOwner = currentWorkspace?.role === "owner";

  if (isPlatformEnabled) {
    return (
      <section className="neo-surface rounded-xl p-6 space-y-3">
        <div className="flex items-start gap-3">
          <Building2 size={18} style={{ color: "var(--neo-accent)" }} className="shrink-0 mt-0.5" />
          <div>
            <h2 className="neo-heading text-base">Platform API</h2>
            <p className="text-sm neo-text-muted mt-1">
              Platform is enabled for this workspace. Switch to Platform mode in the sidebar for
              tenants, keys, and usage.
            </p>
            <Link
              href="/platform"
              className="inline-block mt-3 text-sm font-medium"
              style={{ color: "var(--neo-accent)" }}
            >
              Open Platform →
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!isOwner) {
    return (
      <section className="neo-surface rounded-xl p-6 space-y-3">
        <div className="flex items-start gap-3">
          <Building2 size={18} style={{ color: "var(--neo-fg-muted)" }} className="shrink-0 mt-0.5" />
          <div>
            <h2 className="neo-heading text-base">Platform API</h2>
            <p className="text-sm neo-text-muted mt-1">
              Platform is not enabled for this workspace. Ask a workspace owner to enable it in
              Settings.
            </p>
          </div>
        </div>
      </section>
    );
  }

  async function handleEnable() {
    setEnabling(true);
    setError("");

    const res = await apiFetch<{ enabled: boolean }>("/api/platform/enable", {
      method: "POST",
      body: JSON.stringify({}),
    });

    setEnabling(false);

    if (!res.ok) {
      setError((res.data as { error?: string })?.error ?? "Failed to enable platform");
      return;
    }

    await Promise.all([refreshPlatform(), refreshWorkspaces()]);
  }

  return (
    <section className="neo-surface rounded-xl p-6 space-y-4">
      <div className="flex items-start gap-3">
        <Building2 size={18} style={{ color: "var(--neo-accent)" }} className="shrink-0 mt-0.5" />
        <div>
          <h2 className="neo-heading text-base">Platform API</h2>
          <p className="text-sm neo-text-muted mt-2 leading-relaxed">
            Embed Neo behavioral memory in your product — multi-tenant context, search, and
            agent-ready REST API. Enabling Platform applies to{" "}
            <span style={{ color: "var(--neo-fg)" }}>{currentWorkspace?.name ?? "this workspace"}</span>{" "}
            only. Create API keys from Platform → Keys after enabling.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm" style={{ color: "var(--neo-error)" }}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleEnable}
          disabled={enabling}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
          style={{ background: "var(--neo-accent)", color: "#fff" }}
        >
          {enabling ? "Enabling…" : "Enable Platform"}
        </button>
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm neo-text-muted hover:opacity-80"
        >
          Read the docs
        </a>
      </div>
    </section>
  );
}
