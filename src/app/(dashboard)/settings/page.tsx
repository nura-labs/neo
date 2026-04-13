"use client";

import { useAuth } from "@/contexts/auth-context";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

function CopyBlock({ label, command }: { label?: string; command: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
        <code className="text-xs truncate" style={{ color: "var(--neo-fg-secondary)", fontFamily: "var(--font-mono)" }}>
          {command}
        </code>
        <button
          onClick={handleCopy}
          className="shrink-0 ml-3 p-1 rounded transition-colors"
          style={{ color: copied ? "var(--neo-success)" : "var(--neo-fg-muted)" }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://neo.nura.sh";

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="neo-heading text-2xl">Settings</h1>

      {/* Setup */}
      <div className="neo-surface rounded-xl p-5 space-y-5">
        <div className="space-y-1">
          <span className="neo-label">Setup</span>
          <p className="text-sm" style={{ color: "var(--neo-fg-secondary)" }}>
            Connect your AI tools to Neo in 2 steps
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium" style={{ color: "var(--neo-fg)" }}>
              1. Install the skills
            </p>
            <CopyBlock command="npx skills add nura-labs/neo-skills" />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium" style={{ color: "var(--neo-fg)" }}>
              2. Add the MCP server
            </p>
            <CopyBlock
              label="Claude Code"
              command={`claude mcp add --transport http neo ${appUrl}/api/mcp`}
            />
            <CopyBlock
              label="Cursor / Codex"
              command={`${appUrl}/api/mcp`}
            />
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="neo-surface rounded-xl p-5 space-y-4">
        <span className="neo-label">Account</span>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--neo-fg-muted)" }}>Email</span>
            <span className="text-sm" style={{ color: "var(--neo-fg)" }}>{user?.email}</span>
          </div>
          <div
            className="h-px"
            style={{ background: "var(--neo-border)" }}
          />
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--neo-fg-muted)" }}>Name</span>
            <span className="text-sm" style={{ color: "var(--neo-fg)" }}>{user?.displayName ?? "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
