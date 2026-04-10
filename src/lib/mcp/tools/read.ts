import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getOverview,
  searchNodes,
  getNodeById,
  getRelatedNodes,
} from "@/lib/db/queries";

export function registerReadTools(server: McpServer) {
  server.tool(
    "get_overview",
    "Get an overview of your knowledge graph: total nodes, edges, breakdown by type and source, and recent entries",
    { source: z.string().optional().describe("Filter by source (e.g. github:org/repo)") },
    async ({ source }, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string;
      const overview = await getOverview(userId);

      const lines = [
        `## Knowledge Graph Overview`,
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
            `- **${n.title}** (${n.type}) — ${n.source ?? "no source"}`
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
      type: z.string().optional().describe("Filter by node type (pattern, convention, module, architecture, decision, concept, note, reference)"),
      source: z.string().optional().describe("Filter by source (e.g. github:org/repo)"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
    },
    async ({ query, type, source, tags }, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string;
      const nodes = await searchNodes(userId, query, { type, source, tags });

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
            `### ${n.title}\n**Type:** ${n.type} | **Source:** ${n.source ?? "none"} | **Tags:** ${n.tags.join(", ") || "none"}\n\n${n.content.slice(0, 500)}${n.content.length > 500 ? "..." : ""}\n\n---`
        )
        .join("\n\n");

      return {
        content: [{ type: "text" as const, text }],
      };
    }
  );

  server.tool(
    "get_node",
    "Get the full content of a specific knowledge node by its ID",
    { id: z.string().uuid().describe("Knowledge node ID") },
    async ({ id }, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string;
      const node = await getNodeById(id, userId);

      if (!node) {
        return {
          content: [{ type: "text" as const, text: "Node not found" }],
          isError: true,
        };
      }

      const related = await getRelatedNodes(id, userId);
      const relatedText =
        related.length > 0
          ? `\n\n## Related\n${related.map((r) => `- ${r.direction === "outgoing" ? "→" : "←"} **${r.node.title}** (${r.edge.relationship})`).join("\n")}`
          : "";

      return {
        content: [
          {
            type: "text" as const,
            text: `# ${node.title}\n**Type:** ${node.type} | **Source:** ${node.source ?? "none"} | **Tags:** ${node.tags.join(", ") || "none"}\n\n${node.content}${relatedText}`,
          },
        ],
      };
    }
  );

  server.tool(
    "get_related",
    "Get all nodes related to a specific node, optionally filtered by relationship type",
    {
      id: z.string().uuid().describe("Knowledge node ID"),
      relationship: z.string().optional().describe("Filter by relationship type"),
    },
    async ({ id, relationship }, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string;
      const related = await getRelatedNodes(id, userId, { relationship });

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
            `- ${r.direction === "outgoing" ? "→" : "←"} **${r.node.title}** (${r.edge.relationship}) — ${r.node.type}, source: ${r.node.source ?? "none"}`
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
      const userId = authInfo?.extra?.userId as string;
      const nodes = await searchNodes(userId, topic, {
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
