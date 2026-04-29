import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerReadTools } from "./tools/read";
import { registerWriteTools } from "./tools/write";
import { registerUrlTool } from "./tools/url";

export function registerAllTools(server: McpServer) {
  registerReadTools(server);
  registerWriteTools(server);
  registerUrlTool(server);
}
