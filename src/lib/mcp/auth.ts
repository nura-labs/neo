import { getUserByApiToken } from "@/lib/db/queries";

export async function verifyMcpToken(_req: Request, bearerToken?: string) {
  if (!bearerToken) return undefined;

  const token = bearerToken.startsWith("Bearer ")
    ? bearerToken.slice(7)
    : bearerToken;

  const user = await getUserByApiToken(token);
  if (!user) return undefined;

  return {
    token,
    clientId: user.id,
    scopes: ["read", "write"],
    extra: { userId: user.id },
  };
}
