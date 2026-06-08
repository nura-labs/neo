"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type UsageData = {
  period: { start: string; end: string };
  totals: { operations: number; units: number };
  by_operation: Record<string, number>;
  by_via: Record<string, number>;
  by_tenant?: Array<{ id: string; name: string; units: number }>;
};

const DAY_OPTIONS = [7, 30, 90];

export default function PlatformUsagePage() {
  const [days, setDays] = useState(30);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<UsageData>(`/api/platform/usage?days=${days}`).then((res) => {
      if (res.ok) setUsage(res.data);
      setLoading(false);
    });
  }, [days]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="neo-heading text-2xl">Usage</h1>
        <p className="text-sm neo-text-muted mt-2">Platform API consumption for your organization.</p>
      </div>

      <div className="flex items-center gap-2">
        {DAY_OPTIONS.map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className="px-3 py-1 text-xs rounded-md"
            style={{
              background: days === d ? "var(--neo-surface2)" : "transparent",
              color: days === d ? "var(--neo-fg)" : "var(--neo-fg-muted)",
              border: "1px solid var(--neo-border)",
            }}
          >
            {d}d
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm neo-text-muted">Loading…</p>
      ) : !usage ? (
        <p className="text-sm neo-text-muted">Failed to load usage.</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="neo-surface rounded-xl p-5">
              <p className="neo-label">Total operations</p>
              <p className="neo-heading text-3xl mt-2">{usage.totals.operations}</p>
              <p className="text-xs neo-text-muted mt-1">
                {new Date(usage.period.start).toLocaleDateString()} –{" "}
                {new Date(usage.period.end).toLocaleDateString()}
              </p>
            </div>
            <div className="neo-surface rounded-xl p-5">
              <p className="neo-label">Total units</p>
              <p className="neo-heading text-3xl mt-2">{usage.totals.units}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="neo-surface rounded-xl p-5 space-y-3">
              <p className="neo-label">By operation</p>
              {Object.keys(usage.by_operation).length === 0 ? (
                <p className="text-sm neo-text-muted">No data</p>
              ) : (
                Object.entries(usage.by_operation)
                  .sort(([, a], [, b]) => b - a)
                  .map(([op, units]) => (
                    <div key={op} className="flex justify-between text-sm">
                      <span className="font-mono" style={{ color: "var(--neo-fg)" }}>
                        {op}
                      </span>
                      <span className="neo-text-muted">{units}</span>
                    </div>
                  ))
              )}
            </div>

            <div className="neo-surface rounded-xl p-5 space-y-3">
              <p className="neo-label">By surface</p>
              {Object.keys(usage.by_via).length === 0 ? (
                <p className="text-sm neo-text-muted">No data</p>
              ) : (
                Object.entries(usage.by_via)
                  .sort(([, a], [, b]) => b - a)
                  .map(([via, units]) => (
                    <div key={via} className="flex justify-between text-sm">
                      <span style={{ color: "var(--neo-fg)" }}>{via}</span>
                      <span className="neo-text-muted">{units}</span>
                    </div>
                  ))
              )}
            </div>
          </div>

          {usage.by_tenant && usage.by_tenant.length > 0 && (
            <div className="neo-surface rounded-xl p-5 space-y-3">
              <p className="neo-label">By tenant</p>
              {usage.by_tenant
                .sort((a, b) => b.units - a.units)
                .map((t) => (
                  <div key={t.id} className="flex justify-between text-sm py-1">
                    <span style={{ color: "var(--neo-fg)" }}>{t.name}</span>
                    <span className="neo-text-muted">{t.units} units</span>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
