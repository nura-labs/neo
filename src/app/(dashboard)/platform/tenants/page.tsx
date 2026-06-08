"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
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
  const [name, setName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");

    const res = await apiFetch<Tenant>("/api/platform/tenants", {
      method: "POST",
      body: JSON.stringify({
        name,
        external_id: externalId || name.toLowerCase().replace(/\s+/g, "-"),
      }),
    });

    setCreating(false);
    if (!res.ok) {
      setError((res.data as { error?: string })?.error ?? "Failed to create tenant");
      return;
    }

    setName("");
    setExternalId("");
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="neo-surface rounded-xl p-6 space-y-4">
        <h2 className="neo-heading text-base">Create tenant</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="neo-label">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  background: "var(--neo-surface2)",
                  border: "1px solid var(--neo-border)",
                  color: "var(--neo-fg)",
                }}
                placeholder="Customer Inc"
              />
            </div>
            <div className="space-y-1.5">
              <label className="neo-label">External ID</label>
              <input
                type="text"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                style={{
                  background: "var(--neo-surface2)",
                  border: "1px solid var(--neo-border)",
                  color: "var(--neo-fg)",
                }}
                placeholder="cust_123"
              />
            </div>
          </div>
          {error && (
            <p className="text-sm" style={{ color: "var(--neo-error)" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={creating || !name}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: "var(--neo-accent)", color: "#fff" }}
          >
            {creating ? "Creating…" : "Create tenant"}
          </button>
        </form>
      </div>

      <div className="neo-surface rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="neo-heading text-base">Tenants</h2>
          <span className="text-xs neo-text-muted">{total} total</span>
        </div>
        {loading ? (
          <p className="text-sm neo-text-muted">Loading…</p>
        ) : tenants.length === 0 ? (
          <p className="text-sm neo-text-muted">No tenants yet.</p>
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
