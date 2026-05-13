"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Copy, Check, ChevronRight } from "lucide-react";
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
          style={{
            color: "var(--neo-fg-secondary)",
            fontFamily: "var(--font-mono)",
          }}
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

function Step({
  n,
  title,
  description,
  children,
}: {
  n: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div
        className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium"
        style={{
          background: "var(--neo-surface2)",
          border: "1px solid var(--neo-border)",
          color: "var(--neo-fg)",
        }}
      >
        {n}
      </div>
      <div className="flex-1 space-y-2 pb-1">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--neo-fg)" }}>
            {title}
          </p>
          {description && (
            <p className="text-xs neo-text-muted mt-0.5">{description}</p>
          )}
        </div>
        {children}
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
  const [showManual, setShowManual] = useState(false);

  const isOwner = currentWorkspace?.role === "owner";

  const refresh = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const res = await apiFetch<{ tokens: ApiToken[] }>(
      `/api/workspaces/${currentWorkspace.slug}/tokens`
    );
    if (res.ok) setTokens(res.data.tokens);
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
    <div className="space-y-10">
      {/* ─── Setup walkthrough ─────────────────────────── */}
      <section className="space-y-5">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Set up Neo for your coding agent</h3>
          <p className="text-xs neo-text-muted">
            Four commands. After this, any AI agent in your terminal queries this
            workspace as persistent context.
          </p>
        </div>

        <div className="space-y-6">
          <Step
            n={1}
            title="Install the Neo CLI"
            description="One-time. Requires Node 20+."
          >
            <CopyBlock value="npm install -g @nuralabs/neo" />
            <p className="text-xs neo-text-muted">
              No Node? Grab the standalone binary:{" "}
              <a
                href="https://github.com/nura-labs/neo-cli/releases/latest"
                target="_blank"
                rel="noreferrer"
                className="underline"
                style={{ color: "var(--neo-fg)" }}
              >
                GitHub releases
              </a>
              .
            </p>
          </Step>

          <Step
            n={2}
            title="Sign in"
            description="Device flow — opens your browser, no copy-paste of tokens."
          >
            <CopyBlock value="neo auth login" />
          </Step>

          <Step
            n={3}
            title="Connect MCP to your coding agents"
            description="Auto-detects Claude Code, Cursor, Windsurf, VS Code. Writes the config so you don't have to."
          >
            <CopyBlock value="neo mcp install all" />
            <p className="text-xs neo-text-muted">
              Or install for a single client:{" "}
              <code className="font-mono" style={{ color: "var(--neo-fg-secondary)" }}>
                neo mcp install claude-code
              </code>
            </p>
          </Step>

          <Step
            n={4}
            title="Install the Neo skills"
            description="Three Claude/Cursor skills: index a project, write with wikilinks, query before coding."
          >
            <CopyBlock value="npx skills add nura-labs/neo-skill" />
            <p className="text-xs neo-text-muted">
              Installs <code className="font-mono">neo</code>,{" "}
              <code className="font-mono">neo-index</code>,{" "}
              <code className="font-mono">neo-wikilinks</code>. Restart your
              coding agent after.
            </p>
          </Step>
        </div>

        <div
          className="rounded-lg p-4"
          style={{
            background: "var(--neo-surface2)",
            border: "1px solid var(--neo-border)",
          }}
        >
          <p className="text-xs neo-text-muted">
            Done. Try this inside your coding agent:
          </p>
          <p className="text-sm font-medium mt-1" style={{ color: "var(--neo-fg)" }}>
            “Index this project in Neo”
          </p>
          <p className="text-sm font-medium" style={{ color: "var(--neo-fg)" }}>
            “What patterns does this codebase use?”
          </p>
        </div>
      </section>

      {/* ─── Tokens section ────────────────────────────── */}
      <section
        className="space-y-5 pt-8"
        style={{ borderTop: "1px solid var(--neo-border)" }}
      >
        <div className="space-y-1">
          <h3 className="text-sm font-medium">API tokens</h3>
          <p className="text-xs neo-text-muted">
            Workspace-scoped tokens for MCP clients. The CLI creates these for
            you on <code className="font-mono">neo mcp install</code>, but you
            can manage them by hand here.
          </p>
        </div>

        {isOwner && (
          <form onSubmit={createToken} className="space-y-2">
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

        <div className="space-y-2">
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
      </section>

      {/* ─── Manual fallback (collapsed) ───────────────── */}
      <section
        className="pt-8"
        style={{ borderTop: "1px solid var(--neo-border)" }}
      >
        <button
          onClick={() => setShowManual((v) => !v)}
          className="flex items-center gap-2 text-sm"
          style={{ color: "var(--neo-fg-muted)" }}
        >
          <ChevronRight
            size={14}
            style={{
              transform: showManual ? "rotate(90deg)" : "none",
              transition: "transform 120ms",
            }}
          />
          Manual setup (no CLI)
        </button>

        {showManual && (
          <div className="mt-4 space-y-3">
            <p className="text-xs neo-text-muted">
              If you can&apos;t or don&apos;t want to install the CLI, create a
              token above and paste this command in your terminal. Replace{" "}
              <code className="font-mono">YOUR_TOKEN</code> with the plaintext
              shown after creation.
            </p>
            <CopyBlock
              label="Claude Code"
              value={`claude mcp add --transport http neo-${currentWorkspace.slug} ${mcpUrl} --header "Authorization: Bearer YOUR_TOKEN"`}
            />
            <CopyBlock
              label="Cursor / Windsurf / Codex (URL)"
              value={mcpUrl}
            />
          </div>
        )}
      </section>
    </div>
  );
}
