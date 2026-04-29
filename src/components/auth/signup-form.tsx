"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GithubAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/lib/auth/firebase-client";
import { getAuthErrorMessage } from "@/lib/auth/errors";
function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
import Link from "next/link";

export function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      router.push("/");
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setLoading(false);
    }
  }

  async function handleGithubSignup() {
    setError("");
    setLoading(true);
    try {
      const provider = new GithubAuthProvider();
      await signInWithPopup(auth, provider);
      router.push("/");
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setLoading(false);
    }
  }

  const inputStyle = {
    background: "var(--neo-surface2)",
    border: "1px solid var(--neo-border)",
    color: "var(--neo-fg)",
  };

  return (
    <div className="space-y-6">
      {/* Logo */}
      <div className="text-center space-y-1">
        <h1 className="neo-heading text-2xl">Neo</h1>
        <p className="neo-text-muted text-sm">Create your knowledge graph</p>
      </div>

      {/* Card */}
      <div className="neo-surface rounded-xl p-6 space-y-5">
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="neo-label">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--neo-border-strong)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--neo-border)")}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="neo-label">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--neo-border-strong)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--neo-border)")}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="neo-label">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--neo-border-strong)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--neo-border)")}
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: "var(--neo-error)" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: "var(--neo-accent)", color: "#fff" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--neo-accent-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--neo-accent)")}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: "var(--neo-border)" }} />
          <span className="neo-label">or</span>
          <div className="flex-1 h-px" style={{ background: "var(--neo-border)" }} />
        </div>

        {/* GitHub */}
        <button
          onClick={handleGithubSignup}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            background: "transparent",
            border: "1px solid var(--neo-border)",
            color: "var(--neo-fg)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--neo-border-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--neo-border)")}
        >
          <GithubIcon size={16} />
          Continue with GitHub
        </button>
      </div>

      {/* Footer link */}
      <p className="text-center text-sm" style={{ color: "var(--neo-fg-muted)" }}>
        Already have an account?{" "}
        <Link
          href="/login"
          className="transition-colors"
          style={{ color: "var(--neo-accent)" }}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
