import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createNode, updateNode, deleteNode } from "@/lib/db/queries";
import {
  knowledgeNodeTypes,
  edgeRelationships,
} from "@/lib/validators/knowledge";

export function registerWriteTools(server: McpServer) {
  server.tool(
    "add_knowledge",
    "Add a new knowledge node to your graph. Use this to index patterns, conventions, architecture, modules, decisions, concepts, notes, or references from your codebase or any source.",
    {
      type: z.enum(knowledgeNodeTypes).describe("Type of knowledge"),
      title: z.string().describe("Descriptive title"),
      content: z.string().describe("Full content in markdown, including real code examples"),
      tags: z.array(z.string()).optional().describe("Tags for categorization"),
      source: z.string().optional().describe("Where this knowledge comes from (e.g. github:org/repo, url:https://...)"),
      source_meta: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Additional metadata about the source (e.g. language, framework, year)"),
      related_to: z
        .array(
          z.object({
            id: z.string().uuid().describe("ID of the related node"),
            relationship: z.enum(edgeRelationships).describe("Type of relationship"),
          })
        )
        .optional()
        .describe("Create edges to existing nodes"),
    },
    async (
      { type, title, content, tags, source, source_meta, related_to },
      { authInfo }
    ) => {
      const userId = authInfo?.extra?.userId as string;

      const node = await createNode(userId, {
        type,
        title,
        content,
        tags: tags ?? [],
        source,
        sourceMeta: source_meta ?? {},
        relatedTo:
          related_to?.map((r) => ({
            id: r.id,
            relationship: r.relationship,
          })) ?? [],
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Knowledge node created:\n- **ID:** ${node.id}\n- **Title:** ${node.title}\n- **Type:** ${node.type}\n- **Source:** ${node.source ?? "none"}\n- **Tags:** ${node.tags.join(", ") || "none"}${related_to && related_to.length > 0 ? `\n- **Edges created:** ${related_to.length}` : ""}`,
          },
        ],
      };
    }
  );

  server.tool(
    "update_knowledge",
    "Update an existing knowledge node",
    {
      id: z.string().uuid().describe("ID of the node to update"),
      title: z.string().optional().describe("New title"),
      content: z.string().optional().describe("New content"),
      type: z.enum(knowledgeNodeTypes).optional().describe("New type"),
      tags: z.array(z.string()).optional().describe("New tags (replaces existing)"),
    },
    async ({ id, title, content, type, tags }, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string;

      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      if (type !== undefined) updates.type = type;
      if (tags !== undefined) updates.tags = tags;

      const node = await updateNode(id, userId, updates);

      if (!node) {
        return {
          content: [{ type: "text" as const, text: "Node not found" }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Updated node "${node.title}" (${node.id})`,
          },
        ],
      };
    }
  );

  server.tool(
    "delete_knowledge",
    "Delete a knowledge node and all its edges",
    {
      id: z.string().uuid().describe("ID of the node to delete"),
    },
    async ({ id }, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string;
      const deleted = await deleteNode(id, userId);

      if (!deleted) {
        return {
          content: [{ type: "text" as const, text: "Node not found" }],
          isError: true,
        };
      }

      return {
        content: [
          { type: "text" as const, text: `Deleted node ${id} and all its edges` },
        ],
      };
    }
  );
}
