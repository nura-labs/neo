"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { GeneralTab } from "@/components/settings/general-tab";
import { MembersTab } from "@/components/settings/members-tab";
import { TokensTab } from "@/components/settings/tokens-tab";

type Tab = "general" | "members" | "tokens";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "members", label: "Members" },
  { id: "tokens", label: "Tokens" },
];

export default function SettingsPage() {
  const { currentWorkspace } = useAuth();
  const [tab, setTab] = useState<Tab>("general");

  if (!currentWorkspace) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-sm neo-text-muted">Loading workspace…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="neo-heading text-lg">{currentWorkspace.name}</h1>
        <p className="text-sm neo-text-muted">Workspace settings</p>
      </div>

      <div
        className="flex gap-1 border-b"
        style={{ borderColor: "var(--neo-border)" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-2 text-sm font-medium transition-colors"
            style={{
              color: tab === t.id ? "var(--neo-fg)" : "var(--neo-fg-muted)",
              borderBottom:
                tab === t.id
                  ? "2px solid var(--neo-fg)"
                  : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="neo-surface rounded-xl p-6">
        {tab === "general" && <GeneralTab />}
        {tab === "members" && <MembersTab />}
        {tab === "tokens" && <TokensTab />}
      </div>
    </div>
  );
}
