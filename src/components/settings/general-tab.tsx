"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";

export function GeneralTab() {
  const { currentWorkspace, refreshWorkspaces } = useAuth();
  const [name, setName] = useState(currentWorkspace?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  if (!currentWorkspace) return null;

  async function handleSave() {
    if (!currentWorkspace) return;
    setSaving(true);
    setMsg("");
    const res = await apiFetch(`/api/workspaces/${currentWorkspace.slug}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!res.ok) {
      setMsg("Save failed");
      return;
    }
    await refreshWorkspaces();
    setMsg("Saved");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="neo-label" htmlFor="ws-name">
          Workspace name
        </label>
        <input
          id="ws-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm"
          style={{
            background: "var(--neo-surface2)",
            border: "1px solid var(--neo-border)",
            color: "var(--neo-fg)",
          }}
        />
      </div>
      <div className="space-y-2">
        <label className="neo-label">Slug</label>
        <p
          className="text-sm font-mono"
          style={{ color: "var(--neo-fg-muted)" }}
        >
          {currentWorkspace.slug}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || name === currentWorkspace.name}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: "var(--neo-accent)", color: "#fff" }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {msg && (
          <span className="text-sm" style={{ color: "var(--neo-fg-muted)" }}>
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
