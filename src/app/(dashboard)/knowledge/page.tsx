"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { nodeTypeColors } from "@/lib/graph/colors";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { KnowledgeGraph } from "@/components/graph/force-graph";

interface KnowledgeNode {
  id: string;
  type: string;
  title: string;
  tags: string[];
  source: string | null;
}

export default function KnowledgePage() {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ nodes: KnowledgeNode[]; total: number }>("/api/knowledge").then((res) => {
      if (res.ok) {
        setNodes(res.data.nodes);
        setTotal(res.data.total);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Knowledge</h1>
        <span className="text-sm text-muted-foreground">{total} nodes</span>
      </div>

      {nodes.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-8 text-center">
          <p className="text-muted-foreground">
            No knowledge nodes yet. Install the Neo skill and run &quot;index this project&quot; to get started.
          </p>
        </div>
      ) : (
        <>
          <div className="h-[500px] rounded-xl border border-white/5 bg-[#0a0a0a] overflow-hidden">
            <KnowledgeGraph />
          </div>
          <div className="space-y-2">
            {nodes.map((node) => (
              <Link key={node.id} href={`/knowledge/${node.id}`} className="block rounded-lg border p-4 transition-colors hover:bg-muted/50">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: nodeTypeColors[node.type] ?? "#6b7280" }} />
                      <h3 className="font-medium">{node.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{node.type}{node.source ? ` - ${node.source}` : ""}</p>
                  </div>
                  <div className="flex gap-1">
                    {node.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
