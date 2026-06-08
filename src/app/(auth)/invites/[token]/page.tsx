"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";

type InviteInfo = {
  workspace: { name: string; slug: string } | null;
  inviter: { name: string } | null;
  email: string;
  role: "owner" | "member";
  expiresAt: string;
};

export default function InviteLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { user, refreshWorkspaces, setCurrentWorkspaceSlug, getIdToken } = useAuth();
  const router = useRouter();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/invites/${token}`);
      if (cancelled) return;
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Invite invalid");
        setLoading(false);
        return;
      }
      setInfo((await res.json()) as InviteInfo);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    setAccepting(true);
    setError("");
    const idToken = await getIdToken();
    if (!idToken) {
      router.push(`/login?next=/invites/${token}`);
      return;
    }
    const res = await fetch(`/api/invites/${token}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    setAccepting(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Failed to accept");
      return;
    }
    const data = (await res.json()) as {
      workspace: { slug: string };
    };
    await refreshWorkspaces();
    setCurrentWorkspaceSlug(data.workspace.slug);
    router.push("/");
  }

  if (loading) {
    return (
      <div className="space-y-2 text-center">
        <p className="text-sm neo-text-muted">Loading invite…</p>
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="neo-heading text-xl">Invite unavailable</h1>
        <p className="text-sm neo-text-muted">{error}</p>
      </div>
    );
  }

  const emailMatches =
    !!user?.email && user.email.toLowerCase() === info.email.toLowerCase();

  return (
    <div className="space-y-6 text-center">
      <div className="space-y-1">
        <h1 className="neo-heading text-xl">
          You&apos;re invited to {info.workspace?.name ?? "a workspace"}
        </h1>
        <p className="text-sm neo-text-muted">
          {info.inviter?.name ?? "Someone"} invited <strong>{info.email}</strong>{" "}
          as a {info.role}.
        </p>
      </div>

      {!user && (
        <Link
          href={`/login?next=/invites/${token}`}
          className="inline-block rounded-lg px-4 py-2 text-sm font-medium"
          style={{ background: "var(--neo-accent)", color: "#fff" }}
        >
          Sign in to accept
        </Link>
      )}

      {user && !emailMatches && (
        <p className="text-sm" style={{ color: "var(--neo-error)" }}>
          You&apos;re signed in as {user.email}, but this invite is for{" "}
          {info.email}.
        </p>
      )}

      {user && emailMatches && (
        <button
          onClick={accept}
          disabled={accepting}
          className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--neo-accent)", color: "#fff" }}
        >
          {accepting ? "Joining..." : `Join ${info.workspace?.name}`}
        </button>
      )}
    </div>
  );
}
