"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GithubAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/auth/firebase-client";
import { getAuthErrorMessage } from "@/lib/auth/errors";
import { useAuth } from "@/contexts/auth-context";
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

function CliOnboardingInner() {
  const params = useSearchParams();
  const codeFromUrl = params.get("code") ?? "";
  const { user } = useAuth();
  const [code, setCode] = useState(codeFromUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setCode(codeFromUrl);
  }, [codeFromUrl]);

  async function authorize() {
    setError("");
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");
      const res = await fetch("/api/cli/device/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ user_code: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? "confirm_failed");
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to authorize");
    } finally {
      setLoading(false);
    }
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
      // Stay on this page — the useAuth() will pick up the change and the
      // authorize() call will work.
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGithubAuth() {
    setError("");
    setLoading(true);
    try {
      const provider = new GithubAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (confirmed) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Neo CLI</CardTitle>
          <CardDescription className="text-xs">by Nura Labs</CardDescription>
          <CardDescription className="mt-3 text-base">
            ✓ Authorized
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-center text-sm text-muted-foreground">
          <p>You can return to your terminal. Neo CLI is ready.</p>
          <p>This window can be closed.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold">Neo CLI</CardTitle>
        <CardDescription className="text-xs">by Nura Labs</CardDescription>
        <CardDescription className="mt-2">
          Authorize the CLI to act on behalf of your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="user-code">Code from the CLI</Label>
          <Input
            id="user-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD-EFGH"
            className="font-mono tracking-widest text-center text-lg"
            required
          />
          <p className="text-xs text-muted-foreground">
            This code should match what `neo auth login` printed in your
            terminal. It expires after 10 minutes.
          </p>
        </div>

        {!user ? (
          <>
            <form onSubmit={handleEmailAuth} className="space-y-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Sign in to authorize this code.
              </p>
              {mode === "signup" && (
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              )}
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email"
                required
              />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                minLength={6}
                required
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {mode === "login" ? "Sign in" : "Create account"}
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

            <Button
              variant="outline"
              className="w-full"
              onClick={handleGithubAuth}
              disabled={loading}
            >
              Continue with GitHub
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>
                  No account?{" "}
                  <button onClick={() => setMode("signup")} className="underline">
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Have an account?{" "}
                  <button onClick={() => setMode("login")} className="underline">
                    Sign in
                  </button>
                </>
              )}
            </p>
          </>
        ) : (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium">{user.email}</span>.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={authorize} className="w-full" disabled={loading || !code}>
              {loading ? "Authorizing…" : "Authorize Neo CLI"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CliOnboardingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <Suspense fallback={<div className="text-center text-muted-foreground">Loading…</div>}>
          <CliOnboardingInner />
        </Suspense>
      </div>
    </div>
  );
}
