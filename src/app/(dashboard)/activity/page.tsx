"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";

type Window = "24h" | "7d" | "30d" | "90d" | "365d";
type Via = "web" | "mcp" | "cli" | "system";

type Event = {
  id: string;
  type: string;
  via: Via;
  summary: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  actor: { username: string | null; name: string | null; email: string | null } | null;
};

type ActivityResponse = {
  window: string;
  from: string;
  total: number;
  byType: Record<string, number>;
  byVia: Record<string, number>;
  timeseries?: { bucket: string; count: number }[];
  events: Event[];
};

const WINDOWS: { key: Window; label: string }[] = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "365d", label: "1y" },
];

// Billing categories — only via=mcp|cli count toward plan limits.
const QUERY_TYPES = new Set(["search", "howto.read"]);
const WRITE_TYPES = new Set(["node.create", "node.update", "node.delete"]);
const READ_TYPES = new Set(["node.read", "overview.read", "related.read"]);
const COUNTABLE_VIA = new Set<Via>(["mcp", "cli"]);

const TYPE_LABEL: Record<string, string> = {
  search: "Search",
  "howto.read": "How-to",
  "node.read": "Read node",
  "overview.read": "Read overview",
  "related.read": "Read related",
  "node.create": "Create node",
  "node.update": "Update node",
  "node.delete": "Delete node",
  "member.join": "Member joined",
  "invite.send": "Invite sent",
  "token.create": "Token created",
  "dream.run": "Dream cycle",
};

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)}d ago`;
  return d.toLocaleDateString();
}

function ViaBadge({ via }: { via: Via }) {
  const colors: Record<Via, string> = {
    web: "var(--neo-fg-muted)",
    mcp: "var(--neo-accent)",
    cli: "var(--neo-fg-secondary)",
    system: "var(--neo-fg-muted)",
  };
  return (
    <span
      className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
      style={{
        border: `1px solid ${colors[via] ?? "var(--neo-border)"}`,
        color: colors[via] ?? "var(--neo-fg-muted)",
      }}
    >
      {via}
    </span>
  );
}

function Sparkline({ data }: { data: { bucket: string; count: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="h-16 flex items-center justify-center text-xs" style={{ color: "var(--neo-fg-muted)" }}>
        No data
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  const w = 600;
  const h = 60;
  const stepX = w / Math.max(data.length - 1, 1);
  const points = data.map((d, i) => `${i * stepX},${h - (d.count / max) * h}`).join(" ");
  const area = `0,${h} ${points} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-16">
      <polygon points={area} fill="var(--neo-accent)" fillOpacity="0.1" />
      <polyline points={points} fill="none" stroke="var(--neo-accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function ActivityPage() {
  const { user, currentWorkspace } = useAuth();
  const [windowSel, setWindowSel] = useState<Window>("7d");
  const [activeType, setActiveType] = useState<string | "all">("all");
  const [activeVia, setActiveVia] = useState<Via | "all" | "billable">("all");
  const [actor, setActor] = useState<"all" | "me">("all");
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const params = new URLSearchParams({ window: windowSel, limit: "100", group: "day" });
    if (activeType !== "all") params.set("types", activeType);
    if (activeVia === "billable") params.set("via", "mcp,cli");
    else if (activeVia !== "all") params.set("via", activeVia);
    if (actor !== "all") params.set("actor", actor);
    const res = await apiFetch<ActivityResponse>(`/api/activity?${params}`);
    if (res.ok) setData(res.data);
    setLoading(false);
  }, [currentWorkspace, windowSel, activeType, activeVia, actor]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // Compute the 3 counters: only events via mcp|cli count toward plan.
  const counts = useMemo(() => {
    if (!data) return null;
    let queries = 0;
    let writes = 0;
    let reads = 0;
    let webActions = 0;
    for (const e of data.events) {
      if (e.via === "web") {
        webActions++;
        continue;
      }
      if (!COUNTABLE_VIA.has(e.via)) continue;
      if (QUERY_TYPES.has(e.type)) queries++;
      else if (WRITE_TYPES.has(e.type)) writes++;
      else if (READ_TYPES.has(e.type)) reads++;
    }
    // Counter from server-side byType is more accurate (covers >100 events), but
    // for the visible feed window we use what we just received. Trade-off is
    // acceptable for the demo — for billing we'd query directly.
    return { queries, writes, reads, webActions };
  }, [data]);

  if (!currentWorkspace) {
    return <p className="text-sm neo-text-muted">Loading…</p>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="neo-heading text-lg">Activity</h1>
          <p className="text-sm neo-text-muted">
            Usage in <span style={{ color: "var(--neo-fg)" }}>{currentWorkspace.name}</span>
            {" · "}
            <span className="text-xs">Only MCP and CLI calls count toward plan limits — web is shown for visibility.</span>
          </p>
        </div>
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWindowSel(w.key)}
              className="px-3 py-1 text-xs rounded-md"
              style={{
                background: windowSel === w.key ? "var(--neo-surface2)" : "transparent",
                color: windowSel === w.key ? "var(--neo-fg)" : "var(--neo-fg-muted)",
                border: "1px solid var(--neo-border)",
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Billing counters — the 3 that matter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="neo-surface rounded-xl p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs neo-text-muted uppercase tracking-wider">Queries</p>
            <p className="text-[10px] neo-text-muted">via mcp / cli</p>
          </div>
          <p className="text-3xl mt-2" style={{ color: "var(--neo-fg)" }}>
            {counts?.queries ?? "—"}
          </p>
          <p className="text-xs neo-text-muted mt-1">search + how-to</p>
        </div>
        <div className="neo-surface rounded-xl p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs neo-text-muted uppercase tracking-wider">Writes</p>
            <p className="text-[10px] neo-text-muted">via mcp / cli</p>
          </div>
          <p className="text-3xl mt-2" style={{ color: "var(--neo-fg)" }}>
            {counts?.writes ?? "—"}
          </p>
          <p className="text-xs neo-text-muted mt-1">nodes + edges</p>
        </div>
        <div className="neo-surface rounded-xl p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs neo-text-muted uppercase tracking-wider">Reads</p>
            <p className="text-[10px]" style={{ color: "var(--neo-fg-muted)" }}>free · unlimited</p>
          </div>
          <p className="text-3xl mt-2" style={{ color: "var(--neo-fg)" }}>
            {counts?.reads ?? "—"}
          </p>
          <p className="text-xs neo-text-muted mt-1">node + overview + related</p>
        </div>
      </div>

      {/* Sparkline */}
      <div className="neo-surface rounded-xl p-4">
        <p className="text-xs neo-text-muted mb-2">Events per day (all sources)</p>
        {data?.timeseries && <Sparkline data={data.timeseries} />}
        <div className="flex justify-between text-[10px] neo-text-muted mt-1">
          <span>Total events in window: {data?.total ?? 0}</span>
          {counts !== null && counts.webActions > 0 && (
            <span>· {counts.webActions} via web (not counted)</span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="neo-label">Type</span>
          <button
            onClick={() => setActiveType("all")}
            className="text-xs px-2 py-1 rounded-md"
            style={{
              background: activeType === "all" ? "var(--neo-surface2)" : "transparent",
              color: activeType === "all" ? "var(--neo-fg)" : "var(--neo-fg-muted)",
              border: "1px solid var(--neo-border)",
            }}
          >
            All ({data?.total ?? 0})
          </button>
          {Object.entries(data?.byType ?? {}).map(([t, n]) => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className="text-xs px-2 py-1 rounded-md"
              style={{
                background: activeType === t ? "var(--neo-surface2)" : "transparent",
                color: activeType === t ? "var(--neo-fg)" : "var(--neo-fg-muted)",
                border: "1px solid var(--neo-border)",
              }}
            >
              {TYPE_LABEL[t] ?? t} <span className="opacity-60">{n}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="neo-label">Surface</span>
          {([
            { v: "all", label: "All" },
            { v: "billable", label: "Billable (MCP+CLI)" },
            { v: "web", label: "Web" },
            { v: "mcp", label: "MCP" },
            { v: "cli", label: "CLI" },
          ] as const).map((opt) => (
            <button
              key={opt.v}
              onClick={() => setActiveVia(opt.v)}
              className="text-xs px-2 py-1 rounded-md"
              style={{
                background: activeVia === opt.v ? "var(--neo-surface2)" : "transparent",
                color: activeVia === opt.v ? "var(--neo-fg)" : "var(--neo-fg-muted)",
                border: "1px solid var(--neo-border)",
              }}
            >
              {opt.label}
            </button>
          ))}
          <span className="neo-label ml-4">Actor</span>
          {(["all", "me"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setActor(a)}
              className="text-xs px-2 py-1 rounded-md"
              style={{
                background: actor === a ? "var(--neo-surface2)" : "transparent",
                color: actor === a ? "var(--neo-fg)" : "var(--neo-fg-muted)",
                border: "1px solid var(--neo-border)",
              }}
            >
              {a === "all" ? "Everyone" : "Me"}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div>
        <p className="neo-label mb-3">Events</p>
        {loading ? (
          <p className="text-sm neo-text-muted">Loading…</p>
        ) : !data?.events.length ? (
          <p className="text-sm neo-text-muted">No activity yet in this window.</p>
        ) : (
          <ul className="space-y-2">
            {data.events.map((e) => {
              const actorLabel = e.actor?.name ?? e.actor?.username ?? e.actor?.email ?? "system";
              const isMe = e.actor?.email?.toLowerCase() === user?.email?.toLowerCase();
              const counts =
                QUERY_TYPES.has(e.type) && COUNTABLE_VIA.has(e.via) ? "query"
                : WRITE_TYPES.has(e.type) && COUNTABLE_VIA.has(e.via) ? "write"
                : READ_TYPES.has(e.type) && COUNTABLE_VIA.has(e.via) ? "read"
                : null;
              return (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-3 rounded-lg px-3 py-2.5"
                  style={{
                    background: "var(--neo-surface2)",
                    border: "1px solid var(--neo-border)",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate" style={{ color: "var(--neo-fg)" }}>
                      {e.summary}
                    </p>
                    <p className="text-xs neo-text-muted mt-0.5">
                      {actorLabel}
                      {isMe && " (you)"} · {fmtRelative(e.createdAt)} ·{" "}
                      <span className="font-mono">{TYPE_LABEL[e.type] ?? e.type}</span>
                      {counts && (
                        <span
                          className="ml-2 text-[10px] uppercase tracking-wider"
                          style={{ color: "var(--neo-accent)" }}
                        >
                          counts as {counts}
                        </span>
                      )}
                    </p>
                  </div>
                  <ViaBadge via={e.via} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
