"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { nodeTypeColors } from "@/lib/graph/colors";
import Link from "next/link";
import { Search, X } from "lucide-react";

interface KnowledgeNode {
  id: string;
  slug: string;
  type: string;
  title: string;
  tags: string[];
  source: string | null;
  updatedAt: string;
}

export default function KnowledgePage() {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeType, setActiveType] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<KnowledgeNode[] | null>(null);

  useEffect(() => {
    apiFetch<{ nodes: KnowledgeNode[]; total: number }>("/api/knowledge").then((res) => {
      if (res.ok) {
        setNodes(res.data.nodes);
        setTotal(res.data.total);
      }
      setLoading(false);
    });
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const res = await apiFetch<KnowledgeNode[]>(
      `/api/knowledge/search?query=${encodeURIComponent(searchQuery)}${activeType ? `&type=${activeType}` : ""}`
    );
    if (res.ok) setSearchResults(res.data);
  }, [searchQuery, activeType]);

  useEffect(() => {
    const timeout = setTimeout(handleSearch, 300);
    return () => clearTimeout(timeout);
  }, [handleSearch]);

  const displayNodes = searchResults ?? nodes;
  const filteredNodes = activeType
    ? displayNodes.filter((n) => n.type === activeType)
    : displayNodes;

  // Get unique types for filter chips
  const types = [...new Set(nodes.map((n) => n.type))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="neo-text-muted text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="neo-heading text-2xl">Knowledge</h1>
        <span className="neo-text-muted text-sm">{total} nodes</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--neo-fg-muted)" }}
        />
        <input
          type="text"
          placeholder="Search knowledge..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg pl-10 pr-10 py-2.5 text-sm outline-none transition-colors"
          style={{
            background: "var(--neo-surface)",
            border: "1px solid var(--neo-border)",
            color: "var(--neo-fg)",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--neo-border-strong)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--neo-border)")}
        />
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(""); setSearchResults(null); }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--neo-fg-muted)" }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Type filter chips */}
      {types.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {types.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(activeType === type ? null : type)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors"
              style={{
                background: activeType === type ? "var(--neo-accent-muted)" : "var(--neo-surface)",
                border: `1px solid ${activeType === type ? "var(--neo-accent)" : "var(--neo-border)"}`,
                color: activeType === type ? "var(--neo-accent)" : "var(--neo-fg-secondary)",
              }}
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: nodeTypeColors[type] ?? "var(--neo-fg-muted)" }}
              />
              {type}
            </button>
          ))}
        </div>
      )}

      {/* Node list */}
      {filteredNodes.length === 0 ? (
        <div
          className="neo-surface rounded-xl p-8 text-center"
        >
          <p className="neo-text-muted text-sm">
            {searchQuery
              ? `No results for "${searchQuery}"`
              : "No knowledge nodes yet. Install the Neo skill and run \"index this project\" to get started."
            }
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {filteredNodes.map((node) => (
            <Link
              key={node.id}
              href={`/knowledge/${node.id}`}
              className="flex items-center gap-3 rounded-lg px-4 py-3 transition-colors"
              style={{ color: "var(--neo-fg)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--neo-surface)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: nodeTypeColors[node.type] ?? "var(--neo-fg-muted)" }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{node.title}</p>
                <p className="text-xs neo-text-muted truncate">
                  {node.type}{node.source ? ` · ${node.source}` : ""}
                </p>
              </div>
              {node.tags.length > 0 && (
                <div className="flex gap-1 shrink-0">
                  {node.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-2 py-0.5 text-[10px]"
                      style={{
                        background: "var(--neo-surface2)",
                        color: "var(--neo-fg-muted)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
