type McpAuthInfo = {
  scopes?: string[];
  extra?: Record<string, unknown>;
};

interface AccessOk {
  ok: true;
  workspaceId: string;
  workspaceSlug: string;
  createdByUserId: string;
  scopes: string[];
}

interface AccessFail {
  ok: false;
  response: {
    content: { type: "text"; text: string }[];
    isError: true;
  };
}

export function requireMcpAccess(
  authInfo: unknown,
  requiredScope: "read" | "write"
): AccessOk | AccessFail {
  const info = authInfo as McpAuthInfo | undefined;
  const workspaceId = info?.extra?.workspaceId;
  const workspaceSlug = info?.extra?.workspaceSlug;
  const createdByUserId = info?.extra?.createdByUserId;

  if (
    typeof workspaceId !== "string" ||
    workspaceId.length === 0 ||
    typeof workspaceSlug !== "string" ||
    typeof createdByUserId !== "string"
  ) {
    return {
      ok: false,
      response: {
        content: [{ type: "text", text: "Missing MCP workspace context" }],
        isError: true,
      },
    };
  }

  if (!info?.scopes?.includes(requiredScope)) {
    return {
      ok: false,
      response: {
        content: [
          { type: "text", text: `Missing required MCP scope: ${requiredScope}` },
        ],
        isError: true,
      },
    };
  }

  return {
    ok: true,
    workspaceId,
    workspaceSlug,
    createdByUserId,
    scopes: info.scopes,
  };
}
