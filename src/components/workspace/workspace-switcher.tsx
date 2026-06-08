"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { CreateWorkspaceModal } from "./create-workspace-modal";

interface Props {
  collapsed?: boolean;
}

export function WorkspaceSwitcher({ collapsed = false }: Props) {
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

  if (!activeWorkspace && visibleWorkspaces.length === 0) {
    return (
      <>
        <div className={collapsed ? "flex justify-center" : ""}>
          <button
            onClick={() => setCreateOpen(true)}
            className={
              collapsed
                ? "flex h-9 w-9 items-center justify-center rounded-md border bg-card hover:bg-accent"
                : "flex w-full items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:bg-accent"
            }
            aria-label="Create workspace"
          >
            <Plus className={collapsed ? "h-4 w-4" : "h-4 w-4 shrink-0"} />
            {!collapsed && <span className="truncate">New workspace</span>}
          </button>
        </div>
        <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
      </>
    );
  }

  if (!activeWorkspace) return null;

  const initials = activeWorkspace.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (collapsed) {
    return (
      <>
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md border bg-card text-sm font-medium hover:bg-accent"
            aria-label="Switch workspace"
          >
            {initials}
          </button>
          {open && (
            <SwitcherMenu
              workspaces={visibleWorkspaces}
              current={activeWorkspace}
              onPick={pickWorkspace}
              onCreate={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
              floating
            />
          )}
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
          className="flex w-full items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-accent"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary text-xs font-medium text-primary-foreground">
            {initials}
          </span>
          <span className="flex-1 truncate font-medium">{activeWorkspace.name}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        {open && (
          <SwitcherMenu
            workspaces={visibleWorkspaces}
            current={activeWorkspace}
            onPick={pickWorkspace}
            onCreate={() => {
              setOpen(false);
              setCreateOpen(true);
            }}
          />
        )}
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
}: {
  workspaces: { id: string; slug: string; name: string }[];
  current: { slug: string };
  onPick: (slug: string) => void;
  onCreate: () => void;
  floating?: boolean;
}) {
  return (
    <div
      className={`${floating ? "absolute left-12 top-0" : "absolute left-0 top-full mt-1 w-full"} z-50 min-w-[220px] rounded-md border bg-popover p-1 shadow-md`}
    >
      <div className="px-2 pb-1 pt-1 text-xs font-medium text-muted-foreground">Workspaces</div>
      <ul className="max-h-64 overflow-y-auto">
        {workspaces.map((w) => (
          <li key={w.id}>
            <button
              onClick={() => onPick(w.slug)}
              className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            >
              <span className="truncate text-left">
                {w.name}
                <span className="block text-[10px] font-mono text-muted-foreground">{w.slug}</span>
              </span>
              {w.slug === current.slug && (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className="my-1 h-px bg-border" />
      <button
        onClick={onCreate}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
      >
        <Plus className="h-4 w-4" />
        New workspace
      </button>
    </div>
  );
}
