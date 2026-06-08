import { getApiTokenByHash, touchApiTokenLastUsed } from "@/lib/db/queries";
import { hashToken } from "@/lib/auth/token";

/**
 * Resolve a Bearer token (passed by the MCP client as `Authorization: Bearer ...`)
 * into a workspace-scoped auth context.
 *
 * The token is hashed (SHA-256) and looked up in the api_tokens table; the
 * matching workspace and creator are returned in `extra` so MCP tools can
 * scope their work correctly.
 */
export async function verifyMcpToken(_req: Request, bearerToken?: string) {
  if (!bearerToken) return undefined;

  const token = bearerToken.startsWith("Bearer ")
    ? bearerToken.slice(7)
    : bearerToken;

  const hash = hashToken(token);
  const result = await getApiTokenByHash(hash);
  if (!result) return undefined;

  // Fire-and-forget: track last-used timestamp without blocking the request.
  touchApiTokenLastUsed(result.token.id).catch(() => {});

  return {
    token,
    clientId: result.workspace.id, // workspace is the tenant identity for MCP
    scopes: result.token.scopes,
    extra: {
      workspaceId: result.workspace.id,
      workspaceSlug: result.workspace.slug,
      createdByUserId: result.token.createdByUserId,
      tokenId: result.token.id,
    },
  };
}
