"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Tenant = {
  id: string;
  external_id: string;
  slug: string;
  name: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export default function TenantDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<Tenant>(`/api/platform/tenants/${id}`).then((res) => {
      if (res.ok) setTenant(res.data);
      else setError((res.data as { error?: string })?.error ?? "Not found");
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-sm neo-text-muted">Loading…</p>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Link
          href="/platform/tenants"
          className="inline-flex items-center gap-1 text-sm neo-text-muted hover:opacity-80"
        >
          <ArrowLeft size={14} />
          Back to tenants
        </Link>
        <p className="text-sm" style={{ color: "var(--neo-error)" }}>
          {error || "Tenant not found"}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link
        href="/platform/tenants"
        className="inline-flex items-center gap-1 text-sm neo-text-muted hover:opacity-80"
      >
        <ArrowLeft size={14} />
        Back to tenants
      </Link>

      <div>
        <h1 className="neo-heading text-2xl">{tenant.name}</h1>
        <p className="text-sm neo-text-muted font-mono mt-1">{tenant.external_id}</p>
      </div>

      <div className="neo-surface rounded-xl p-6 space-y-4">
        <div>
          <p className="neo-label">Details</p>
        </div>

        <dl className="grid gap-4 md:grid-cols-2 text-sm">
          <div>
            <dt className="neo-label">ID</dt>
            <dd className="font-mono mt-1" style={{ color: "var(--neo-fg)" }}>
              {tenant.id}
            </dd>
          </div>
          <div>
            <dt className="neo-label">External ID</dt>
            <dd className="font-mono mt-1" style={{ color: "var(--neo-fg)" }}>
              {tenant.external_id}
            </dd>
          </div>
          <div>
            <dt className="neo-label">Slug</dt>
            <dd className="font-mono mt-1" style={{ color: "var(--neo-fg)" }}>
              {tenant.slug}
            </dd>
          </div>
          <div>
            <dt className="neo-label">Created</dt>
            <dd className="mt-1" style={{ color: "var(--neo-fg)" }}>
              {new Date(tenant.created_at).toLocaleString()}
            </dd>
          </div>
        </dl>

        {Object.keys(tenant.metadata).length > 0 && (
          <div>
            <p className="neo-label mb-2">Metadata</p>
            <pre
              className="text-xs font-mono p-4 rounded-lg overflow-x-auto"
              style={{ background: "var(--neo-surface2)", color: "var(--neo-fg)" }}
            >
              {JSON.stringify(tenant.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
