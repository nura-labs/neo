"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { nodeTypeColors } from "@/lib/graph/colors";
import Link from "next/link";
import { FileText, GitFork, Database, ArrowRight } from "lucide-react";

interface Overview {
  totalNodes: number;
  totalEdges: number;
  typeBreakdown: { type: string; count: number }[];
  sourceBreakdown: { source: string | null; count: number }[];
  recentNodes: { id: string; title: string; type: string; source: string | null; slug: string }[];
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
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

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiFetch<Overview>("/api/knowledge/overview").then((res) => {
      if (res.ok) setOverview(res.data);
      setLoaded(true);
    });
  }, []);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="neo-text-muted text-sm">Loading...</span>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="neo-text-muted text-sm">Failed to load overview.</span>
      </div>
    );
  }

  const maxTypeCount = Math.max(...overview.typeBreakdown.map((t) => t.count), 1);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="neo-heading text-2xl">Overview</h1>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Knowledge Nodes" value={overview.totalNodes} icon={FileText} />
        <StatCard label="Connections" value={overview.totalEdges} icon={GitFork} />
        <StatCard label="Sources" value={overview.sourceBreakdown.length} icon={Database} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Type breakdown */}
        <div className="neo-surface rounded-xl p-5 space-y-4">
          <span className="neo-label">By Type</span>
          {overview.typeBreakdown.length === 0 ? (
            <p className="neo-text-muted text-sm">No knowledge indexed yet</p>
          ) : (
            <div className="space-y-3">
              {overview.typeBreakdown.map((t) => (
                <div key={t.type} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: nodeTypeColors[t.type] ?? "var(--neo-fg-muted)" }}
                      />
                      <span className="text-sm" style={{ color: "var(--neo-fg)" }}>{t.type}</span>
                    </div>
                    <span className="text-sm neo-text-muted">{t.count}</span>
                  </div>
                  <div
                    className="h-1 rounded-full"
                    style={{ background: "var(--neo-surface2)" }}
                  >
                    <div
                      className="h-1 rounded-full transition-all"
                      style={{
                        width: `${(t.count / maxTypeCount) * 100}%`,
                        background: nodeTypeColors[t.type] ?? "var(--neo-fg-muted)",
                        opacity: 0.6,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent nodes */}
        <div className="neo-surface rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="neo-label">Recent</span>
            <Link
              href="/knowledge"
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: "var(--neo-fg-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neo-accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--neo-fg-muted)")}
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {overview.recentNodes.length === 0 ? (
            <div className="space-y-3 py-4">
              <p className="neo-text-muted text-sm">No knowledge indexed yet.</p>
              <p className="text-sm" style={{ color: "var(--neo-fg-secondary)" }}>
                Install the Neo skill and run &quot;index this project&quot; to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {overview.recentNodes.map((n) => (
                <Link
                  key={n.id}
                  href={`/knowledge/${n.id}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
                  style={{ color: "var(--neo-fg)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--neo-surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: nodeTypeColors[n.type] ?? "var(--neo-fg-muted)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-xs neo-text-muted truncate">
                      {n.type}{n.source ? ` · ${n.source}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Graph preview card */}
      <Link
        href="/graph"
        className="neo-surface-hover rounded-xl p-5 flex items-center justify-between cursor-pointer block"
      >
        <div className="space-y-1">
          <span className="neo-label">Knowledge Graph</span>
          <p className="text-sm" style={{ color: "var(--neo-fg-secondary)" }}>
            Visualize connections between {overview.totalNodes} nodes
          </p>
        </div>
        <ArrowRight size={16} style={{ color: "var(--neo-fg-muted)" }} />
      </Link>
    </div>
  );
}
