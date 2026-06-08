"use client";

import Link from "next/link";
import { DOCS_URL, OPENAPI_URL, LLMS_URL } from "@/lib/constants/urls";
import { usePlatform } from "@/contexts/platform-context";
import { useAuth } from "@/contexts/auth-context";
import { GeneralTab } from "@/components/settings/general-tab";
import { ArrowRight, ExternalLink } from "lucide-react";

export default function PlatformSettingsPage() {
  const { platformOrg } = usePlatform();
  const { currentWorkspace } = useAuth();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="neo-heading text-2xl">Settings</h1>
        <p className="text-sm neo-text-muted mt-2">
          {platformOrg
            ? `${platformOrg.name} · ${platformOrg.slug}`
            : "Platform organization"}
          {currentWorkspace ? ` · workspace ${currentWorkspace.slug}` : ""}
        </p>
      </div>

      {platformOrg && (
        <section className="neo-surface rounded-xl p-6 space-y-4">
          <div>
            <h2 className="neo-heading text-base">Organization</h2>
            <p className="text-sm neo-text-muted mt-1">
              Your Platform API org — tenants and keys belong here.
            </p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <dt className="neo-label">Name</dt>
              <dd className="mt-1" style={{ color: "var(--neo-fg)" }}>
                {platformOrg.name}
              </dd>
            </div>
            <div>
              <dt className="neo-label">Slug</dt>
              <dd className="mt-1 font-mono" style={{ color: "var(--neo-fg)" }}>
                {platformOrg.slug}
              </dd>
            </div>
            <div>
              <dt className="neo-label">Plan</dt>
              <dd className="mt-1 capitalize" style={{ color: "var(--neo-fg)" }}>
                {platformOrg.plan}
              </dd>
            </div>
            <div>
              <dt className="neo-label">Enabled</dt>
              <dd className="mt-1" style={{ color: "var(--neo-fg)" }}>
                {new Date(platformOrg.enabled_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <section className="neo-surface rounded-xl p-6 space-y-4">
        <div>
          <h2 className="neo-heading text-base">Workspace</h2>
          <p className="text-sm neo-text-muted mt-1">
            Shared with Personal mode. The slug is sent as{" "}
            <code className="font-mono text-xs">X-Neo-Workspace</code> in Platform API calls.
          </p>
        </div>
        <GeneralTab />
      </section>

      <section className="neo-surface rounded-xl p-6 space-y-4">
        <div>
          <h2 className="neo-heading text-base">API & documentation</h2>
          <p className="text-sm neo-text-muted mt-1">
            Integration reference for your product backend.
          </p>
        </div>
        <ul className="space-y-2">
          {[
            { href: DOCS_URL, label: "API documentation" },
            { href: OPENAPI_URL, label: "OpenAPI spec" },
            { href: LLMS_URL, label: "llms.txt (agent cheat sheet)" },
          ].map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm hover:opacity-80"
                style={{ color: "var(--neo-accent)" }}
              >
                {link.label}
                <ExternalLink size={13} />
              </a>
            </li>
          ))}
          <li>
            <Link
              href="/platform/keys"
              className="inline-flex items-center gap-2 text-sm hover:opacity-80"
              style={{ color: "var(--neo-fg)" }}
            >
              Manage API keys
              <ArrowRight size={14} />
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
