"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Copy, Trash2 } from "lucide-react";

type ApiKey = {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
};

export default function PlatformKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<{ keys: ApiKey[] }>("/api/platform/keys");
    if (res.ok) setKeys(res.data.keys);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setNewSecret(null);

    const res = await apiFetch<ApiKey & { secret: string }>("/api/platform/keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    });

    setCreating(false);
    if (!res.ok) {
      setError((res.data as { error?: string })?.error ?? "Failed to create key");
      return;
    }

    setNewSecret(res.data.secret);
    setName("");
    await load();
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    const res = await apiFetch(`/api/platform/keys/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  function copySecret() {
    if (newSecret) navigator.clipboard.writeText(newSecret);
  }

  return (
    <div className="space-y-6">
      {newSecret && (
        <div
          className="rounded-xl p-4 space-y-2"
          style={{ background: "var(--neo-accent-muted)", border: "1px solid var(--neo-accent)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--neo-fg)" }}>
            Copy your API key now — it won&apos;t be shown again
          </p>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 text-xs font-mono px-3 py-2 rounded-lg break-all"
              style={{ background: "var(--neo-surface2)", color: "var(--neo-fg)" }}
            >
              {newSecret}
            </code>
            <button
              onClick={copySecret}
              className="p-2 rounded-lg shrink-0"
              style={{ background: "var(--neo-surface2)" }}
              title="Copy"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="neo-surface rounded-xl p-6 space-y-4">
        <h2 className="neo-heading text-base">Create API key</h2>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="flex-1 rounded-lg px-3 py-2 text-sm"
            style={{
              background: "var(--neo-surface2)",
              border: "1px solid var(--neo-border)",
              color: "var(--neo-fg)",
            }}
            placeholder="Production key"
          />
          <button
            type="submit"
            disabled={creating || !name}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: "var(--neo-accent)", color: "#fff" }}
          >
            {creating ? "Creating…" : "Create key"}
          </button>
        </form>
        {error && (
          <p className="text-sm" style={{ color: "var(--neo-error)" }}>
            {error}
          </p>
        )}
      </div>

      <div className="neo-surface rounded-xl p-6">
        <h2 className="neo-heading text-base mb-4">Active keys</h2>
        {loading ? (
          <p className="text-sm neo-text-muted">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="text-sm neo-text-muted">No API keys yet.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--neo-border)" }}>
            {keys.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--neo-fg)" }}>
                    {k.name}
                  </p>
                  <p className="text-xs neo-text-muted font-mono mt-0.5">
                    {k.token_prefix}… · {k.scopes.join(", ")}
                  </p>
                  {k.last_used_at && (
                    <p className="text-xs neo-text-muted mt-0.5">
                      Last used {new Date(k.last_used_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleRevoke(k.id)}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: "var(--neo-error)" }}
                  title="Revoke key"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
