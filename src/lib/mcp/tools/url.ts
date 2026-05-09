import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createNode } from "@/lib/db/queries";
import { requireMcpAccess } from "@/lib/mcp/permissions";
import { fetchPublicUrl } from "./fetch-url";

export function registerUrlTool(server: McpServer) {
  server.tool(
    "add_url",
    "Fetch a URL and add its content as a knowledge node. Useful for indexing articles, documentation, papers, etc.",
    {
      url: z.string().url().describe("URL to fetch and index"),
      title: z.string().optional().describe("Override title (auto-extracted if omitted)"),
      tags: z.array(z.string()).optional().describe("Tags for categorization"),
      type: z
        .enum(["reference", "concept", "note"] as const)
        .optional()
        .default("reference")
        .describe("Node type (defaults to reference)"),
    },
    async ({ url, title, tags, type }, { authInfo }) => {
      const access = requireMcpAccess(authInfo, "write");
      if (!access.ok) return access.response;
      const { userId } = access;

      let content: string;
      let extractedTitle = title ?? url;
      let finalUrl = url;

      try {
        const result = await fetchPublicUrl(url);
        const html = result.text;
        finalUrl = result.finalUrl;

        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (!title && titleMatch) {
          extractedTitle = titleMatch[1].trim();
        }

        content = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 50000);
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching URL: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }

      const node = await createNode(userId, {
        type: type ?? "reference",
        title: extractedTitle,
        content: `Source: ${finalUrl}\n\n${content}`,
        tags: tags ?? [],
        source: `url:${finalUrl}`,
        sourceMeta: {
          url,
          finalUrl,
          fetchedAt: new Date().toISOString(),
        },
        relatedTo: [],
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Indexed URL as knowledge node:\n- **ID:** ${node.id}\n- **Title:** ${extractedTitle}\n- **Content length:** ${content.length} chars`,
          },
        ],
      };
    }
  );
}
