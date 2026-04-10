import { verifySession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getNodesByUser } from "@/lib/db/queries";
import { nodeTypeColors } from "@/lib/graph/colors";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; source?: string; page?: string }>;
}) {
  const user = await verifySession();
  if (!user) redirect("/login");

  const params = await searchParams;
  const page = parseInt(params.page ?? "1");
  const { nodes, total } = await getNodesByUser(user.id, {
    type: params.type,
    source: params.source,
    page,
    limit: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Knowledge</h1>
        <span className="text-sm text-muted-foreground">{total} nodes</span>
      </div>

      {nodes.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-8 text-center">
          <p className="text-muted-foreground">
            No knowledge nodes yet. Install the Neo skill and run &quot;index this
            project&quot; to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {nodes.map((node) => (
            <Link
              key={node.id}
              href={`/knowledge/${node.id}`}
              className="block rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: nodeTypeColors[node.type] ?? "#6b7280",
                      }}
                    />
                    <h3 className="font-medium">{node.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {node.type}
                    {node.source ? ` - ${node.source}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  {node.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {total > 50 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/knowledge?page=${page - 1}`}
              className="text-sm underline"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(total / 50)}
          </span>
          {page < Math.ceil(total / 50) && (
            <Link
              href={`/knowledge?page=${page + 1}`}
              className="text-sm underline"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
