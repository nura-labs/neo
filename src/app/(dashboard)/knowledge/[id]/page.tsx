"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { nodeTypeColors } from "@/lib/graph/colors";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Clock, Tag, GitFork } from "lucide-react";

interface KnowledgeNode {
  id: string;
  slug: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  source: string | null;
  createdAt: string;
  updatedAt: string;
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
    (_match, target) => {
      const slug = generateSlug(target.trim());
      return `[${target.trim()}](/knowledge/by-slug/${slug})`;
    }
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function KnowledgeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [node, setNode] = useState<KnowledgeNode | null>(null);
  const [related, setRelated] = useState<RelatedNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<KnowledgeNode>(`/api/knowledge/${id}`),
      apiFetch<RelatedNode[]>(`/api/knowledge/${id}/related`),
    ]).then(([nodeRes, relatedRes]) => {
      if (nodeRes.ok) {
        setNode(nodeRes.data);
        setEditContent(nodeRes.data.content);
      }
      if (relatedRes.ok) setRelated(relatedRes.data);
      setLoading(false);
    });
  }, [id]);

  async function handleSave() {
    if (!node || editContent === node.content) return;
    setSaving(true);
    const res = await apiFetch(`/api/knowledge/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent }),
    });
    if (res.ok) {
      setNode({ ...node, content: editContent });
      setEditing(false);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="neo-text-muted text-sm">Loading...</span>
      </div>
    );
  }
  if (!node) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="neo-text-muted text-sm">Node not found</span>
      </div>
    );
  }

  const processedContent = renderWikilinks(editing ? editContent : node.content);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm transition-colors"
        style={{ color: "var(--neo-fg-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neo-fg)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--neo-fg-muted)")}
      >
        <ArrowLeft size={14} />
        Back
      </button>

      {/* Title + type */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: nodeTypeColors[node.type] ?? "var(--neo-fg-muted)" }}
          />
          <h1 className="neo-heading text-2xl">{node.title}</h1>
        </div>

        {/* Metadata bar */}
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
            style={{ background: "var(--neo-accent-muted)", color: "var(--neo-accent)" }}
          >
            {node.type}
          </span>
          {node.source && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--neo-fg-muted)" }}>
              <GitFork size={10} />
              {node.source}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--neo-fg-muted)" }}>
            <Clock size={10} />
            {formatDate(node.updatedAt)}
          </span>
          {node.tags.length > 0 && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--neo-fg-muted)" }}>
              <Tag size={10} />
              {node.tags.join(", ")}
            </span>
          )}
          <span className="text-[10px]" style={{ color: "var(--neo-fg-faint)" }}>
            {node.slug}
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        className="neo-surface rounded-xl overflow-hidden"
      >
        {/* Edit toggle */}
        <div
          className="flex items-center justify-between px-5 py-2"
          style={{ borderBottom: "1px solid var(--neo-border)" }}
        >
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{
                background: !editing ? "var(--neo-accent-muted)" : "transparent",
                color: !editing ? "var(--neo-accent)" : "var(--neo-fg-muted)",
              }}
            >
              Preview
            </button>
            <button
              onClick={() => setEditing(true)}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{
                background: editing ? "var(--neo-accent-muted)" : "transparent",
                color: editing ? "var(--neo-accent)" : "var(--neo-fg-muted)",
              }}
            >
              Edit
            </button>
          </div>
          {editing && editContent !== node.content && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs px-3 py-1 rounded font-medium transition-colors disabled:opacity-50"
              style={{ background: "var(--neo-accent)", color: "#fff" }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          )}
        </div>

        {/* Content area */}
        <div className="px-5 py-5">
          {editing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[400px] text-sm leading-relaxed outline-none resize-y"
              style={{
                background: "transparent",
                color: "var(--neo-fg)",
                fontFamily: "var(--font-mono), monospace",
              }}
            />
          ) : (
            <div
              className="prose prose-invert prose-sm max-w-none"
              style={{ color: "var(--neo-fg-secondary)" }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <Link
                      href={href ?? "#"}
                      className="no-underline transition-colors"
                      style={{ color: "var(--neo-accent)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                    >
                      {children}
                    </Link>
                  ),
                  code: ({ children, className }) => {
                    const isBlock = className?.includes("language-");
                    if (isBlock) {
                      return (
                        <code
                          className={className}
                          style={{
                            background: "var(--neo-surface2)",
                            color: "var(--neo-fg)",
                          }}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code
                        style={{
                          background: "var(--neo-surface2)",
                          color: "var(--neo-accent)",
                          padding: "0.15em 0.4em",
                          borderRadius: "4px",
                          fontSize: "0.85em",
                        }}
                      >
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => (
                    <pre
                      style={{
                        background: "var(--neo-surface2)",
                        border: "1px solid var(--neo-border)",
                        borderRadius: "var(--neo-radius-lg)",
                        padding: "1rem",
                        overflow: "auto",
                      }}
                    >
                      {children}
                    </pre>
                  ),
                }}
              >
                {processedContent}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      {/* Related nodes */}
      {related.length > 0 && (
        <div className="space-y-3">
          <span className="neo-label">Related</span>
          <div className="space-y-0.5">
            {related.map((r) => (
              <Link
                key={`${r.id}-${r.relationship}-${r.direction}`}
                href={`/knowledge/${r.id}`}
                className="flex items-center gap-3 rounded-lg px-4 py-2.5 transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--neo-surface)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span className="neo-text-muted text-sm shrink-0">
                  {r.direction === "outgoing" ? "\u2192" : "\u2190"}
                </span>
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: nodeTypeColors[r.type] ?? "var(--neo-fg-muted)" }}
                />
                <span className="text-sm flex-1 truncate" style={{ color: "var(--neo-fg)" }}>
                  {r.title}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] shrink-0"
                  style={{ background: "var(--neo-surface2)", color: "var(--neo-fg-muted)" }}
                >
                  {r.relationship}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
