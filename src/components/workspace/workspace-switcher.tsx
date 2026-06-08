"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Check, Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { CreateWorkspaceModal } from "./create-workspace-modal";

interface Props {
  collapsed?: boolean;
  /** Notion-style: workspace name in the sidebar header row */
  variant?: "default" | "header";
  headerExtra?: ReactNode;
}

export function WorkspaceSwitcher({
  collapsed = false,
  variant = "default",
  headerExtra,
}: Props) {
  const { workspaces, currentWorkspace, setCurrentWorkspaceSlug } = useAuth();

  const visibleWorkspaces = workspaces.filter((w) => !w.scope || w.scope === "personal");

  function pickWorkspace(slug: string) {
    if (slug === currentWorkspace?.slug) {
      setOpen(false);
      return;
    }
    setCurrentWorkspaceSlug(slug);
    setOpen(false);
    window.location.reload();
  }

  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const activeWorkspace =
    visibleWorkspaces.find((w) => w.slug === currentWorkspace?.slug) ??
    visibleWorkspaces[0] ??
    currentWorkspace;

  const isHeader = variant === "header";

  if (!activeWorkspace && visibleWorkspaces.length === 0) {
    return (
      <>
        <div
          className={
            isHeader
              ? collapsed
                ? "flex flex-col items-center gap-2 py-3 px-2"
                : "flex items-center gap-2 min-w-0 flex-1 px-1"
              : collapsed
                ? "flex justify-center"
                : ""
          }
        >
          <button
            onClick={() => setCreateOpen(true)}
            className={
              collapsed
                ? "flex h-7 w-7 items-center justify-center rounded text-xs transition-colors"
                : isHeader
                  ? "flex items-center gap-2 min-w-0 rounded-md px-1.5 py-1 text-sm transition-colors"
                  : "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm"
            }
            style={
              isHeader
                ? { color: "var(--neo-fg-muted)" }
                : undefined
            }
            aria-label="Create workspace"
          >
            <Plus className={collapsed ? "h-4 w-4" : "h-4 w-4 shrink-0"} />
            {!collapsed && <span className="truncate">New workspace</span>}
          </button>
          {isHeader && headerExtra}
        </div>
        <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
      </>
    );
  }

  if (!activeWorkspace) return isHeader ? headerExtra ?? null : null;

  const initials = activeWorkspace.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const iconEl = (
    <span
      className="flex shrink-0 items-center justify-center rounded font-semibold"
      style={{
        width: collapsed ? 28 : 22,
        height: collapsed ? 28 : 22,
        fontSize: collapsed ? 11 : 10,
        background: "var(--neo-surface2)",
        border: "1px solid var(--neo-border)",
        color: "var(--neo-fg)",
      }}
    >
      {initials}
    </span>
  );

  const menu = open ? (
    <SwitcherMenu
      workspaces={visibleWorkspaces}
      current={activeWorkspace}
      onPick={pickWorkspace}
      onCreate={() => {
        setOpen(false);
        setCreateOpen(true);
      }}
      floating={collapsed || isHeader}
      align={isHeader && !collapsed ? "header" : collapsed ? "collapsed" : "default"}
    />
  ) : null;

  if (isHeader) {
    if (collapsed) {
      return (
        <>
          <div className="flex flex-col items-center gap-2 py-3 px-2 shrink-0">
            <div ref={ref} className="relative">
              <button
                onClick={() => setOpen((v) => !v)}
                className="rounded transition-opacity hover:opacity-80"
                aria-label={`Switch workspace — ${activeWorkspace.name}`}
              >
                {iconEl}
              </button>
              {menu}
            </div>
            {headerExtra}
          </div>
          <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
        </>
      );
    }

    return (
      <>
        <div ref={ref} className="relative flex-1 min-w-0">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-2 min-w-0 rounded-md px-1.5 py-1.5 text-left transition-colors"
            style={{ color: "var(--neo-fg)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--neo-surface-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
            aria-label={`Switch workspace — ${activeWorkspace.name}`}
          >
            {iconEl}
            <span className="flex-1 truncate text-[13px] font-semibold tracking-tight">
              {activeWorkspace.name}
            </span>
            <ChevronDown
              size={14}
              className="shrink-0 transition-transform"
              style={{
                color: "var(--neo-fg-muted)",
                transform: open ? "rotate(180deg)" : undefined,
              }}
            />
          </button>
          {menu}
        </div>
        <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
      </>
    );
  }

  if (collapsed) {
    return (
      <>
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded transition-opacity hover:opacity-80"
            aria-label={`Switch workspace — ${activeWorkspace.name}`}
          >
            {iconEl}
          </button>
          {menu}
        </div>
        <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
      </>
    );
  }

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors"
          style={{
            background: "var(--neo-surface2)",
            border: "1px solid var(--neo-border)",
            color: "var(--neo-fg)",
          }}
        >
          {iconEl}
          <span className="flex-1 truncate font-medium">{activeWorkspace.name}</span>
          <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--neo-fg-muted)" }} />
        </button>
        {menu}
      </div>
      <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

function SwitcherMenu({
  workspaces,
  current,
  onPick,
  onCreate,
  floating = false,
  align = "default",
}: {
  workspaces: { id: string; slug: string; name: string }[];
  current: { slug: string };
  onPick: (slug: string) => void;
  onCreate: () => void;
  floating?: boolean;
  align?: "default" | "header" | "collapsed";
}) {
  const positionClass =
    align === "header"
      ? "absolute left-0 top-full mt-1 w-[calc(100%+2.5rem)] min-w-[240px]"
      : align === "collapsed"
        ? "absolute left-10 top-0"
        : floating
          ? "absolute left-12 top-0"
          : "absolute left-0 top-full mt-1 w-full";

  return (
    <div
      className={`${positionClass} z-50 rounded-lg p-1 shadow-lg`}
      style={{
        background: "var(--neo-surface)",
        border: "1px solid var(--neo-border)",
      }}
    >
      <div className="px-2 pb-1 pt-1.5 text-[11px] font-medium neo-text-muted">Workspaces</div>
      <ul className="max-h-64 overflow-y-auto">
        {workspaces.map((w) => (
          <li key={w.id}>
            <button
              onClick={() => onPick(w.slug)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
              style={{ color: "var(--neo-fg)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--neo-surface-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span className="truncate text-left">
                {w.name}
                <span className="block text-[10px] font-mono neo-text-muted">{w.slug}</span>
              </span>
              {w.slug === current.slug && (
                <Check className="h-4 w-4 shrink-0" style={{ color: "var(--neo-accent)" }} />
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className="my-1 h-px" style={{ background: "var(--neo-border)" }} />
      <button
        onClick={onCreate}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
        style={{ color: "var(--neo-fg)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--neo-surface-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <Plus className="h-4 w-4" />
        New workspace
      </button>
    </div>
  );
}
