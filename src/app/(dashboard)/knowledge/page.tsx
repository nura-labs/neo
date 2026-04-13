"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { nodeTypeColors } from "@/lib/graph/colors";
import { Search, X, ChevronRight, ChevronDown, Clock, GitFork, Tag, ArrowRight, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";

interface KnowledgeNode {
  id: string;
  slug: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  source: string | null;
  updatedAt: string;
  createdAt: string;
}

interface RelatedNode {
  id: string;
  title: string;
  slug: string;
  type: string;
  relationship: string;
  direction: "outgoing" | "incoming";
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

function renderWikilinks(content: string): string {
  return content.replace(
    /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g,
    (_match, target) => `[${target.trim()}](/knowledge/by-slug/${generateSlug(target.trim())})`
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function KnowledgePage() {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeNode[] | null>(null);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [relatedNodes, setRelatedNodes] = useState<RelatedNode[]>([]);
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ nodes: KnowledgeNode[]; total: number }>("/api/knowledge?limit=500").then((res) => {
      if (res.ok) setNodes(res.data.nodes);
      setLoading(false);
    });
  }, []);

  // Search with debounce
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    const res = await apiFetch<KnowledgeNode[]>(
      `/api/knowledge/search?query=${encodeURIComponent(searchQuery)}`
    );
    if (res.ok) setSearchResults(res.data);
  }, [searchQuery]);

  useEffect(() => {
    const t = setTimeout(handleSearch, 300);
    return () => clearTimeout(t);
  }, [handleSearch]);

  // Load node detail + related
  async function selectNode(node: KnowledgeNode) {
    setSelectedNode(node);
    setEditMode(false);
    setEditContent(node.content);
    const res = await apiFetch<RelatedNode[]>(`/api/knowledge/${node.id}/related`);
    if (res.ok) setRelatedNodes(res.data);
    else setRelatedNodes([]);
  }

  async function handleSave() {
    if (!selectedNode || editContent === selectedNode.content) return;
    setSaving(true);
    const res = await apiFetch<KnowledgeNode>(`/api/knowledge/${selectedNode.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent }),
    });
    if (res.ok) {
      const updated = { ...selectedNode, content: editContent };
      setSelectedNode(updated);
      setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      setEditMode(false);
    }
    setSaving(false);
  }

  function toggleType(type: string) {
    setCollapsedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  // Group nodes by type
  const displayNodes = searchResults ?? nodes;
  const typeGroups = new Map<string, KnowledgeNode[]>();
  for (const node of displayNodes) {
    if (!typeGroups.has(node.type)) typeGroups.set(node.type, []);
    typeGroups.get(node.type)!.push(node);
  }
  const sortedTypes = [...typeGroups.keys()].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="neo-text-muted text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full -m-6">
      {/* Tree sidebar */}
      <div
        className="w-[240px] shrink-0 h-full overflow-y-auto"
        style={{ background: "var(--neo-surface)", borderRight: "1px solid var(--neo-border)" }}
      >
        {/* Search */}
        <div className="p-2" style={{ borderBottom: "1px solid var(--neo-border)" }}>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--neo-fg-muted)" }} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md pl-8 pr-7 py-1.5 text-xs outline-none"
              style={{ background: "var(--neo-surface2)", border: "1px solid var(--neo-border)", color: "var(--neo-fg)" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--neo-border-strong)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--neo-border)")}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setSearchResults(null); }} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--neo-fg-muted)" }}>
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Tree */}
        <div className="py-1">
          {sortedTypes.map((type) => {
            const nodesOfType = typeGroups.get(type)!;
            const isCollapsed = collapsedTypes.has(type);
            return (
              <div key={type}>
                <button
                  onClick={() => toggleType(type)}
                  className="flex items-center gap-1.5 w-full px-3 py-1 text-[11px] transition-colors"
                  style={{ color: "var(--neo-fg-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neo-fg-secondary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--neo-fg-muted)")}
                >
                  {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: nodeTypeColors[type] ?? "var(--neo-fg-muted)" }} />
                  <span className="uppercase tracking-wider font-medium">{type}</span>
                  <span className="ml-auto opacity-50">{nodesOfType.length}</span>
                </button>
                {!isCollapsed && nodesOfType.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => selectNode(node)}
                    className="w-full text-left px-3 pl-8 py-1 text-[12px] truncate transition-colors"
                    style={{
                      color: selectedNode?.id === node.id ? "var(--neo-fg)" : "var(--neo-fg-secondary)",
                      background: selectedNode?.id === node.id ? "rgba(255,255,255,0.06)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedNode?.id !== node.id) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    }}
                    onMouseLeave={(e) => {
                      if (selectedNode?.id !== node.id) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {node.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {selectedNode ? (
          <div className="flex h-full">
            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
              <h1 className="neo-heading text-xl mb-6">{selectedNode.title}</h1>

              {editMode ? (
                <div className="space-y-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full min-h-[500px] text-sm leading-relaxed outline-none resize-y rounded-lg p-4"
                    style={{
                      background: "var(--neo-surface)",
                      border: "1px solid var(--neo-border)",
                      color: "var(--neo-fg)",
                      fontFamily: "var(--font-mono), monospace",
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving || editContent === selectedNode.content}
                      className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-40"
                      style={{ background: "var(--neo-accent)", color: "#fff" }}
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => { setEditMode(false); setEditContent(selectedNode.content); }}
                      className="px-3 py-1.5 rounded-md text-xs transition-colors"
                      style={{ color: "var(--neo-fg-muted)", border: "1px solid var(--neo-border)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="prose prose-invert prose-sm max-w-none cursor-text"
                  style={{ color: "var(--neo-fg-secondary)" }}
                  onClick={() => setEditMode(true)}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, children }) => (
                        <Link href={href ?? "#"} className="no-underline" style={{ color: "var(--neo-accent)" }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >{children}</Link>
                      ),
                      code: ({ children, className }) => {
                        if (className?.includes("language-")) {
                          return <code className={className} style={{ background: "var(--neo-surface2)", color: "var(--neo-fg)" }}>{children}</code>;
                        }
                        return <code style={{ background: "var(--neo-surface2)", color: "var(--neo-accent)", padding: "0.15em 0.4em", borderRadius: "4px", fontSize: "0.85em" }}>{children}</code>;
                      },
                      pre: ({ children }) => (
                        <pre style={{ background: "var(--neo-surface2)", border: "1px solid var(--neo-border)", borderRadius: "var(--neo-radius-lg)", padding: "1rem", overflow: "auto" }}>{children}</pre>
                      ),
                    }}
                  >
                    {renderWikilinks(selectedNode.content)}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Right metadata panel (Linear style) */}
            <div
              className="w-[240px] shrink-0 overflow-y-auto p-4 space-y-5"
              style={{ borderLeft: "1px solid var(--neo-border)" }}
            >
              {/* Properties */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: nodeTypeColors[selectedNode.type] }} />
                  <span className="text-xs font-medium" style={{ color: "var(--neo-fg)" }}>{selectedNode.type}</span>
                </div>
                {selectedNode.source && (
                  <div className="flex items-center gap-2">
                    <GitFork size={12} style={{ color: "var(--neo-fg-muted)" }} />
                    <span className="text-xs" style={{ color: "var(--neo-fg-secondary)" }}>{selectedNode.source}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock size={12} style={{ color: "var(--neo-fg-muted)" }} />
                  <span className="text-xs" style={{ color: "var(--neo-fg-secondary)" }}>{formatDate(selectedNode.updatedAt)}</span>
                </div>
              </div>

              {/* Tags */}
              {selectedNode.tags.length > 0 && (
                <div className="space-y-2">
                  <span className="neo-label">Tags</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.tags.map((tag) => (
                      <span key={tag} className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--neo-surface2)", color: "var(--neo-fg-muted)" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Backlinks */}
              {relatedNodes.length > 0 && (
                <div className="space-y-2">
                  <span className="neo-label">Connections</span>
                  <div className="space-y-0.5">
                    {relatedNodes.map((r) => (
                      <button
                        key={`${r.id}-${r.relationship}-${r.direction}`}
                        onClick={() => {
                          const target = nodes.find((n) => n.id === r.id);
                          if (target) selectNode(target);
                        }}
                        className="flex items-center gap-1.5 w-full rounded px-2 py-1 text-left transition-colors"
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {r.direction === "outgoing"
                          ? <ArrowRight size={10} style={{ color: "var(--neo-fg-muted)" }} />
                          : <ArrowLeft size={10} style={{ color: "var(--neo-fg-muted)" }} />
                        }
                        <span className="text-[11px] truncate" style={{ color: "var(--neo-fg-secondary)" }}>{r.title}</span>
                        <span className="text-[9px] ml-auto shrink-0" style={{ color: "var(--neo-fg-faint)" }}>{r.relationship}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Slug */}
              <div className="space-y-1">
                <span className="neo-label">Slug</span>
                <p className="text-[10px] break-all" style={{ color: "var(--neo-fg-faint)" }}>{selectedNode.slug}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <p className="neo-text-muted text-sm">Select a node from the sidebar</p>
              <p className="text-xs" style={{ color: "var(--neo-fg-faint)" }}>
                {nodes.length} nodes across {sortedTypes.length} types
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
