"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { usePlatform } from "@/contexts/platform-context";
import Link from "next/link";
import { ArrowRight, BarChart3, Key, Layers, Users } from "lucide-react";

type UsageData = {
  period: { start: string; end: string };
  totals: { operations: number; units: number };
  by_operation: Record<string, number>;
  by_via: Record<string, number>;
  by_tenant?: Array<{ id: string; name: string; units: number }>;
};

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
}) {
  return (
    <div className="neo-surface rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="neo-label">{label}</span>
        <Icon size={14} style={{ color: "var(--neo-fg-muted)" }} />
      </div>
      <div className="neo-heading text-3xl">{value}</div>
    </div>
  );
}

export default function PlatformOverviewPage() {
  const { platformOrg } = usePlatform();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [workspaceCount, setWorkspaceCount] = useState<number | null>(null);
  const [tenantCount, setTenantCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [usageRes, wsRes, tenantRes] = await Promise.all([
        apiFetch<UsageData>("/api/platform/usage?days=30"),
        apiFetch<{ workspaces: unknown[] }>("/api/platform/workspaces"),
        apiFetch<{ tenants: unknown[]; total: number }>("/api/platform/tenants"),
      ]);
      if (usageRes.ok) setUsage(usageRes.data);
      if (wsRes.ok) setWorkspaceCount(wsRes.data.workspaces.length);
      if (tenantRes.ok) setTenantCount(tenantRes.data.total);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <p className="text-sm neo-text-muted">Loading…</p>;
  }

  const quickLinks = [
    { href: "/platform/workspaces", label: "Workspaces", icon: Layers, count: workspaceCount },
    { href: "/platform/tenants", label: "Tenants", icon: Users, count: tenantCount },
    { href: "/platform/keys", label: "API Keys", icon: Key },
    { href: "/platform/usage", label: "Usage", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      {platformOrg && (
        <div className="neo-surface rounded-xl p-5">
          <p className="neo-label">Organization</p>
          <p className="neo-heading text-lg mt-1">{platformOrg.name}</p>
          <p className="text-sm neo-text-muted mt-0.5">
            {platformOrg.slug} · {platformOrg.plan} plan
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Operations (30d)" value={usage?.totals.operations ?? 0} icon={BarChart3} />
        <StatCard label="Units (30d)" value={usage?.totals.units ?? 0} icon={BarChart3} />
        <StatCard label="Tenants" value={tenantCount ?? 0} icon={Users} />
      </div>

      {usage?.by_tenant && usage.by_tenant.length > 0 && (
        <div className="neo-surface rounded-xl p-5 space-y-4">
          <span className="neo-label">Top tenants by usage</span>
          <div className="space-y-2">
            {usage.by_tenant.slice(0, 5).map((t) => (
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
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="neo-surface rounded-xl p-4 flex items-center justify-between group transition-colors hover:opacity-90"
          >
            <div className="flex items-center gap-3">
              <link.icon size={18} style={{ color: "var(--neo-accent)" }} />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--neo-fg)" }}>
                  {link.label}
                </p>
                {link.count !== undefined && link.count !== null && (
                  <p className="text-xs neo-text-muted">{link.count} total</p>
                )}
              </div>
            </div>
            <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--neo-fg-muted)" }} />
          </Link>
        ))}
      </div>

      <div className="neo-surface rounded-xl p-5">
        <p className="neo-label">Get started</p>
        <p className="text-sm neo-text-muted mt-2">
          Create an API key, provision tenants, and start sending context to your agents.
        </p>
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 mt-4 text-sm font-medium"
          style={{ color: "var(--neo-accent)" }}
        >
          Read the API docs
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
