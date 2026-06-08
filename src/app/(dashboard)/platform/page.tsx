"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { DOCS_URL } from "@/lib/constants/urls";
import {
  ArrowRight,
  BarChart3,
  Key,
  Users,
  Building2,
  Layers,
  AlertCircle,
} from "lucide-react";

type PlatformOverview = {
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    enabled_at: string;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    scope: string;
  };
  counts: {
    tenants: number;
    api_keys: number;
  };
  usage: {
    period: { start: string; end: string };
    totals: { operations: number; units: number };
    top_operations: Array<{ operation: string; units: number }>;
    top_channels: Array<{ via: string; units: number }>;
    top_tenants: Array<{ id: string; name: string; units: number }>;
  };
  recent_tenants: Array<{
    id: string;
    name: string;
    slug: string;
    external_id: string;
    created_at: string;
  }>;
  api_keys: Array<{
    id: string;
    name: string;
    token_prefix: string;
    last_used_at: string | null;
    created_at: string;
  }>;
};

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  hint,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  href?: string;
  hint?: string;
}) {
  const inner = (
    <div className="neo-surface rounded-xl p-5 space-y-3 h-full">
      <div className="flex items-center justify-between">
        <span className="neo-label">{label}</span>
        <Icon size={14} style={{ color: "var(--neo-fg-muted)" }} />
      </div>
      <div className="neo-heading text-3xl">{value}</div>
      {hint && <p className="text-xs neo-text-muted">{hint}</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-90">
        {inner}
      </Link>
    );
  }

  return inner;
}

function BarRow({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: "var(--neo-fg)" }}>{label}</span>
        <span className="neo-text-muted">{value}</span>
      </div>
      <div className="h-1 rounded-full" style={{ background: "var(--neo-surface2)" }}>
        <div
          className="h-1 rounded-full transition-all"
          style={{
            width: `${max > 0 ? (value / max) * 100 : 0}%`,
            background: "var(--neo-accent)",
            opacity: 0.7,
          }}
        />
      </div>
    </div>
  );
}

