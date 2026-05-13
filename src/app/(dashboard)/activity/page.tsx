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

const TYPE_LABELS: Record<string, string> = {
  search: "Searches",
  "node.create": "Nodes created",
  "node.update": "Nodes updated",
  "node.delete": "Nodes deleted",
  "edge.create": "Edges created",
  "member.join": "Members joined",
  "invite.send": "Invites sent",
  "token.create": "Tokens created",
  "dream.run": "Dream cycles",
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
      className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
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
      <div
        className="h-16 flex items-center justify-center text-xs"
        style={{ color: "var(--neo-fg-muted)" }}
      >
        No data
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  const w = 600;
  const h = 60;
  const stepX = w / Math.max(data.length - 1, 1);
  const points = data
    .map((d, i) => `${i * stepX},${h - (d.count / max) * h}`)
    .join(" ");
  const area = `0,${h} ${points} ${w},${h}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full h-16"
    >
      <polygon points={area} fill="var(--neo-accent)" fillOpacity="0.1" />
      <polyline
        points={points}
        fill="none"
        stroke="var(--neo-accent)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function ActivityPage() {
  const { user, currentWorkspace } = useAuth();
  const [window, setWindow] = useState<Window>("7d");
  const [activeType, setActiveType] = useState<string | "all">("all");
  const [activeVia, setActiveVia] = useState<Via | "all">("all");
  const [actor, setActor] = useState<"all" | "me">("all");
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const params = new URLSearchParams({ window, limit: "100", group: "day" });
    if (activeType !== "all") params.set("types", activeType);
    if (activeVia !== "all") params.set("via", activeVia);
    if (actor !== "all") params.set("actor", actor);
    const res = await apiFetch<ActivityResponse>(`/api/activity?${params}`);
    if (res.ok) setData(res.data);
    setLoading(false);
  }, [currentWorkspace, window, activeType, activeVia, actor]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    if (!data) return null;
    return {
      total: data.total,
      searches: data.byType.search ?? 0,
      nodesCreated: data.byType["node.create"] ?? 0,
      nodesUpdated: data.byType["node.update"] ?? 0,
    };
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
            Queries, knowledge changes, and tool calls in{" "}
            <span style={{ color: "var(--neo-fg)" }}>{currentWorkspace.name}</span>
          </p>
        </div>
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWindow(w.key)}
              className="px-3 py-1 text-xs rounded-md"
              style={{
                background: window === w.key ? "var(--neo-surface2)" : "transparent",
                color: window === w.key ? "var(--neo-fg)" : "var(--neo-fg-muted)",
                border: "1px solid var(--neo-border)",
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="neo-surface rounded-xl p-4">
          <p className="text-xs neo-text-muted">Total events</p>
          <p className="text-2xl mt-1" style={{ color: "var(--neo-fg)" }}>
            {stats?.total ?? "—"}
          </p>
        </div>
        <div className="neo-surface rounded-xl p-4">
          <p className="text-xs neo-text-muted">Searches</p>
          <p className="text-2xl mt-1" style={{ color: "var(--neo-fg)" }}>
            {stats?.searches ?? "—"}
          </p>
        </div>
        <div className="neo-surface rounded-xl p-4">
          <p className="text-xs neo-text-muted">Nodes created</p>
          <p className="text-2xl mt-1" style={{ color: "var(--neo-fg)" }}>
            {stats?.nodesCreated ?? "—"}
          </p>
        </div>
        <div className="neo-surface rounded-xl p-4">
          <p className="text-xs neo-text-muted">Nodes updated</p>
          <p className="text-2xl mt-1" style={{ color: "var(--neo-fg)" }}>
            {stats?.nodesUpdated ?? "—"}
          </p>
        </div>
      </div>

      {/* Sparkline */}
      <div className="neo-surface rounded-xl p-4">
        <p className="text-xs neo-text-muted mb-2">Events per day</p>
        {data?.timeseries && <Sparkline data={data.timeseries} />}
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
            All
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
              {TYPE_LABELS[t] ?? t}{" "}
              <span className="opacity-60">{n}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="neo-label">Via</span>
          {(["all", "web", "mcp", "cli"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setActiveVia(v)}
              className="text-xs px-2 py-1 rounded-md uppercase"
              style={{
                background: activeVia === v ? "var(--neo-surface2)" : "transparent",
                color: activeVia === v ? "var(--neo-fg)" : "var(--neo-fg-muted)",
                border: "1px solid var(--neo-border)",
              }}
            >
              {v}
              {v !== "all" && (
                <span className="ml-1 opacity-60">{data?.byVia[v] ?? 0}</span>
              )}
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
              const actorLabel =
                e.actor?.name ?? e.actor?.username ?? e.actor?.email ?? "system";
              const isMe = e.actor?.email?.toLowerCase() === user?.email?.toLowerCase();
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
                      <span className="font-mono">{e.type}</span>
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
