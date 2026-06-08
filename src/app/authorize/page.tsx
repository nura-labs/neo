"use client";

import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GithubAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/auth/firebase-client";
import { getAuthErrorMessage } from "@/lib/auth/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Workspace = { id: string; slug: string; name: string };

function AuthorizeForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  // Workspace selection step (post-auth)
  const [pendingIdToken, setPendingIdToken] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");

  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method") ?? "S256";
  const state = searchParams.get("state");
  const responseType = searchParams.get("response_type");

  if (responseType && responseType !== "code") {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Unsupported response_type: {responseType}</p>
        </CardContent>
      </Card>
    );
  }

  async function completeAuth(idToken: string, workspaceSlug?: string) {
    const res = await fetch("/api/auth/authorize-callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken,
        clientId,
        redirectUri,
        codeChallenge,
        codeChallengeMethod,
        state,
        workspaceSlug,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error_description ?? "Authorization failed");
    }

    const data = await res.json();
    window.location.href = data.redirectUrl;
  }

  // After auth, fetch user's workspaces. If >1, prompt to pick one;
  // if exactly 1, auto-complete; if 0, the user is brand new and the
  // auto-create logic in the callback will handle it.
  async function postAuth(idToken: string) {
    const res = await fetch("/api/workspaces", {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) {
      // If we can't list workspaces, just call callback without slug — it
      // will fall back to oldest membership or auto-create.
      return completeAuth(idToken);
    }
    const data = (await res.json()) as { workspaces: Workspace[] };
    if (data.workspaces.length <= 1) {
      return completeAuth(idToken, data.workspaces[0]?.slug);
    }
    setPendingIdToken(idToken);
    setWorkspaces(data.workspaces);
    setSelectedSlug(data.workspaces[0].slug);
    setLoading(false);
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let result;
      if (mode === "login") {
        result = await signInWithEmailAndPassword(auth, email, password);
      } else {
        result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: name });
      }
      const idToken = await result.user.getIdToken();
      await postAuth(idToken);
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setLoading(false);
    }
  }

  async function handleGithubAuth() {
    setError("");
    setLoading(true);
    try {
      const provider = new GithubAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      await postAuth(idToken);
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setLoading(false);
    }
  }

  async function handleConfirmWorkspace() {
    if (!pendingIdToken) return;
    setError("");
    setLoading(true);
    try {
      await completeAuth(pendingIdToken, selectedSlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authorization failed");
      setLoading(false);
    }
  }

  if (pendingIdToken) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Neo</CardTitle>
          <CardDescription className="text-xs">by Nura Labs</CardDescription>
          <CardDescription className="mt-2">
            Choose the workspace to connect
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {workspaces.map((w) => (
              <label
                key={w.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-accent"
              >
                <input
                  type="radio"
                  name="workspace"
                  value={w.slug}
                  checked={selectedSlug === w.slug}
                  onChange={(e) => setSelectedSlug(e.target.value)}
                />
                <div>
                  <div className="text-sm font-medium">{w.name}</div>
                  <div className="text-xs text-muted-foreground">{w.slug}</div>
                </div>
              </label>
            ))}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            className="w-full"
            disabled={loading || !selectedSlug}
            onClick={handleConfirmWorkspace}
          >
            {loading ? "Connecting..." : "Authorize this workspace"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold">Neo</CardTitle>
        <CardDescription className="text-xs">by Nura Labs</CardDescription>
        <CardDescription className="mt-2">
          {mode === "login" ? "Sign in to connect your tools" : "Create your account"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleEmailAuth} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Connecting..." : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={handleGithubAuth} disabled={loading}>
          Continue with GitHub
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button onClick={() => setMode("signup")} className="underline underline-offset-4 hover:text-primary">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button onClick={() => setMode("login")} className="underline underline-offset-4 hover:text-primary">
                Sign in
              </button>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

export default function AuthorizePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <Suspense fallback={<div className="text-center text-muted-foreground">Loading...</div>}>
          <AuthorizeForm />
        </Suspense>
      </div>
    </div>
  );
}
