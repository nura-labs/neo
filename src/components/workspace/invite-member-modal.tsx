"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Copy, Check } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}

export function InviteMemberModal({ open, onClose, onInvited }: Props) {
  const { currentWorkspace } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "owner">("member");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<{
    acceptUrl: string;
    emailSent: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentWorkspace) return;
    setError("");
    setLoading(true);
    const res = await apiFetch<{ acceptUrl: string; emailSent: boolean }>(
      `/api/workspaces/${currentWorkspace.slug}/invites`,
      {
        method: "POST",
        body: JSON.stringify({ email, role }),
      }
    );
    setLoading(false);
    if (!res.ok) {
      const data = res.data as { error?: string } | null;
      setError(data?.error ?? "Failed to invite");
      return;
    }
    setCreatedInvite(res.data);
    onInvited();
  }

  function reset() {
    setEmail("");
    setRole("member");
    setCreatedInvite(null);
    setCopied(false);
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  if (createdInvite) {
    return (
      <Modal
        open={open}
        onClose={handleClose}
        title="Invite created"
        description={
          createdInvite.emailSent
            ? "We sent an email invite. Share the link too if needed."
            : "Email failed — share this link with them directly."
        }
      >
        <div className="space-y-4">
          <div
            className="flex items-center justify-between rounded-md border p-3"
            style={{ background: "var(--neo-surface2)" }}
          >
            <code className="text-xs truncate">{createdInvite.acceptUrl}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdInvite.acceptUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              className="ml-3 shrink-0"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleClose}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: "var(--neo-accent)", color: "#fff" }}
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Invite member"
      description="They'll get an email with a 7-day link to join."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="invite-email" className="neo-label">
            Email
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              background: "var(--neo-surface2)",
              border: "1px solid var(--neo-border)",
              color: "var(--neo-fg)",
            }}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="invite-role" className="neo-label">
            Role
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as "owner" | "member")}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              background: "var(--neo-surface2)",
              border: "1px solid var(--neo-border)",
              color: "var(--neo-fg)",
            }}
          >
            <option value="member">Member</option>
            <option value="owner">Owner</option>
          </select>
        </div>
        {error && (
          <p className="text-sm" style={{ color: "var(--neo-error)" }}>
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm"
            style={{ border: "1px solid var(--neo-border)", color: "var(--neo-fg)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !email}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--neo-accent)", color: "#fff" }}
          >
            {loading ? "Sending..." : "Send invite"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
