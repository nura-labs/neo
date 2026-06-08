"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { ProfileTab } from "@/components/settings/profile-tab";
import { GeneralTab } from "@/components/settings/general-tab";
import { MembersTab } from "@/components/settings/members-tab";
import { TokensTab } from "@/components/settings/tokens-tab";
import { PlatformTab } from "@/components/settings/platform-tab";

type Tab = "profile" | "workspace" | "members" | "tokens" | "platform";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "workspace", label: "Workspace" },
  { id: "members", label: "Members" },
  { id: "tokens", label: "Setup & tokens" },
  { id: "platform", label: "Platform" },
];

function SettingsContent() {
  const { currentWorkspace } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(
    tabParam === "platform" ? "platform" : "profile"
  );

  useEffect(() => {
    if (tabParam === "platform") setTab("platform");
  }, [tabParam]);

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
        {tab === "platform" && <PlatformTab />}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-sm neo-text-muted">Loading…</p>}>
      <SettingsContent />
    </Suspense>
  );
}
