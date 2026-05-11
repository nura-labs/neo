"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateProfile } from "firebase/auth";
import { auth } from "@/lib/auth/firebase-client";
import { useAuth } from "@/contexts/auth-context";
import { LogOut } from "lucide-react";

export function ProfileTab() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setMsg("");
    try {
      await updateProfile(user, { displayName: name });
      // Force a reload so any place we display the name gets the new value
      setMsg("Saved");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    await signOut();
    router.push("/login");
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt=""
            className="h-16 w-16 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-medium"
            style={{
              background: "var(--neo-surface2)",
              color: "var(--neo-fg-muted)",
            }}
          >
            {(user.displayName ?? user.email ?? "U")[0].toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {user.displayName ?? "Unnamed"}
          </p>
          <p className="text-xs neo-text-muted truncate">{user.email}</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="neo-label" htmlFor="profile-name">
          Display name
        </label>
        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm"
          style={{
            background: "var(--neo-surface2)",
            border: "1px solid var(--neo-border)",
            color: "var(--neo-fg)",
          }}
        />
      </div>

      <div className="space-y-2">
        <span className="neo-label">Email</span>
        <p className="text-sm" style={{ color: "var(--neo-fg-muted)" }}>
          {user.email}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={handleSave}
          disabled={saving || name === (user.displayName ?? "")}
          className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--neo-accent)", color: "#fff" }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {msg && (
          <span className="text-sm" style={{ color: "var(--neo-fg-muted)" }}>
            {msg}
          </span>
        )}
        <button
          onClick={handleSignOut}
          className="ml-auto flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
          style={{
            color: "var(--neo-fg-muted)",
            border: "1px solid var(--neo-border)",
          }}
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </div>
  );
}
