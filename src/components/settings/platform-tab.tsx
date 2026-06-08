"use client";

import { useState } from "react";
import Link from "next/link";
import { usePlatform } from "@/contexts/platform-context";
import { apiFetch } from "@/lib/api";
import { ArrowRight, Building2, CheckCircle, Copy } from "lucide-react";

export function PlatformTab() {
  const { isPlatformEnabled, platformOrg, refreshPlatform } = usePlatform();
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState("");
  const [defaultKey, setDefaultKey] = useState<string | null>(null);

  async function handleEnable() {
    setEnabling(true);
    setError("");
    setDefaultKey(null);

    const res = await apiFetch<{
      enabled: boolean;
      organization: { name: string; slug: string };
      default_key?: { secret: string };
    }>("/api/platform/enable", { method: "POST", body: JSON.stringify({}) });

    setEnabling(false);

    if (!res.ok) {
      setError((res.data as { error?: string })?.error ?? "Failed to enable platform");
      return;
    }

    if (res.data.default_key?.secret) {
      setDefaultKey(res.data.default_key.secret);
    }

    await refreshPlatform();
  }

  function copyKey() {
    if (defaultKey) navigator.clipboard.writeText(defaultKey);
  }

  if (isPlatformEnabled && platformOrg) {
    return (
      <div className="space-y-6">
        <div
          className="flex items-start gap-3 rounded-lg p-4"
          style={{ background: "var(--neo-accent-muted)", border: "1px solid var(--neo-border)" }}
        >
          <CheckCircle size={18} style={{ color: "var(--neo-success)" }} className="shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--neo-fg)" }}>
              Platform enabled
            </p>
            <p className="text-sm neo-text-muted mt-1">
              {platformOrg.name} ({platformOrg.slug}) · {platformOrg.plan} plan
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Link
            href="/platform"
            className="inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: "var(--neo-accent)" }}
          >
            Open Platform dashboard
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/docs"
            className="block text-sm neo-text-muted hover:opacity-80"
          >
            View API documentation →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Building2 size={20} style={{ color: "var(--neo-accent)" }} className="shrink-0 mt-0.5" />
        <div>
          <p className="text-sm" style={{ color: "var(--neo-fg)" }}>
            Build with Neo
          </p>
          <p className="text-sm neo-text-muted mt-2 leading-relaxed">
            Enable the Neo Platform to embed behavioral memory in your product.
            Provision tenants, manage workspaces, and access the Context API with account-level keys.
          </p>
        </div>
      </div>

      {defaultKey && (
        <div
          className="rounded-xl p-4 space-y-2"
          style={{ background: "var(--neo-accent-muted)", border: "1px solid var(--neo-accent)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--neo-fg)" }}>
            Your default API key — copy it now
          </p>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 text-xs font-mono px-3 py-2 rounded-lg break-all"
              style={{ background: "var(--neo-surface2)", color: "var(--neo-fg)" }}
            >
              {defaultKey}
            </code>
            <button
              onClick={copyKey}
              className="p-2 rounded-lg shrink-0"
              style={{ background: "var(--neo-surface2)" }}
              title="Copy"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm" style={{ color: "var(--neo-error)" }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={handleEnable}
          disabled={enabling}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
          style={{ background: "var(--neo-accent)", color: "#fff" }}
        >
          {enabling ? "Enabling…" : "Enable Platform"}
        </button>
        <Link href="/docs" className="text-sm neo-text-muted hover:opacity-80">
          Read the docs
        </Link>
      </div>
    </div>
  );
}
