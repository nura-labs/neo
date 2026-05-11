"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";

function normalizeSlug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function GeneralTab() {
  const { currentWorkspace, workspaces, refreshWorkspaces, setCurrentWorkspaceSlug } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(currentWorkspace?.name ?? "");
  const [slug, setSlug] = useState(currentWorkspace?.slug ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!currentWorkspace) return;
    setName(currentWorkspace.name);
    setSlug(currentWorkspace.slug);
    (async () => {
      const res = await apiFetch<{ role: "owner" | "member" }>(
        `/api/workspaces/${currentWorkspace.slug}`
      );
      if (res.ok) setIsOwner(res.data.role === "owner");
    })();
  }, [currentWorkspace]);

  if (!currentWorkspace) return null;

  const dirty =
    name !== currentWorkspace.name || slug !== currentWorkspace.slug;
  const slugChanged = slug !== currentWorkspace.slug;

  async function handleSave() {
    if (!currentWorkspace) return;
    setSaving(true);
    setMsg("");
    const payload: { name?: string; slug?: string } = {};
    if (name !== currentWorkspace.name) payload.name = name;
    if (slugChanged) payload.slug = slug;

    const res = await apiFetch<{ slug: string }>(
      `/api/workspaces/${currentWorkspace.slug}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );
    setSaving(false);

    if (!res.ok) {
      const err = (res.data as { error?: string } | null)?.error ?? "Save failed";
      setMsg(err);
      return;
    }

    await refreshWorkspaces();
    // If slug changed, update the active slug in context + localStorage and
    // navigate to settings under the new slug context (X-Workspace header
    // will resolve correctly on next request).
    if (slugChanged) {
      setCurrentWorkspaceSlug(res.data.slug);
    }
    setMsg("Saved");
  }

  async function handleDelete() {
    if (!currentWorkspace) return;
    if (
      !confirm(
        `Delete "${currentWorkspace.name}"? This permanently removes all knowledge, edges, members, and tokens. This cannot be undone.`
      )
    )
      return;
    setDeleting(true);
    const res = await apiFetch(`/api/workspaces/${currentWorkspace.slug}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (!res.ok) {
      const err = (res.data as { error?: string } | null)?.error ?? "Delete failed";
      setMsg(err);
      return;
    }
    await refreshWorkspaces();
    const fallback = workspaces.find((w) => w.id !== currentWorkspace.id);
    if (fallback) {
      setCurrentWorkspaceSlug(fallback.slug);
      window.location.href = "/";
    } else {
      router.push("/");
    }
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
          disabled={!isOwner}
          className="w-full rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          style={{
            background: "var(--neo-surface2)",
            border: "1px solid var(--neo-border)",
            color: "var(--neo-fg)",
          }}
        />
      </div>

      <div className="space-y-2">
        <label className="neo-label" htmlFor="ws-slug">
          Slug
        </label>
        <input
          id="ws-slug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(normalizeSlug(e.target.value))}
          disabled={!isOwner}
          className="w-full rounded-lg px-3 py-2 text-sm font-mono disabled:opacity-50"
          style={{
            background: "var(--neo-surface2)",
            border: "1px solid var(--neo-border)",
            color: "var(--neo-fg)",
          }}
        />
        <p className="text-xs neo-text-muted">
          Used in API tokens and internal routes. Renaming keeps existing
          tokens working — the old slug just stops showing in new ones.
        </p>
      </div>

      <div className="space-y-2">
        <span className="neo-label">Plan</span>
        <p className="text-sm" style={{ color: "var(--neo-fg-muted)" }}>
          {currentWorkspace.plan}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {isOwner && (
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--neo-accent)", color: "#fff" }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        )}
        {msg && (
          <span
            className="text-sm"
            style={{
              color: msg === "Saved" ? "var(--neo-fg-muted)" : "var(--neo-error)",
            }}
          >
            {msg}
          </span>
        )}
      </div>

      {isOwner && (
        <div
          className="pt-6 mt-6 space-y-3"
          style={{ borderTop: "1px solid var(--neo-border)" }}
        >
          <span className="neo-label">Danger zone</span>
          <p className="text-xs neo-text-muted">
            Deleting this workspace removes every knowledge node, edge,
            membership, and API token. There is no undo.
          </p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50"
            style={{
              background: "transparent",
              border: "1px solid var(--neo-error)",
              color: "var(--neo-error)",
            }}
          >
            {deleting ? "Deleting..." : "Delete workspace"}
          </button>
        </div>
      )}
    </div>
  );
}
