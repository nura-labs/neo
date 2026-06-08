import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Neo Platform API — Documentation",
  description: "Neo Platform API reference for building with behavioral memory.",
};

const sections = [
  { id: "authentication", label: "Authentication" },
  { id: "headers", label: "Headers" },
  { id: "quickstart", label: "Quickstart" },
  { id: "context-api", label: "Context API" },
  { id: "tenants", label: "Tenants" },
  { id: "usage", label: "Usage" },
  { id: "errors", label: "Errors" },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--neo-bg)" }}>
      <header
        className="sticky top-0 z-10 border-b px-6 py-4"
        style={{ background: "var(--neo-bg)", borderColor: "var(--neo-border)" }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="neo-heading text-base">
              Neo
            </Link>
            <span className="neo-text-muted text-sm">Platform API</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/platform" className="neo-text-muted hover:opacity-80">
              Dashboard
            </Link>
            <a
              href="/v1/openapi.json"
              className="neo-text-muted hover:opacity-80"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenAPI
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto flex gap-8 px-6 py-8">
        <nav className="hidden lg:block w-48 shrink-0">
          <p className="neo-label mb-3">On this page</p>
          <ul className="space-y-1">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block text-sm py-1 transition-colors"
                  style={{ color: "var(--neo-fg-muted)" }}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
