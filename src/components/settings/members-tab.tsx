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
  const { currentWorkspace } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const [membersRes, invitesRes, wsRes] = await Promise.all([
      apiFetch<{ members: Member[] }>(
        `/api/workspaces/${currentWorkspace.slug}/members`
      ),
      apiFetch<{ invites: Invite[] }>(
        `/api/workspaces/${currentWorkspace.slug}/invites`
      ),
      apiFetch<{ role: "owner" | "member" }>(
        `/api/workspaces/${currentWorkspace.slug}`
      ),
    ]);
    if (membersRes.ok) setMembers(membersRes.data.members);
    if (invitesRes.ok) setInvites(invitesRes.data.invites);
    if (wsRes.ok) setIsOwner(wsRes.data.role === "owner");
    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function removeMember(userId: string) {
    if (!currentWorkspace) return;
    if (!confirm("Remove this member?")) return;
    const res = await apiFetch(
      `/api/workspaces/${currentWorkspace.slug}/members/${userId}`,
      { method: "DELETE" }
    );
    if (res.ok) refresh();
  }

  async function revoke(inviteId: string) {
    if (!currentWorkspace) return;
    const res = await apiFetch(
      `/api/workspaces/${currentWorkspace.slug}/invites/${inviteId}`,
      { method: "DELETE" }
    );
    if (res.ok) refresh();
  }

  if (!currentWorkspace) return null;
  if (loading) return <p className="text-sm neo-text-muted">Loading…</p>;

  return (
    <div className="space-y-8">
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
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between rounded-lg px-3 py-2.5"
              style={{
                background: "var(--neo-surface2)",
                border: "1px solid var(--neo-border)",
              }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{m.name}</p>
                <p className="text-xs neo-text-muted truncate">
                  {m.email} · @{m.username}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs neo-text-muted">{m.role}</span>
                {isOwner && m.role !== "owner" && (
                  <button
                    onClick={() => removeMember(m.userId)}
                    className="text-xs"
                    style={{ color: "var(--neo-error)" }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
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
