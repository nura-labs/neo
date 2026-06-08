"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { InviteMemberModal } from "@/components/workspace/invite-member-modal";

type Member = {
  userId: string;
  name: string;
  email: string;
  username: string;
  role: "owner" | "member";
  joinedAt: string;
};

type Invite = {
  id: string;
  email: string;
  role: "owner" | "member";
  expiresAt: string;
};

export function MembersTab() {
  const { user, currentWorkspace } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    setError("");
    const [membersRes, invitesRes] = await Promise.all([
      apiFetch<{ members: Member[] }>(
        `/api/workspaces/${currentWorkspace.slug}/members`
      ),
      apiFetch<{ invites: Invite[] }>(
        `/api/workspaces/${currentWorkspace.slug}/invites`
      ),
    ]);
    if (membersRes.ok) setMembers(membersRes.data.members);
    // members-only callers can't list invites — silently ignore 403
    if (invitesRes.ok) setInvites(invitesRes.data.invites);
    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // Derive role from the members list itself — match the currently-signed-in
  // Firebase user by email. More reliable than a separate /api/workspaces/[slug]
  // round-trip that was returning stale data on this tab.
  const myMember = members.find(
    (m) => m.email.toLowerCase() === user?.email?.toLowerCase()
  );
  const isOwner = myMember?.role === "owner";
  const ownerCount = members.filter((m) => m.role === "owner").length;

  async function removeMember(userId: string, label: string) {
    if (!currentWorkspace) return;
    if (!confirm(`Remove ${label} from this workspace?`)) return;
    setError("");
    const res = await apiFetch(
      `/api/workspaces/${currentWorkspace.slug}/members/${userId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      setError(
        (res.data as { error?: string } | null)?.error ?? "Could not remove"
      );
      return;
    }
    refresh();
  }

  async function changeRole(userId: string, role: "owner" | "member") {
    if (!currentWorkspace) return;
    setPendingRoleChange(userId);
    setError("");
    const res = await apiFetch(
      `/api/workspaces/${currentWorkspace.slug}/members/${userId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }
    );
    setPendingRoleChange(null);
    if (!res.ok) {
      setError(
        (res.data as { error?: string } | null)?.error ?? "Could not change role"
      );
      return;
    }
    refresh();
  }

  async function revoke(inviteId: string) {
    if (!currentWorkspace) return;
    setError("");
    const res = await apiFetch(
      `/api/workspaces/${currentWorkspace.slug}/invites/${inviteId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      setError(
        (res.data as { error?: string } | null)?.error ?? "Could not revoke"
      );
      return;
    }
    refresh();
  }

  if (!currentWorkspace) return null;
  if (loading) return <p className="text-sm neo-text-muted">Loading…</p>;

  return (
    <div className="space-y-8">
      {error && (
        <p className="text-sm" style={{ color: "var(--neo-error)" }}>
          {error}
        </p>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Members</h3>
          {isOwner && (
            <button
              onClick={() => setInviteOpen(true)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ background: "var(--neo-accent)", color: "#fff" }}
            >
              Invite
            </button>
          )}
        </div>
        <ul className="space-y-2">
          {members.map((m) => {
            const isMe = m.userId === myMember?.userId;
            const isLastOwner = m.role === "owner" && ownerCount === 1;
            return (
              <li
                key={m.userId}
                className="flex items-center justify-between rounded-lg px-3 py-2.5"
                style={{
                  background: "var(--neo-surface2)",
                  border: "1px solid var(--neo-border)",
                }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m.name} {isMe && <span className="neo-text-muted text-xs font-normal">(you)</span>}
                  </p>
                  <p className="text-xs neo-text-muted truncate">
                    {m.email} · @{m.username}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {isOwner ? (
                    <select
                      value={m.role}
                      onChange={(e) =>
                        changeRole(m.userId, e.target.value as "owner" | "member")
                      }
                      disabled={
                        pendingRoleChange === m.userId || (isMe && isLastOwner)
                      }
                      className="rounded-md px-2 py-1 text-xs disabled:opacity-50"
                      style={{
                        background: "var(--neo-surface)",
                        border: "1px solid var(--neo-border)",
                        color: "var(--neo-fg)",
                      }}
                    >
                      <option value="owner">owner</option>
                      <option value="member">member</option>
                    </select>
                  ) : (
                    <span className="text-xs neo-text-muted">{m.role}</span>
                  )}
                  {isOwner && !isMe && !isLastOwner && (
                    <button
                      onClick={() => removeMember(m.userId, m.email)}
                      className="text-xs"
                      style={{ color: "var(--neo-error)" }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {isOwner && invites.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Pending invites</h3>
          <ul className="space-y-2">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded-lg px-3 py-2.5"
                style={{
                  background: "var(--neo-surface2)",
                  border: "1px solid var(--neo-border)",
                }}
              >
                <div className="min-w-0">
                  <p className="text-sm truncate">{inv.email}</p>
                  <p className="text-xs neo-text-muted">
                    {inv.role} · expires{" "}
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => revoke(inv.id)}
                  className="text-xs"
                  style={{ color: "var(--neo-error)" }}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={refresh}
      />
    </div>
  );
}
