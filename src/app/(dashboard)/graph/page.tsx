"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KnowledgeGraph } from "@/components/graph/force-graph";
import { apiFetch } from "@/lib/api";
import { nodeTypeColors } from "@/lib/graph/colors";
import { X, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface NodeDetail {
  id: string;
  slug: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  source: string | null;
}

interface RelatedNode {
  id: string;
  title: string;
  type: string;
  relationship: string;
  direction: "outgoing" | "incoming";
}

export default function GraphPage() {
  const router = useRouter();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeDetail, setNodeDetail] = useState<NodeDetail | null>(null);
  const [relatedNodes, setRelatedNodes] = useState<RelatedNode[]>([]);
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());

  // Fetch node detail when selected
  useEffect(() => {
    if (!selectedNodeId) {
      queueMicrotask(() => {
        setNodeDetail(null);
        setRelatedNodes([]);
      });
      return;
    }

    Promise.all([
      apiFetch<NodeDetail>(`/api/knowledge/${selectedNodeId}`),
      apiFetch<RelatedNode[]>(`/api/knowledge/${selectedNodeId}/related`),
    ]).then(([nodeRes, relatedRes]) => {
      if (nodeRes.ok && nodeRes.data) {
        setNodeDetail(nodeRes.data);
      } else {
        console.error(`Failed to load node ${selectedNodeId}:`, nodeRes.status, nodeRes.data);
        setNodeDetail(null);
      }
      if (relatedRes.ok && Array.isArray(relatedRes.data)) {
        setRelatedNodes(relatedRes.data);
      }
    }).catch((err) => {
      console.error("Sidebar fetch failed:", err);
    });
  }, [selectedNodeId]);

  const allTypes = Object.keys(nodeTypeColors);

  function toggleType(type: string) {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  return (
    <div className="flex h-full -m-6">
      {/* Graph area */}
      <div
        className="flex-1 relative"
        style={{ background: "var(--neo-bg)" }}
      >
        <KnowledgeGraph
          onNodeSelect={setSelectedNodeId}
          selectedNodeId={selectedNodeId}
          typeFilter={typeFilter.size > 0 ? typeFilter : null}
        />

        {/* Filter pills - top right */}
        <div className="absolute top-4 right-4 flex flex-wrap gap-1.5 max-w-[200px]">
          {allTypes.map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-colors"
              style={{
                background: typeFilter.has(type) ? "var(--neo-accent-muted)" : "var(--neo-surface)",
                border: `1px solid ${typeFilter.has(type) ? "var(--neo-accent)" : "var(--neo-border)"}`,
                color: typeFilter.has(type) ? "var(--neo-accent)" : "var(--neo-fg-muted)",
              }}
            >
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: nodeTypeColors[type] }}
              />
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Preview panel — plain aside, no framer-motion (animation was hiding bugs) */}
      {selectedNodeId && (
        <aside
          className="h-full shrink-0"
          style={{
            width: 400,
            background: "var(--neo-surface)",
            borderLeft: "1px solid var(--neo-border)",
          }}
        >
            <div className="h-full overflow-y-auto">
              {/* Panel header */}
              <div
                className="sticky top-0 flex items-center justify-between px-4 py-3 z-10"
                style={{
                  background: "var(--neo-surface)",
                  borderBottom: "1px solid var(--neo-border)",
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: nodeDetail ? nodeTypeColors[nodeDetail.type] : "var(--neo-fg-muted)" }}
                  />
                  <span className="text-xs font-medium truncate" style={{ color: "var(--neo-fg)" }}>
                    {nodeDetail ? nodeDetail.title : "Loading…"}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => nodeDetail && router.push(`/knowledge/${nodeDetail.id}`)}
                    disabled={!nodeDetail}
                    className="p-1.5 rounded transition-colors disabled:opacity-30"
                    style={{ color: "var(--neo-fg-muted)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neo-accent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--neo-fg-muted)")}
                    title="Open full"
                  >
                    <ExternalLink size={14} />
                  </button>
                  <button
                    onClick={() => setSelectedNodeId(null)}
                    className="p-1.5 rounded transition-colors"
                    style={{ color: "var(--neo-fg-muted)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neo-fg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--neo-fg-muted)")}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {!nodeDetail ? (
                <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--neo-fg-muted)" }}>
                  Loading…
                </div>
              ) : (
                <>
                  {/* Metadata */}
                  <div className="px-4 py-3 flex flex-wrap gap-1.5" style={{ borderBottom: "1px solid var(--neo-border)" }}>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ background: "var(--neo-accent-muted)", color: "var(--neo-accent)" }}
                    >
                      {nodeDetail.type}
                    </span>
                    {nodeDetail.source && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{ background: "var(--neo-surface2)", color: "var(--neo-fg-muted)" }}
                      >
                        {nodeDetail.source}
                      </span>
                    )}
                    {nodeDetail.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{ background: "var(--neo-surface2)", color: "var(--neo-fg-muted)" }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Content */}
                  <div className="px-4 py-4 prose prose-invert prose-sm max-w-none"
                    style={{ color: "var(--neo-fg-secondary)" }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {nodeDetail.content.slice(0, 2000)}
                    </ReactMarkdown>
                    {nodeDetail.content.length > 2000 && (
                      <button
                        onClick={() => router.push(`/knowledge/${nodeDetail.id}`)}
                        className="text-xs mt-2 transition-colors"
                        style={{ color: "var(--neo-accent)" }}
                      >
                        Read full content...
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Related nodes */}
              {relatedNodes.length > 0 && (
                <div
                  className="px-4 py-3 space-y-2"
                  style={{ borderTop: "1px solid var(--neo-border)" }}
                >
                  <span className="neo-label">Related</span>
                  <div className="space-y-0.5">
                    {relatedNodes.map((r) => (
                      <button
                        key={`${r.id}-${r.relationship}-${r.direction}`}
                        onClick={() => setSelectedNodeId(r.id)}
                        className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-left transition-colors"
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--neo-surface-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <span className="neo-text-muted text-xs shrink-0">
                          {r.direction === "outgoing" ? "\u2192" : "\u2190"}
                        </span>
                        <span className="text-xs truncate" style={{ color: "var(--neo-fg)" }}>
                          {r.title}
                        </span>
                        <span className="neo-text-muted text-[10px] shrink-0 ml-auto">
                          {r.relationship}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
        </aside>
      )}
    </div>
  );
}
