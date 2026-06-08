import { z } from "zod";
import { badRequest, jsonResponse } from "@/lib/api/v1/respond";
import { serializeNode } from "@/lib/api/v1/serialize";
import { contextSearchSchema } from "@/lib/api/v1/validators";
import { logPlatformApiUsage, withPlatform } from "@/lib/api/v1/with-platform";
import { hybridSearch, searchNodes, semanticSearch } from "@/lib/db/queries";
import { generateEmbedding } from "@/lib/knowledge/embeddings";

export async function POST(request: Request) {
  return withPlatform(
    request,
    { scope: "read", requireWorkspace: true, requireTenant: true },
    async (ctx, requestId) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return badRequest("Invalid JSON body.", undefined, requestId);
      }

      let input: z.infer<typeof contextSearchSchema>;
      try {
        input = contextSearchSchema.parse(body);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return badRequest(err.issues[0]?.message ?? "Invalid input.", undefined, requestId);
        }
        throw err;
      }

      const filters = {
        type: input.type,
        source: input.source,
        tags: input.tags,
        tenantId: ctx.tenant!.id,
      };
      const topK = input.top_k ?? 20;

      let nodes;
      if (input.mode === "text") {
        nodes = await searchNodes(ctx.workspace!.id, input.query, filters);
      } else if (input.mode === "semantic") {
        const embedding = await generateEmbedding(input.query);
        nodes = await semanticSearch(ctx.workspace!.id, embedding, filters);
      } else {
        let embedding: number[] | null = null;
        try {
          embedding = await generateEmbedding(input.query);
        } catch (err) {
          console.error("embedding failed:", err instanceof Error ? err.message : err);
        }
        nodes = await hybridSearch(ctx.workspace!.id, input.query, embedding, filters);
      }

      logPlatformApiUsage(ctx, "search");

      return jsonResponse(
        {
          object: "search_result",
          mode: input.mode,
          query: input.query,
          data: nodes.slice(0, topK).map(serializeNode),
        },
        200,
        requestId
      );
    }
  );
}
