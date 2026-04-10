"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function McpUrl({ appUrl }: { appUrl: string }) {
  const [copied, setCopied] = useState(false);
  const mcpUrl = `${appUrl}/api/mcp`;

  function copy() {
    navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex gap-2">
      <Input value={mcpUrl} readOnly className="font-mono text-sm" />
      <Button variant="outline" size="sm" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
