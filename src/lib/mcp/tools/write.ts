import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createNode,
  updateNode,
  getNodeBySlug,
  createEdge,
  findNodeBySlugOrTitle,
  getEdgeByNodes,
} from "@/lib/db/queries";
import { knowledgeNodeTypes, edgeRelationships } from "@/lib/validators/knowledge";
import { generateSlug } from "@/lib/utils/slugify";
import { requireMcpAccess } from "@/lib/mcp/permissions";

const nodeTypeDescription = `Type of knowledge (${knowledgeNodeTypes.join(", ")})`;
const relationshipDescription = `Type of relationship (${edgeRelationships.join(", ")})`;

export function registerWriteTools(server: McpServer) {
  server.tool(
    "add_knowledge",
    "Add a new knowledge node to your graph. Use this to index patterns, conventions, architecture, workflows, snippets, modules, APIs, services, configs, decisions, concepts, notes, references, people, teams, projects, tools, or research. You can link to other nodes using [[wikilinks]] in your content — e.g. [[Auth Pattern]] or [[React|uses]].",
    {
      type: z.enum(knowledgeNodeTypes).describe(nodeTypeDescription),
      title: z.string().describe("Descriptive title — this becomes the node's slug for wikilinks"),
      content: z.string().describe(`Full content in markdown. Use [[Node Title]] to link to other nodes, or [[Node Title|relationship]] for typed links (${edgeRelationships.join(", ")})`),
      tags: z.array(z.string()).optional().describe("Tags for categorization"),
      source: z.string().optional().describe("Where this knowledge comes from (e.g. github:org/repo, url:https://...)"),
      source_meta: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Additional metadata about the source"),
      related_to: z
        .array(
          z.object({
            title: z.string().describe("Title or slug of the related node"),
            relationship: z.enum(edgeRelationships).describe(relationshipDescription),
          })
        )
        .optional()
        .describe("Create edges to existing nodes by title or slug (no UUIDs needed)"),
    },
    async (
      { type, title, content, tags, source, source_meta, related_to },
      { authInfo }
    ) => {
      const access = requireMcpAccess(authInfo, "write");
      if (!access.ok) return access.response;
      const { workspaceId, createdByUserId } = access;

      const resolvedRelations: { id: string; relationship: typeof edgeRelationships[number] }[] = [];
      const unresolvedTitles: string[] = [];

      if (related_to) {
        for (const rel of related_to) {
          const target = await findNodeBySlugOrTitle(rel.title, workspaceId);
          if (target) {
            resolvedRelations.push({ id: target.id, relationship: rel.relationship });
          } else {
            unresolvedTitles.push(rel.title);
          }
        }
      }

      const node = await createNode(
        workspaceId,
        createdByUserId,
        {
          type,
          title,
          content,
          tags: tags ?? [],
          source,
          sourceMeta: source_meta ?? {},
          relatedTo: resolvedRelations,
        },
        "mcp"
      );

      let response = `Knowledge node created:\n- **ID:** ${node.id}\n- **Slug:** ${node.slug}\n- **Title:** ${node.title}\n- **Type:** ${node.type}`;

      if (node.source) response += `\n- **Source:** ${node.source}`;
      if (node.tags.length > 0) response += `\n- **Tags:** ${node.tags.join(", ")}`;
      if (resolvedRelations.length > 0) response += `\n- **Edges created:** ${resolvedRelations.length}`;
      if (unresolvedTitles.length > 0) response += `\n- **Unresolved links:** ${unresolvedTitles.join(", ")} (nodes not found)`;

      return {
        content: [{ type: "text" as const, text: response }],
      };
    }
  );

  server.tool(
    "link_knowledge",
    "Create a relationship between two existing knowledge nodes by title or slug. Idempotent: if the edge already exists, no duplicate is created.",
    {
      source_title: z.string().describe("Title or slug of the source node"),
      target_title: z.string().describe("Title or slug of the target node"),
      relationship: z.enum(edgeRelationships).describe(relationshipDescription),
    },
    async ({ source_title, target_title, relationship }, { authInfo }) => {
      const access = requireMcpAccess(authInfo, "write");
      if (!access.ok) return access.response;
      const { workspaceId, createdByUserId } = access;

      const sourceSlug = generateSlug(source_title);
      const targetSlug = generateSlug(target_title);

      const [sourceNode, targetNode] = await Promise.all([
        findNodeBySlugOrTitle(source_title, workspaceId),
        findNodeBySlugOrTitle(target_title, workspaceId),
      ]);

      if (!sourceNode) {
        return {
          content: [{ type: "text" as const, text: `Source node not found: "${source_title}" (slug: ${sourceSlug})` }],
          isError: true,
        };
      }
      if (!targetNode) {
        return {
          content: [{ type: "text" as const, text: `Target node not found: "${target_title}" (slug: ${targetSlug})` }],
          isError: true,
        };
      }

      const edge = await createEdge({
        workspaceId,
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        relationship,
        via: "mcp",
        actorUserId: createdByUserId,
      });

      if (!edge) {
        const existingEdge = await getEdgeByNodes({
          workspaceId,
          sourceId: sourceNode.id,
          targetId: targetNode.id,
          relationship,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: existingEdge
                ? `Edge already exists: **${sourceNode.title}** → ${relationship} → **${targetNode.title}**\n\ncreated: false`
                : `Failed to create edge for **${sourceNode.title}** → ${relationship} → **${targetNode.title}**`,
            },
          ],
          isError: !existingEdge,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Linked: **${sourceNode.title}** → ${relationship} → **${targetNode.title}**\n\ncreated: true`,
          },
        ],
      };
    }
  );

  server.tool(
    "update_knowledge",
    "Update an existing knowledge node. Use [[wikilinks]] in content to auto-create connections.",
    {
      slug: z.string().describe("Slug of the node to update"),
      title: z.string().optional().describe("New title"),
      content: z.string().optional().describe("New content (supports [[wikilinks]])"),
      type: z.enum(knowledgeNodeTypes).optional().describe(`New ${nodeTypeDescription.toLowerCase()}`),
      tags: z.array(z.string()).optional().describe("New tags (replaces existing)"),
    },
    async ({ slug, title, content, type, tags }, { authInfo }) => {
      const access = requireMcpAccess(authInfo, "write");
      if (!access.ok) return access.response;
      const { workspaceId } = access;

      const existing = await getNodeBySlug(slug, workspaceId);
      if (!existing) {
        return {
          content: [{ type: "text" as const, text: "Node not found" }],
          isError: true,
        };
      }

      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      if (type !== undefined) updates.type = type;
      if (tags !== undefined) updates.tags = tags;

      const node = await updateNode(existing.id, workspaceId, updates);

      if (!node) {
        return {
          content: [{ type: "text" as const, text: "Failed to update node" }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Updated node **${node.title}** (${node.slug})`,
          },
        ],
      };
    }
  );

}
