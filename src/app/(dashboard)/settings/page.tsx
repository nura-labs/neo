import { verifySession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiTokenManager } from "@/components/settings/api-token";
import { McpUrl } from "@/components/settings/mcp-url";

export default async function SettingsPage() {
  const user = await verifySession();
  if (!user) redirect("/login");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>MCP Server URL</CardTitle>
          <CardDescription>
            Add this to your Claude Code, Cursor, or any MCP-compatible tool
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <McpUrl appUrl={appUrl} />
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Claude Code setup:</p>
            <code className="text-xs">
              claude mcp add neo {appUrl}/api/mcp --header &quot;Authorization: Bearer YOUR_TOKEN&quot;
            </code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Token</CardTitle>
          <CardDescription>
            Use this token to authenticate MCP requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApiTokenManager initialToken={user.apiToken} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm">{user.name}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
