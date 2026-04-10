"use client";

import { useState } from "react";

export function CopyCommand({ command, label }: { command: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-md bg-muted p-3">
      {label && <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>}
      <div className="flex items-center justify-between gap-2">
        <code className="text-xs flex-1 break-all">{command}</code>
        <button
          onClick={copy}
          className="shrink-0 text-xs px-2 py-1 rounded border bg-background hover:bg-muted-foreground/10 transition-colors"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
