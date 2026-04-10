import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerAllTools } from "@/lib/mcp/register";
import { verifyMcpToken } from "@/lib/mcp/auth";

const handler = createMcpHandler(
  (server) => {
    registerAllTools(server);
  },
  {
    serverInfo: {
      name: "neo",
      version: "1.0.0",
    },
  },
  {
    basePath: "/api",
    maxDuration: 60,
  }
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const authHandler = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: `${APP_URL}/.well-known/oauth-protected-resource`,
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
