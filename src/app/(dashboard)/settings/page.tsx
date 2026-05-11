"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { ProfileTab } from "@/components/settings/profile-tab";
import { GeneralTab } from "@/components/settings/general-tab";
import { MembersTab } from "@/components/settings/members-tab";
import { TokensTab } from "@/components/settings/tokens-tab";

type Tab = "profile" | "workspace" | "members" | "tokens";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "workspace", label: "Workspace" },
  { id: "members", label: "Members" },
  { id: "tokens", label: "Connect & tokens" },
];

export default function SettingsPage() {
  const { currentWorkspace } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="neo-heading text-lg">Settings</h1>
        <p className="text-sm neo-text-muted">
          {currentWorkspace
            ? `${currentWorkspace.name} · ${currentWorkspace.slug}`
            : "Loading…"}
        </p>
      </div>

      <div
        className="flex gap-1 border-b overflow-x-auto"
        style={{ borderColor: "var(--neo-border)" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap"
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
        {tab === "profile" && <ProfileTab />}
        {tab === "workspace" && <GeneralTab />}
        {tab === "members" && <MembersTab />}
        {tab === "tokens" && <TokensTab />}
      </div>
    </div>
  );
}
