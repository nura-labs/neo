import { verifySession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getOverview } from "@/lib/db/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { nodeTypeColors } from "@/lib/graph/colors";

export default async function DashboardPage() {
  const user = await verifySession();
  if (!user) redirect("/login");

  const overview = await getOverview(user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Knowledge Nodes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overview.totalNodes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overview.totalEdges}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {overview.sourceBreakdown.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Type</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.typeBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No knowledge indexed yet</p>
            ) : (
              <div className="space-y-2">
                {overview.typeBreakdown.map((t) => (
                  <div key={t.type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor:
                            nodeTypeColors[t.type] ?? "#6b7280",
                        }}
                      />
                      <span className="text-sm">{t.type}</span>
                    </div>
                    <span className="text-sm font-medium">{t.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.recentNodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Install the Neo skill and run &quot;index this project&quot; to get started
              </p>
            ) : (
              <div className="space-y-3">
                {overview.recentNodes.map((n) => (
                  <div key={n.id} className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {n.type} {n.source ? `- ${n.source}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
