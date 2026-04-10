"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { nodeTypeColors } from "@/lib/graph/colors";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface KnowledgeNode {
  id: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  source: string | null;
}

interface RelatedNode {
  node: { id: string; title: string; type: string };
  edge: { id: string; relationship: string };
  direction: "outgoing" | "incoming";
}

export default function KnowledgeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [node, setNode] = useState<KnowledgeNode | null>(null);
  const [related, setRelated] = useState<RelatedNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<KnowledgeNode>(`/api/knowledge/${id}`),
      apiFetch<RelatedNode[]>(`/api/knowledge/${id}/related`),
    ]).then(([nodeRes, relatedRes]) => {
      if (nodeRes.ok) setNode(nodeRes.data);
      if (relatedRes.ok) setRelated(relatedRes.data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!node) return <p className="text-destructive">Node not found</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/knowledge" className="text-sm text-muted-foreground hover:underline">
        &larr; Back to knowledge
      </Link>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div
            className="mt-1.5 h-3 w-3 rounded-full"
            style={{ backgroundColor: nodeTypeColors[node.type] ?? "#6b7280" }}
          />
          <div>
            <h1 className="text-2xl font-bold">{node.title}</h1>
            <p className="text-sm text-muted-foreground">
              {node.type}{node.source ? ` - ${node.source}` : ""}
            </p>
          </div>
        </div>

        {node.tags.length > 0 && (
          <div className="flex gap-1">
            {node.tags.map((tag) => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>
        )}

        <div className="rounded-lg border bg-muted/20 p-6">
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
                key={r.edge.id}
                href={`/knowledge/${r.node.id}`}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {r.direction === "outgoing" ? "\u2192" : "\u2190"}
                  </span>
                  <span className="font-medium">{r.node.title}</span>
                </div>
                <Badge variant="outline" className="text-xs">{r.edge.relationship}</Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
