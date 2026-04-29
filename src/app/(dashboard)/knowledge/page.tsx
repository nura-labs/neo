"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { nodeTypeColors } from "@/lib/graph/colors";
import { Search, X, ChevronRight, ChevronDown, Clock, GitFork, ArrowRight, ArrowLeft, FileText } from "lucide-react";
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
  return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 200);
}

function renderWikilinks(content: string): string {
  return content.replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g, (_m, t) => `[${t.trim()}](/knowledge/by-slug/${generateSlug(t.trim())})`);
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    const res = await apiFetch<KnowledgeNode[]>(`/api/knowledge/search?query=${encodeURIComponent(searchQuery)}`);
    if (res.ok) setSearchResults(res.data);
  }, [searchQuery]);

  useEffect(() => {
    const t = setTimeout(handleSearch, 300);
    return () => clearTimeout(t);
  }, [handleSearch]);

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
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  const displayNodes = searchResults ?? nodes;
  const typeGroups = new Map<string, KnowledgeNode[]>();
  for (const node of displayNodes) {
    if (!typeGroups.has(node.type)) typeGroups.set(node.type, []);
    typeGroups.get(node.type)!.push(node);
  }
  const sortedTypes = [...typeGroups.keys()].sort();

  if (loading) {
    return <div className="flex items-center justify-center h-full"><span className="neo-text-muted text-sm">Loading...</span></div>;
  }

  return (
    <div className="flex h-[calc(100vh-48px)] -m-6">
      {/* Tree sidebar */}
      <aside
        className="w-[280px] shrink-0 overflow-y-auto flex flex-col"
        style={{ background: "var(--neo-bg)", borderRight: "1px solid var(--neo-border)" }}
      >
        <div className="p-3" style={{ borderBottom: "1px solid var(--neo-border)" }}>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--neo-fg-muted)" }} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg pl-9 pr-8 py-2 text-sm outline-none"
              style={{ background: "var(--neo-surface2)", border: "1px solid var(--neo-border)", color: "var(--neo-fg)" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--neo-border-strong)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--neo-border)")}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setSearchResults(null); }} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--neo-fg-muted)" }}><X size={13} /></button>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {sortedTypes.map((type) => {
            const items = typeGroups.get(type)!;
            const collapsed = collapsedTypes.has(type);
            return (
              <div key={type}>
                <button
                  onClick={() => toggleType(type)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-[13px] transition-colors"
                  style={{ color: "var(--neo-fg-muted)" }}
                >
                  {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: nodeTypeColors[type] }} />
                  <span className="uppercase tracking-wider font-medium flex-1 text-left">{type}</span>
                  <span style={{ color: "var(--neo-fg-faint)" }}>{items.length}</span>
                </button>
                {!collapsed && items.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => selectNode(node)}
                    className="flex items-center gap-2.5 w-full text-left px-4 pl-10 py-1.5 text-[14px] truncate transition-colors"
                    style={{
                      color: selectedNode?.id === node.id ? "var(--neo-fg)" : "var(--neo-fg-secondary)",
                      background: selectedNode?.id === node.id ? "var(--neo-surface-hover)" : "transparent",
                    }}
                    onMouseEnter={(e) => { if (selectedNode?.id !== node.id) e.currentTarget.style.background = "var(--neo-surface-hover)"; }}
                    onMouseLeave={(e) => { if (selectedNode?.id !== node.id) e.currentTarget.style.background = "transparent"; }}
                  >
                    <FileText size={14} style={{ color: "var(--neo-fg-faint)", flexShrink: 0 }} />
                    <span className="truncate">{node.title}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="px-4 py-2.5 text-xs" style={{ borderTop: "1px solid var(--neo-border)", color: "var(--neo-fg-faint)" }}>
          {nodes.length} nodes
        </div>
      </aside>

      {/* Main content + metadata */}
      {selectedNode ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-10 py-12">
              {/* Title */}
              <div className="mb-10">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: nodeTypeColors[selectedNode.type] }} />
                  <span className="text-sm font-medium" style={{ color: nodeTypeColors[selectedNode.type] }}>{selectedNode.type}</span>
                </div>
                <h1 className="neo-heading text-3xl leading-tight">{selectedNode.title}</h1>
                {selectedNode.source && (
                  <p className="text-sm mt-3" style={{ color: "var(--neo-fg-muted)" }}>{selectedNode.source}</p>
                )}
              </div>

              {/* Content area */}
              {editMode ? (
                <div className="space-y-4">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full min-h-[60vh] text-sm leading-[1.8] outline-none resize-y rounded-lg p-6"
                    style={{
                      background: "var(--neo-surface)",
                      border: "1px solid var(--neo-border)",
                      color: "var(--neo-fg)",
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: "13px",
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={handleSave} disabled={saving || editContent === selectedNode.content} className="px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-40" style={{ background: "var(--neo-accent)", color: "#fff" }}>
                      {saving ? "Saving..." : "Save changes"}
                    </button>
                    <button onClick={() => { setEditMode(false); setEditContent(selectedNode.content); }} className="px-4 py-2 rounded-lg text-xs" style={{ color: "var(--neo-fg-muted)", border: "1px solid var(--neo-border)" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <article
                    className="prose prose-invert prose-base max-w-none
                      prose-headings:font-semibold prose-headings:tracking-tight
                      prose-h1:text-2xl prose-h1:mt-10 prose-h1:mb-5
                      prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4
                      prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
                      prose-p:text-[15px] prose-p:leading-[1.85] prose-p:mb-5
                      prose-li:text-[15px] prose-li:leading-[1.75]
                      prose-ul:my-4 prose-ol:my-4
                      prose-strong:font-semibold
                      prose-code:text-[13px]
                      prose-pre:my-5"
                    style={{ color: "var(--neo-fg-secondary)" }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children }) => (
                          <Link href={href ?? "#"} style={{ color: "var(--neo-accent)", textDecoration: "none" }}
                            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                          >{children}</Link>
                        ),
                        code: ({ children, className }) => {
                          if (className?.includes("language-")) {
                            return <code className={className} style={{ background: "var(--neo-surface2)", color: "var(--neo-fg)", fontSize: "12px" }}>{children}</code>;
                          }
                          return <code style={{ background: "var(--neo-surface2)", color: "var(--neo-accent)", padding: "0.2em 0.45em", borderRadius: "4px", fontSize: "12px" }}>{children}</code>;
                        },
                        pre: ({ children }) => (
                          <pre style={{ background: "var(--neo-surface)", border: "1px solid var(--neo-border)", borderRadius: "8px", padding: "1.25rem", overflow: "auto", lineHeight: 1.6 }}>{children}</pre>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-4">
                            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>{children}</table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th style={{ borderBottom: "1px solid var(--neo-border)", padding: "0.5rem 1rem", textAlign: "left", fontWeight: 600, color: "var(--neo-fg)", fontSize: "12px" }}>{children}</th>
                        ),
                        td: ({ children }) => (
                          <td style={{ borderBottom: "1px solid var(--neo-border)", padding: "0.5rem 1rem", color: "var(--neo-fg-secondary)", fontSize: "13px" }}>{children}</td>
                        ),
                      }}
                    >
                      {renderWikilinks(selectedNode.content)}
                    </ReactMarkdown>
                  </article>
                  <button
                    onClick={() => setEditMode(true)}
                    className="mt-8 px-4 py-2 rounded-lg text-xs transition-colors"
                    style={{ color: "var(--neo-fg-muted)", border: "1px solid var(--neo-border)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--neo-border-hover)"; e.currentTarget.style.color = "var(--neo-fg)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--neo-border)"; e.currentTarget.style.color = "var(--neo-fg-muted)"; }}
                  >
                    Edit content
                  </button>
                </div>
              )}
            </div>
          </main>

          {/* Right metadata panel */}
          <aside
            className="w-[280px] shrink-0 overflow-y-auto p-6 space-y-7 hidden lg:block"
            style={{ borderLeft: "1px solid var(--neo-border)" }}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: nodeTypeColors[selectedNode.type] }} />
                <span className="text-sm font-medium" style={{ color: "var(--neo-fg)" }}>{selectedNode.type}</span>
              </div>
              {selectedNode.source && (
                <div className="flex items-center gap-2.5">
                  <GitFork size={14} style={{ color: "var(--neo-fg-muted)" }} />
                  <span className="text-sm" style={{ color: "var(--neo-fg-secondary)" }}>{selectedNode.source}</span>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <Clock size={14} style={{ color: "var(--neo-fg-muted)" }} />
                <span className="text-sm" style={{ color: "var(--neo-fg-secondary)" }}>{formatDate(selectedNode.updatedAt)}</span>
              </div>
            </div>

            {selectedNode.tags.length > 0 && (
              <div className="space-y-2">
                <span className="neo-label">Tags</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.tags.map((tag) => (
                    <span key={tag} className="rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ background: "var(--neo-surface2)", border: "1px solid var(--neo-border)", color: "var(--neo-fg-secondary)" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {relatedNodes.length > 0 && (
              <div className="space-y-2">
                <span className="neo-label">Connections</span>
                <div className="space-y-1">
                  {relatedNodes.map((r) => (
                    <button
                      key={`${r.id}-${r.relationship}-${r.direction}`}
                      onClick={() => { const t = nodes.find((n) => n.id === r.id); if (t) selectNode(t); }}
                      className="flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-left transition-colors"
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {r.direction === "outgoing"
                        ? <ArrowRight size={13} style={{ color: "var(--neo-fg-muted)", flexShrink: 0 }} />
                        : <ArrowLeft size={13} style={{ color: "var(--neo-fg-muted)", flexShrink: 0 }} />
                      }
                      <span className="text-sm truncate flex-1" style={{ color: "var(--neo-fg)" }}>{r.title}</span>
                      <span className="text-[11px] shrink-0" style={{ color: "var(--neo-fg-faint)" }}>{r.relationship}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <span className="neo-label">Slug</span>
              <p className="text-[11px] break-all" style={{ color: "var(--neo-fg-faint)" }}>{selectedNode.slug}</p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <FileText size={32} style={{ color: "var(--neo-fg-faint)", margin: "0 auto" }} />
            <p className="text-sm" style={{ color: "var(--neo-fg-muted)" }}>Select a node to view its content</p>
            <p className="text-xs" style={{ color: "var(--neo-fg-faint)" }}>
              {nodes.length} nodes across {sortedTypes.length} types
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
