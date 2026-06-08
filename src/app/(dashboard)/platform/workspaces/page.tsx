"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type PlatformWorkspace = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  scope: string;
  created_at: string;
};

function normalizeSlug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function PlatformWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<PlatformWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<{ workspaces: PlatformWorkspace[] }>(
      "/api/platform/workspaces"
    );
    if (res.ok) setWorkspaces(res.data.workspaces);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");

    const res = await apiFetch<PlatformWorkspace>("/api/platform/workspaces", {
      method: "POST",
      body: JSON.stringify({ name, slug: slug || undefined }),
    });

    setCreating(false);
    if (!res.ok) {
      setError((res.data as { error?: string })?.error ?? "Failed to create workspace");
      return;
    }

    setName("");
    setSlug("");
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="neo-surface rounded-xl p-6 space-y-4">
        <h2 className="neo-heading text-base">Create workspace</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="neo-label">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slug) setSlug(normalizeSlug(e.target.value));
                }}
                required
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  background: "var(--neo-surface2)",
                  border: "1px solid var(--neo-border)",
                  color: "var(--neo-fg)",
                }}
                placeholder="Acme Corp"
              />
            </div>
            <div className="space-y-1.5">
              <label className="neo-label">Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(normalizeSlug(e.target.value))}
                pattern="^[a-z0-9-]+$"
                className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                style={{
                  background: "var(--neo-surface2)",
                  border: "1px solid var(--neo-border)",
                  color: "var(--neo-fg)",
                }}
                placeholder="acme-corp"
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
            {creating ? "Creating…" : "Create workspace"}
          </button>
        </form>
      </div>

      <div className="neo-surface rounded-xl p-6">
        <h2 className="neo-heading text-base mb-4">Workspaces</h2>
        {loading ? (
          <p className="text-sm neo-text-muted">Loading…</p>
        ) : workspaces.length === 0 ? (
          <p className="text-sm neo-text-muted">No platform workspaces yet.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--neo-border)" }}>
            {workspaces.map((ws) => (
              <li
                key={ws.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--neo-fg)" }}>
                    {ws.name}
                  </p>
                  <p className="text-xs neo-text-muted font-mono mt-0.5">{ws.slug}</p>
                </div>
                <span className="text-xs neo-text-muted">{ws.plan}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
