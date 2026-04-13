"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Check, LogOut } from "lucide-react";

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
      <div className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: "var(--neo-surface2)", border: "1px solid var(--neo-border)" }}>
        <code className="text-xs truncate" style={{ color: "var(--neo-fg-secondary)", fontFamily: "var(--font-mono)" }}>{command}</code>
        <button onClick={handleCopy} className="shrink-0 ml-3 p-1 rounded transition-colors" style={{ color: copied ? "var(--neo-success)" : "var(--neo-fg-muted)" }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://neo.nura.sh";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await signOut();
    router.push("/login");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Profile */}
      <div className="neo-surface rounded-xl p-6">
        <div className="flex items-center gap-4">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="h-16 w-16 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "var(--neo-fg-muted)" }}>
              {(user?.displayName ?? user?.email ?? "U")[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="neo-heading text-lg">{user?.displayName ?? "User"}</h1>
            <p className="text-sm" style={{ color: "var(--neo-fg-muted)" }}>{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
            style={{ color: "var(--neo-fg-muted)", border: "1px solid var(--neo-border)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--neo-border-hover)"; e.currentTarget.style.color = "var(--neo-fg)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--neo-border)"; e.currentTarget.style.color = "var(--neo-fg-muted)"; }}
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </div>

      {/* Setup */}
      <div className="neo-surface rounded-xl p-5 space-y-5">
        <div className="space-y-1">
          <span className="neo-label">Setup</span>
          <p className="text-sm" style={{ color: "var(--neo-fg-secondary)" }}>Connect your AI tools to Neo</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium" style={{ color: "var(--neo-fg)" }}>1. Install the skills</p>
            <CopyBlock command="npx skills add nura-labs/neo-skills" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium" style={{ color: "var(--neo-fg)" }}>2. Add the MCP server</p>
            <CopyBlock label="Claude Code" command={`claude mcp add --transport http neo ${appUrl}/api/mcp`} />
            <CopyBlock label="Cursor / Codex" command={`${appUrl}/api/mcp`} />
          </div>
        </div>
      </div>
    </div>
  );
}
