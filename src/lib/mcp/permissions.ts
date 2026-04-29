type McpAuthInfo = {
  scopes?: string[];
  extra?: Record<string, unknown>;
};

export function requireMcpAccess(
  authInfo: unknown,
  requiredScope: "read" | "write"
) {
  const info = authInfo as McpAuthInfo | undefined;
  const userId = info?.extra?.userId;

  if (typeof userId !== "string" || userId.length === 0) {
    return {
      ok: false as const,
      response: {
        content: [{ type: "text" as const, text: "Missing MCP user context" }],
        isError: true,
      },
    };
  }

  if (!info?.scopes?.includes(requiredScope)) {
    return {
      ok: false as const,
      response: {
        content: [
          {
            type: "text" as const,
            text: `Missing required MCP scope: ${requiredScope}`,
          },
        ],
        isError: true,
      },
    };
  }

  return { ok: true as const, userId };
}

export function requireMcpUserId(authInfo: unknown) {
  const access = requireMcpAccess(authInfo, "read");
  if (!access.ok) {
    throw new Error(access.response.content[0].text);
  }
  return access.userId;
}
