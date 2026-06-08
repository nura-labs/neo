"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DOCS_URL } from "@/lib/constants/urls";
import Link from "next/link";

type Tenant = {
  id: string;
  external_id: string;
  slug: string;
  name: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export default function PlatformTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<{ tenants: Tenant[]; total: number }>(
      "/api/platform/tenants"
    );
    if (res.ok) {
      setTenants(res.data.tenants);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="neo-heading text-2xl">Tenants</h1>
        <p className="text-sm neo-text-muted mt-2 leading-relaxed max-w-2xl">
        Tenants represent your end-customers and are provisioned from your product via the{" "}
        <Link
          href={`${DOCS_URL}/tenants`}
          className="underline underline-offset-2 hover:opacity-80"
          style={{ color: "var(--neo-fg)" }}
          target="_blank"
          rel="noopener noreferrer"
        >
          Platform API
        </Link>
        . Use{" "}
        <code className="text-xs font-mono px-1 py-0.5 rounded" style={{ background: "var(--neo-surface2)" }}>
          POST /v1/tenants
        </code>{" "}
        with your customer&apos;s{" "}
        <code className="text-xs font-mono px-1 py-0.5 rounded" style={{ background: "var(--neo-surface2)" }}>
          external_id
        </code>{" "}
        — this dashboard is read-only.
        </p>
      </div>

      <div className="neo-surface rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="neo-label">All tenants</span>
          <span className="text-xs neo-text-muted">{total} total</span>
        </div>
        {loading ? (
          <p className="text-sm neo-text-muted">Loading…</p>
        ) : tenants.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm neo-text-muted">No tenants yet.</p>
            <p className="text-xs neo-text-muted leading-relaxed">
              Create tenants from your backend with{" "}
              <code className="font-mono">POST /v1/tenants</code>. See{" "}
              <Link
                href={`${DOCS_URL}/tenants`}
                className="underline underline-offset-2 hover:opacity-80"
                target="_blank"
                rel="noopener noreferrer"
              >
                API docs
              </Link>{" "}
              or{" "}
              <Link
                href={`${DOCS_URL}/quickstart`}
                className="underline underline-offset-2 hover:opacity-80"
                target="_blank"
                rel="noopener noreferrer"
              >
                quickstart
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--neo-border)" }}>
            {tenants.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/platform/tenants/${t.id}`}
                  className="flex items-center justify-between py-3 hover:opacity-80 transition-opacity"
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--neo-fg)" }}>
                      {t.name}
                    </p>
                    <p className="text-xs neo-text-muted font-mono mt-0.5">
                      {t.external_id} · {t.slug}
                    </p>
                  </div>
                  <span className="text-xs neo-text-muted">
                    {new Date(t.created_at).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
