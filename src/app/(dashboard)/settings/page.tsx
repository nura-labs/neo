"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyCommand } from "@/components/settings/copy-command";
import { useAuth } from "@/contexts/auth-context";

export default function SettingsPage() {
  const { user } = useAuth();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://neo.nura.sh";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Setup</CardTitle>
          <CardDescription>Connect your AI tools to Neo in 2 steps</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">1. Install the skill</p>
            <CopyCommand command="npx skills add nura-labs/neo-skill" />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">2. Add the MCP server</p>
            <CopyCommand
              label="Claude Code:"
              command={`claude mcp add --transport http neo ${appUrl}/api/mcp`}
            />
          </div>
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
