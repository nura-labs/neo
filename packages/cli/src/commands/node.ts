import { Command } from "commander";
import { readFileSync } from "node:fs";
import { apiRequest } from "../lib/api.js";
import { colors, err, output, success } from "../lib/output.js";

const NODE_TYPES = [
  "pattern", "convention", "architecture", "decision", "concept",
  "workflow", "snippet", "module", "api", "service", "config",
  "person", "project", "team", "tool", "reference", "research", "note",
] as const;

type NodeType = (typeof NODE_TYPES)[number];

interface KnowledgeNode {
  id: string;
  slug: string;
  type: NodeType;
  title: string;
  content: string;
  tags: string[];
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

async function readBodyContent(opts: { content?: string; contentFile?: string }): Promise<string> {
  if (opts.content) return opts.content;
  if (opts.contentFile) return readFileSync(opts.contentFile, "utf-8");
  // stdin if piped
  if (!process.stdin.isTTY) {
    return new Promise((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf-8");
      process.stdin.on("data", (chunk) => (data += chunk));
      process.stdin.on("end", () => resolve(data));
      process.stdin.on("error", reject);
    });
  }
  return "";
}

export function addCommand(): Command {
  return new Command("add")
    .description("Add a knowledge node (content via --content, --content-file, or stdin)")
    .requiredOption("--type <type>", `Node type (${NODE_TYPES.join("|")})`)
    .requiredOption("--title <title>", "Node title")
    .option("--content <text>", "Content (or pipe via stdin)")
    .option("--content-file <path>", "Read content from file")
    .option("--tags <tag,tag>", "Comma-separated tags")
    .option("--source <source>", "Source identifier (e.g. github:org/repo)")
    .action(async (opts: {
      type: string;
      title: string;
      content?: string;
      contentFile?: string;
      tags?: string;
      source?: string;
    }) => {
      if (!NODE_TYPES.includes(opts.type as NodeType)) {
        err(`Invalid --type. Must be one of: ${NODE_TYPES.join(", ")}`);
      }
      const content = await readBodyContent(opts);
      if (!content.trim()) err("Empty content. Pass --content, --content-file, or pipe stdin.");

      const tags = opts.tags
        ? opts.tags.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      const res = await apiRequest<KnowledgeNode>("/api/knowledge", {
        method: "POST",
        body: JSON.stringify({
          type: opts.type,
          title: opts.title,
          content,
          tags,
          source: opts.source,
        }),
      });
      if (!res.ok) {
        const errorMsg = (res.data as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
        err(`Failed to create node: ${errorMsg}`);
      }
      success(`Created ${res.data.title} (${res.data.slug})`);
      output(res.data, (v) => {
        const n = v as KnowledgeNode;
        return `slug:  ${n.slug}\ntype:  ${n.type}\ntitle: ${n.title}`;
      });
    });
}

interface SearchHit {
  id: string;
  slug: string;
  type: NodeType;
  title: string;
  content: string;
  tags: string[];
  source: string | null;
}

export function searchCommand(): Command {
  return new Command("search")
    .description("Hybrid search across your knowledge graph")
    .argument("<query>", "Search query")
    .option("--type <type>", "Filter by node type")
    .option("--source <source>", "Filter by source")
    .option("--tags <tag,tag>", "Filter by tags (comma-separated)")
    .option("--limit <n>", "Max results", "20")
    .action(async (
      query: string,
      opts: { type?: string; source?: string; tags?: string; limit: string }
    ) => {
      const params = new URLSearchParams({ q: query });
      if (opts.type) params.set("type", opts.type);
      if (opts.source) params.set("source", opts.source);
      if (opts.tags) params.set("tags", opts.tags);
      const res = await apiRequest<{ nodes: SearchHit[] }>(
        `/api/knowledge/search?${params.toString()}`
      );
      if (!res.ok) err(`Search failed (${res.status})`);
      const max = parseInt(opts.limit, 10) || 20;
      const hits = res.data.nodes.slice(0, max);
      output(hits, () => {
        if (hits.length === 0) return colors.dim(`No matches for "${query}"`);
        return hits
          .map(
            (n) =>
              `${colors.bold(n.title)} ${colors.dim(`(${n.type}, ${n.slug})`)}\n${
                n.content.slice(0, 240).trim()
              }${n.content.length > 240 ? "…" : ""}`
          )
          .join("\n\n");
      });
    });
}

export function nodeCommand(): Command {
  const cmd = new Command("node").description("Get, update, or delete a knowledge node");

  cmd
    .command("get <slug>")
    .description("Show a node's full content")
    .action(async (slug: string) => {
      const res = await apiRequest<KnowledgeNode>(`/api/knowledge/by-slug/${slug}`);
      if (!res.ok) err(`Node not found: ${slug}`);
      output(res.data, (v) => {
        const n = v as KnowledgeNode;
        return `# ${n.title}\n${colors.dim(`type: ${n.type} | slug: ${n.slug} | source: ${n.source ?? "—"}`)}\n\n${n.content}`;
      });
    });

  cmd
    .command("update <slug>")
    .description("Update a node's title/content/tags")
    .option("--title <title>", "New title")
    .option("--content <text>", "New content (or pipe stdin)")
    .option("--content-file <path>", "Read content from file")
    .option("--tags <tag,tag>", "New tags (replaces existing)")
    .option("--type <type>", "New type")
    .action(async (
      slug: string,
      opts: { title?: string; content?: string; contentFile?: string; tags?: string; type?: string }
    ) => {
      // Resolve by slug → id
      const lookup = await apiRequest<KnowledgeNode>(`/api/knowledge/by-slug/${slug}`);
      if (!lookup.ok) err(`Node not found: ${slug}`);

      const body: Record<string, unknown> = {};
      if (opts.title) body.title = opts.title;
      if (opts.type) body.type = opts.type;
      if (opts.tags !== undefined) {
        body.tags = opts.tags.split(",").map((s) => s.trim()).filter(Boolean);
      }
      const content = await readBodyContent(opts);
      if (content) body.content = content;

      const res = await apiRequest<KnowledgeNode>(`/api/knowledge/${lookup.data.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (!res.ok) err(`Update failed (${res.status})`);
      success(`Updated ${res.data.title} (${res.data.slug})`);
      output(res.data, () => "");
    });

  cmd
    .command("delete <slug>")
    .description("Delete a knowledge node")
    .action(async (slug: string) => {
      const lookup = await apiRequest<KnowledgeNode>(`/api/knowledge/by-slug/${slug}`);
      if (!lookup.ok) err(`Node not found: ${slug}`);
      const res = await apiRequest(`/api/knowledge/${lookup.data.id}`, { method: "DELETE" });
      if (!res.ok) err(`Delete failed (${res.status})`);
      success(`Deleted ${slug}`);
    });

  return cmd;
}

export function overviewCommand(): Command {
  return new Command("overview")
    .description("Show workspace overview (counts + recent)")
    .action(async () => {
      const res = await apiRequest<{
        totalNodes: number;
        totalEdges: number;
        typeBreakdown: { type: string; count: number }[];
        sourceBreakdown: { source: string | null; count: number }[];
        recentNodes: { slug: string; title: string; type: string }[];
      }>("/api/knowledge/overview");
      if (!res.ok) err(`Overview failed (${res.status})`);
      output(res.data, (v) => {
        const d = v as {
          totalNodes: number;
          totalEdges: number;
          typeBreakdown: { type: string; count: number }[];
          recentNodes: { slug: string; title: string; type: string }[];
        };
        const lines = [
          `${colors.bold("Workspace overview")}`,
          `  nodes:  ${d.totalNodes}`,
          `  edges:  ${d.totalEdges}`,
          ``,
          colors.dim("by type:"),
          ...d.typeBreakdown.map((t) => `  ${t.type.padEnd(14)} ${t.count}`),
          ``,
          colors.dim("recent:"),
          ...d.recentNodes.slice(0, 8).map((n) => `  ${n.title} ${colors.dim(`(${n.type})`)}`),
        ];
        return lines.join("\n");
      });
    });
}