export default function PlatformOverviewPage() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<PlatformOverview>("/api/platform/overview").then((res) => {
      if (res.ok) {
        setOverview(res.data);
      } else {
        setError((res.data as { error?: string })?.error ?? "Failed to load overview");
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-sm neo-text-muted">Loading…</p>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-sm" style={{ color: "var(--neo-error)" }}>
          {error || "Failed to load overview."}
        </p>
      </div>
    );
  }

  const maxOpUnits = Math.max(...overview.usage.top_operations.map((o) => o.units), 1);
  const maxChannelUnits = Math.max(...overview.usage.top_channels.map((c) => c.units), 1);
  const hasUsage = overview.usage.totals.operations > 0;
  const needsSetup = overview.counts.api_keys === 0 || overview.counts.tenants === 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="neo-heading text-2xl">Overview</h1>
        <p className="text-sm neo-text-muted mt-2">
          {overview.organization.name} · workspace{" "}
          <code className="font-mono text-xs">{overview.workspace.slug}</code> · last 30 days
        </p>
      </div>

      {/* Context */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="neo-surface rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 size={16} style={{ color: "var(--neo-accent)" }} />
            <span className="neo-label">Organization</span>
          </div>
          <p className="neo-heading text-lg">{overview.organization.name}</p>
          <p className="text-sm neo-text-muted">
            {overview.organization.slug} · {overview.organization.plan} plan · enabled{" "}
            {new Date(overview.organization.enabled_at).toLocaleDateString()}
          </p>
        </div>
        <div className="neo-surface rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Layers size={16} style={{ color: "var(--neo-accent)" }} />
            <span className="neo-label">Active workspace</span>
          </div>
          <p className="neo-heading text-lg">{overview.workspace.name}</p>
          <p className="text-sm neo-text-muted">
            <code className="font-mono text-xs">X-Neo-Workspace: {overview.workspace.slug}</code>
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Tenants"
          value={overview.counts.tenants}
          icon={Users}
          href="/platform/tenants"
        />
        <StatCard
          label="API keys"
          value={overview.counts.api_keys}
          icon={Key}
          href="/platform/keys"
        />
        <StatCard
          label="Operations"
          value={overview.usage.totals.operations}
          icon={BarChart3}
          href="/platform/usage"
          hint="30d"
        />
        <StatCard
          label="Units"
          value={overview.usage.totals.units}
          icon={BarChart3}
          href="/platform/usage"
          hint="30d"
        />
      </div>

      {needsSetup && (
        <div
          className="rounded-xl p-5 space-y-3"
          style={{
            background: "var(--neo-accent-muted)",
            border: "1px solid var(--neo-border)",
          }}
        >
          <div className="flex items-start gap-3">
            <AlertCircle size={18} style={{ color: "var(--neo-accent)" }} className="shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium" style={{ color: "var(--neo-fg)" }}>
                Setup checklist
              </p>
              <ul className="text-sm neo-text-muted space-y-1.5">
                {overview.counts.api_keys === 0 && (
                  <li>
                    <Link href="/platform/keys" className="hover:opacity-80" style={{ color: "var(--neo-accent)" }}>
                      Create an API key →
                    </Link>
                  </li>
                )}
                {overview.counts.tenants === 0 && (
                  <li>Provision your first tenant via <code className="font-mono text-xs">POST /v1/tenants</code></li>
                )}
                <li>
                  Send requests with <code className="font-mono text-xs">Authorization</code> and{" "}
                  <code className="font-mono text-xs">X-Neo-Workspace: {overview.workspace.slug}</code>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Usage by operation */}
        <div className="neo-surface rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="neo-label">Usage by operation</span>
            <Link
              href="/platform/usage"
              className="flex items-center gap-1 text-xs neo-text-muted hover:opacity-80"
            >
              Details <ArrowRight size={12} />
            </Link>
          </div>
          {!hasUsage || overview.usage.top_operations.length === 0 ? (
            <p className="text-sm neo-text-muted">No API usage in the last 30 days.</p>
          ) : (
            <div className="space-y-3">
              {overview.usage.top_operations.map((op) => (
                <BarRow
                  key={op.operation}
                  label={op.operation}
                  value={op.units}
                  max={maxOpUnits}
                />
              ))}
            </div>
          )}
        </div>

        {/* Usage by channel */}
        <div className="neo-surface rounded-xl p-5 space-y-4">
          <span className="neo-label">Usage by channel</span>
          {!hasUsage || overview.usage.top_channels.length === 0 ? (
            <p className="text-sm neo-text-muted">No API usage in the last 30 days.</p>
          ) : (
            <div className="space-y-3">
              {overview.usage.top_channels.map((ch) => (
                <BarRow key={ch.via} label={ch.via} value={ch.units} max={maxChannelUnits} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent tenants */}
        <div className="neo-surface rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="neo-label">Recent tenants</span>
            <Link
              href="/platform/tenants"
              className="flex items-center gap-1 text-xs neo-text-muted hover:opacity-80"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {overview.recent_tenants.length === 0 ? (
            <p className="text-sm neo-text-muted">No tenants yet — create via the API.</p>
          ) : (
            <div className="space-y-1">
              {overview.recent_tenants.map((t) => (
                <Link
                  key={t.id}
                  href={`/platform/tenants/${t.id}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors"
                  style={{ color: "var(--neo-fg)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--neo-surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs neo-text-muted font-mono truncate">{t.slug}</p>
                  </div>
                  <span className="text-xs neo-text-muted shrink-0 ml-2">
                    {new Date(t.created_at).toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Top tenants by usage or API keys */}
        <div className="neo-surface rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="neo-label">
              {overview.usage.top_tenants.length > 0 ? "Top tenants by usage" : "API keys"}
            </span>
            <Link
              href={overview.usage.top_tenants.length > 0 ? "/platform/usage" : "/platform/keys"}
              className="flex items-center gap-1 text-xs neo-text-muted hover:opacity-80"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {overview.usage.top_tenants.length > 0 ? (
            <div className="space-y-2">
              {overview.usage.top_tenants.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between text-sm py-2 px-3 rounded-lg"
                  style={{ background: "var(--neo-surface2)" }}
                >
                  <span style={{ color: "var(--neo-fg)" }}>{t.name}</span>
                  <span className="neo-text-muted">{t.units} units</span>
                </div>
              ))}
            </div>
          ) : overview.api_keys.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm neo-text-muted">No API keys yet.</p>
              <Link
                href="/platform/keys"
                className="inline-flex items-center gap-1 text-sm font-medium"
                style={{ color: "var(--neo-accent)" }}
              >
                Create your first key <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {overview.api_keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5"
                  style={{ background: "var(--neo-surface2)" }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--neo-fg)" }}>
                      {k.name}
                    </p>
                    <p className="text-xs neo-text-muted font-mono">{k.token_prefix}…</p>
                  </div>
                  <span className="text-xs neo-text-muted">
                    {k.last_used_at
                      ? `Used ${new Date(k.last_used_at).toLocaleDateString()}`
                      : "Never used"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Link
        href={DOCS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="neo-surface rounded-xl p-5 flex items-center justify-between transition-opacity hover:opacity-90 block"
      >
        <div className="space-y-1">
          <span className="neo-label">API documentation</span>
          <p className="text-sm" style={{ color: "var(--neo-fg-secondary)" }}>
            Integration guide, OpenAPI spec, and agent prompts
          </p>
        </div>
        <ArrowRight size={16} style={{ color: "var(--neo-fg-muted)" }} />
      </Link>
    </div>
  );
}
