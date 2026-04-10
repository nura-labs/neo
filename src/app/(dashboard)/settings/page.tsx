"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiTokenManager } from "@/components/settings/api-token";
import { McpUrl } from "@/components/settings/mcp-url";
import { useAuth } from "@/contexts/auth-context";

export default function SettingsPage() {
  const { user } = useAuth();
  const [apiToken, setApiToken] = useState<string | null>(null);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://neo.nura.sh";

  useEffect(() => {
    apiFetch<{ apiToken: string }>("/api/settings/token").then((res) => {
      if (res.ok) setApiToken(res.data.apiToken);
    });
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>MCP Server URL</CardTitle>
          <CardDescription>Add this to your Claude Code, Cursor, or any MCP-compatible tool</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <McpUrl appUrl={appUrl} />
          <div className="space-y-3">
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Claude Code:</p>
              <code className="text-xs">claude mcp add --transport http neo {appUrl}/api/mcp</code>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Codex (~/.codex/config.toml):</p>
              <code className="text-xs">[mcp_servers.neo]{"\n"}url = &quot;{appUrl}/api/mcp&quot;</code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Token</CardTitle>
          <CardDescription>Used for MCP authentication</CardDescription>
        </CardHeader>
        <CardContent>
          {apiToken ? (
            <ApiTokenManager initialToken={apiToken} />
          ) : (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm">{user?.displayName ?? "—"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
