"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";

type ApiToken = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

function CopyBlock({ label, value }: { label?: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      {label && <span className="neo-label">{label}</span>}
      <div
        className="flex items-center justify-between rounded-lg px-3 py-2.5"
        style={{
          background: "var(--neo-surface2)",
          border: "1px solid var(--neo-border)",
        }}
      >
        <code
          className="text-xs truncate"
          style={{ color: "var(--neo-fg-secondary)", fontFamily: "var(--font-mono)" }}
        >
          {value}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          className="shrink-0 ml-3 p-1 rounded"
          style={{ color: copied ? "var(--neo-success)" : "var(--neo-fg-muted)" }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

export function TokensTab() {
  const { currentWorkspace } = useAuth();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://neo.nura.sh";
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const [tokensRes, wsRes] = await Promise.all([
      apiFetch<{ tokens: ApiToken[] }>(
        `/api/workspaces/${currentWorkspace.slug}/tokens`
      ),
      apiFetch<{ role: "owner" | "member" }>(
        `/api/workspaces/${currentWorkspace.slug}`
      ),
    ]);
    if (tokensRes.ok) setTokens(tokensRes.data.tokens);
    if (wsRes.ok) setIsOwner(wsRes.data.role === "owner");
    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function createToken(e: React.FormEvent) {
    e.preventDefault();
    if (!currentWorkspace || !name.trim()) return;
    setCreating(true);
    const res = await apiFetch<{ plaintext: string }>(
      `/api/workspaces/${currentWorkspace.slug}/tokens`,
      {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      }
    );
    setCreating(false);
    if (res.ok) {
      setJustCreated(res.data.plaintext);
      setName("");
      refresh();
    }
  }

  async function revoke(id: string) {
    if (!currentWorkspace) return;
    if (!confirm("Revoke this token?")) return;
    const res = await apiFetch(
      `/api/workspaces/${currentWorkspace.slug}/tokens/${id}`,
      { method: "DELETE" }
    );
    if (res.ok) refresh();
  }

  if (!currentWorkspace) return null;

  const mcpUrl = `${appUrl}/api/mcp`;

  return (
    <div className="space-y-8">
      {isOwner && (
        <form onSubmit={createToken} className="space-y-3">
          <label htmlFor="token-name" className="neo-label">
            Create new token
          </label>
          <div className="flex gap-2">
            <input
              id="token-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. claude code"
              className="flex-1 rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--neo-surface2)",
                border: "1px solid var(--neo-border)",
                color: "var(--neo-fg)",
              }}
            />
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--neo-accent)", color: "#fff" }}
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      )}

      {justCreated && (
        <div
          className="rounded-lg p-4 space-y-3"
          style={{
            background: "var(--neo-surface2)",
            border: "1px solid var(--neo-accent)",
          }}
        >
          <div>
            <p className="text-sm font-medium">Copy this token now</p>
            <p className="text-xs neo-text-muted">
              We don&apos;t store the plaintext — you won&apos;t see it again.
            </p>
          </div>
          <CopyBlock value={justCreated} />
          <button
            onClick={() => setJustCreated(null)}
            className="text-xs"
            style={{ color: "var(--neo-fg-muted)" }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Tokens</h3>
        {loading ? (
          <p className="text-sm neo-text-muted">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm neo-text-muted">No tokens yet.</p>
        ) : (
          <ul className="space-y-2">
            {tokens.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-lg px-3 py-2.5"
                style={{
                  background: "var(--neo-surface2)",
                  border: "1px solid var(--neo-border)",
                }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <p className="text-xs neo-text-muted truncate font-mono">
                    {t.tokenPrefix}…
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs neo-text-muted">
                    {t.lastUsedAt
                      ? `Last used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                      : "Never used"}
                  </span>
                  {isOwner && (
                    <button
                      onClick={() => revoke(t.id)}
                      className="text-xs"
                      style={{ color: "var(--neo-error)" }}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Connect</h3>
        <CopyBlock
          label="Claude Code"
          value={`claude mcp add --transport http neo-${currentWorkspace.slug} ${mcpUrl} --header "Authorization: Bearer YOUR_TOKEN"`}
        />
        <CopyBlock label="Cursor / Codex (URL)" value={mcpUrl} />
      </div>
    </div>
  );
}
