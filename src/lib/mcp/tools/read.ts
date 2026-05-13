import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getOverview,
  searchNodes,
  hybridSearch,
  getNodeBySlug,
  getRelatedNodes,
  getWorkspaceById,
  logActivity,
} from "@/lib/db/queries";
import { generateEmbedding } from "@/lib/knowledge/embeddings";
import { edgeRelationships, knowledgeNodeTypes } from "@/lib/validators/knowledge";
import { requireMcpAccess } from "@/lib/mcp/permissions";

export function registerReadTools(server: McpServer) {
  server.tool(
    "whoami",
    "Identify which Neo workspace this MCP session is scoped to. Use this whenever you need to confirm context before reading or writing.",
    {},
    async (_args, { authInfo }) => {
      const access = requireMcpAccess(authInfo, "read");
      if (!access.ok) return access.response;
      const { workspaceId, workspaceSlug } = access;
      const ws = await getWorkspaceById(workspaceId);
      const text = ws
        ? `Connected to **${ws.name}** (slug: ${ws.slug}, plan: ${ws.plan}).\n\nAll tools in this MCP session are scoped to this workspace only.`
        : `Connected to workspace slug ${workspaceSlug} (workspace record not found).`;
      return { content: [{ type: "text" as const, text }] };
    }
  );

  server.tool(
    "get_overview",
    "Get an overview of your knowledge graph: workspace identity, total nodes, edges, breakdown by type and source, and recent entries",
    { source: z.string().optional().describe("Filter by source (e.g. github:org/repo)") },
    async ({ source }, { authInfo }) => {
      const access = requireMcpAccess(authInfo, "read");
      if (!access.ok) return access.response;
      const { workspaceId, workspaceSlug } = access;
      const [overview, ws] = await Promise.all([
        getOverview(workspaceId, { source }),
        getWorkspaceById(workspaceId),
      ]);

      const wsLabel = ws ? `${ws.name} (slug: ${ws.slug})` : workspaceSlug;
      const lines = [
        `## Knowledge Graph Overview — ${wsLabel}`,
        `- **Workspace:** ${wsLabel}`,
        `- **Total nodes:** ${overview.totalNodes}`,
        `- **Total edges:** ${overview.totalEdges}`,
        ``,
        `### By Type`,
        ...overview.typeBreakdown.map((t) => `- ${t.type}: ${t.count}`),
        ``,
        `### By Source`,
        ...overview.sourceBreakdown.map(
          (s) => `- ${s.source ?? "no source"}: ${s.count}`
        ),
        ``,
        `### Recent`,
        ...overview.recentNodes.map(
          (n) =>
            `- **${n.title}** (${n.type}) — ${n.source ?? "no source"} [slug: ${n.slug}]`
        ),
      ];

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );

  server.tool(
    "search",
    "Search your knowledge graph using full-text search. Returns matching knowledge nodes ranked by relevance.",
    {
      query: z.string().describe("Search query"),
      type: z.enum(knowledgeNodeTypes).optional().describe(`Filter by node type (${knowledgeNodeTypes.join(", ")})`),
      source: z.string().optional().describe("Filter by source (e.g. github:org/repo)"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
    },
    async ({ query, type, source, tags }, { authInfo }) => {
      const access = requireMcpAccess(authInfo, "read");
      if (!access.ok) return access.response;
      const { workspaceId } = access;

      // Try hybrid search (text + semantic), fallback to text-only
      let queryEmbedding: number[] | null = null;
      try {
        queryEmbedding = await generateEmbedding(query);
      } catch {
        // Fall back to text-only search if embeddings unavailable
      }

      const nodes = queryEmbedding
        ? await hybridSearch(workspaceId, query, queryEmbedding, { type, source, tags })
        : await searchNodes(workspaceId, query, { type, source, tags });

      logActivity({
        workspaceId,
        actorUserId: access.createdByUserId,
        type: "search",
        via: "mcp",
        summary: `Searched "${query.slice(0, 80)}"`,
        payload: { query, resultCount: nodes.length, type, source, tags },
      });

      if (nodes.length === 0) {
        return {
          content: [
            { type: "text" as const, text: `No results found for "${query}"` },
          ],
        };
      }

      const text = nodes
        .map(
          (n) =>
            `### ${n.title}\n**Slug:** ${n.slug} | **Type:** ${n.type} | **Source:** ${n.source ?? "none"} | **Tags:** ${n.tags.join(", ") || "none"}\n\n${n.content.slice(0, 500)}${n.content.length > 500 ? "..." : ""}\n\n---`
        )
        .join("\n\n");

      return {
        content: [{ type: "text" as const, text }],
      };
    }
  );

  server.tool(
    "get_node",
    "Get the full content of a specific knowledge node by its slug",
    { slug: z.string().describe("Knowledge node slug") },
    async ({ slug }, { authInfo }) => {
      const access = requireMcpAccess(authInfo, "read");
      if (!access.ok) return access.response;
      const { workspaceId } = access;
      const node = await getNodeBySlug(slug, workspaceId);

      if (!node) {
        return {
          content: [{ type: "text" as const, text: "Node not found" }],
          isError: true,
        };
      }

      const related = await getRelatedNodes(node.id, workspaceId);
      const relatedText =
        related.length > 0
          ? `\n\n## Related\n${related.map((r) => `- ${r.direction === "outgoing" ? "→" : "←"} **${r.node.title}** (${r.edge.relationship}) [slug: ${r.node.slug}]`).join("\n")}`
          : "";

      return {
        content: [
          {
            type: "text" as const,
            text: `# ${node.title}\n**Slug:** ${node.slug} | **Type:** ${node.type} | **Source:** ${node.source ?? "none"} | **Tags:** ${node.tags.join(", ") || "none"}\n\n${node.content}${relatedText}`,
          },
        ],
      };
    }
  );

  server.tool(
    "get_related",
    "Get all nodes related to a specific node, optionally filtered by relationship type",
    {
      slug: z.string().describe("Knowledge node slug"),
      relationship: z.enum(edgeRelationships).optional().describe(`Filter by relationship type (${edgeRelationships.join(", ")})`),
    },
    async ({ slug, relationship }, { authInfo }) => {
      const access = requireMcpAccess(authInfo, "read");
      if (!access.ok) return access.response;
      const { workspaceId } = access;
      const node = await getNodeBySlug(slug, workspaceId);

      if (!node) {
        return {
          content: [{ type: "text" as const, text: "Node not found" }],
          isError: true,
        };
      }

      const related = await getRelatedNodes(node.id, workspaceId, { relationship });

      if (related.length === 0) {
        return {
          content: [
            { type: "text" as const, text: "No related nodes found" },
          ],
        };
      }

      const text = related
        .map(
          (r) =>
            `- ${r.direction === "outgoing" ? "→" : "←"} **${r.node.title}** (${r.edge.relationship}) — ${r.node.type}, slug: ${r.node.slug}`
        )
        .join("\n");

      return {
        content: [{ type: "text" as const, text: `## Related Nodes\n\n${text}` }],
      };
    }
  );

  server.tool(
    "how_to",
    "Ask how to do something in a specific codebase. Searches for relevant patterns, conventions, and architectural guidance.",
    {
      topic: z.string().describe("What you want to know how to do (e.g. 'create a REST endpoint', 'add a new database migration')"),
      source: z.string().optional().describe("Filter by source/repo to get project-specific guidance"),
    },
    async ({ topic, source }, { authInfo }) => {
      const access = requireMcpAccess(authInfo, "read");
      if (!access.ok) return access.response;
      const { workspaceId } = access;
      const nodes = await searchNodes(workspaceId, topic, {
        source,
        type: undefined,
        tags: undefined,
      });

      if (nodes.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No knowledge found about "${topic}". Try indexing more of your codebase first.`,
            },
          ],
        };
      }

      const text = nodes
        .map((n) => `### ${n.title} (${n.type})\n\n${n.content}`)
        .join("\n\n---\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `## How to: ${topic}\n\nBased on your knowledge graph:\n\n${text}`,
          },
        ],
      };
    }
  );
}
