import { verifySession } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import { getNodeById, getRelatedNodes } from "@/lib/db/queries";
import { nodeTypeColors } from "@/lib/graph/colors";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function KnowledgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await verifySession();
  if (!user) redirect("/login");

  const { id } = await params;
  const node = await getNodeById(id, user.id);

  if (!node) notFound();

  const related = await getRelatedNodes(id, user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/knowledge"
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to knowledge
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div
            className="mt-1.5 h-3 w-3 rounded-full"
            style={{
              backgroundColor: nodeTypeColors[node.type] ?? "#6b7280",
            }}
          />
          <div>
            <h1 className="text-2xl font-bold">{node.title}</h1>
            <p className="text-sm text-muted-foreground">
              {node.type}
              {node.source ? ` - ${node.source}` : ""}
            </p>
          </div>
        </div>

        {node.tags.length > 0 && (
          <div className="flex gap-1">
            {node.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-muted/20 p-6">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {node.content}
          </pre>
        </div>
      </div>

      {related.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Related</h2>
          <div className="space-y-2">
            {related.map((r) => (
              <Link
                key={`${r.edge.id}`}
                href={`/knowledge/${r.node.id}`}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {r.direction === "outgoing" ? "\u2192" : "\u2190"}
                  </span>
                  <span className="font-medium">{r.node.title}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {r.edge.relationship}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
