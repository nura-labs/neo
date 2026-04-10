"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ApiTokenManager({ initialToken }: { initialToken: string }) {
  const [token, setToken] = useState(initialToken);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function regenerate() {
    if (!confirm("Regenerate API token? The current token will stop working.")) return;
    const res = await fetch("/api/settings/token", { method: "POST" });
    const data = await res.json();
    setToken(data.apiToken);
    setRevealed(true);
  }

  function copy() {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const display = revealed ? token : token.slice(0, 10) + "..." + token.slice(-4);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={display} readOnly className="font-mono text-sm" />
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setRevealed(!revealed)}>
          {revealed ? "Hide" : "Show"}
        </Button>
      </div>
      <Button variant="destructive" size="sm" onClick={regenerate}>
        Regenerate Token
      </Button>
    </div>
  );
}
