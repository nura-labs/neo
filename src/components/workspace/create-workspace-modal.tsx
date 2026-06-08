"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

interface Props {
  open: boolean;
  onClose: () => void;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function CreateWorkspaceModal({ open, onClose }: Props) {
  const { refreshWorkspaces, setCurrentWorkspaceSlug } = useAuth();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await apiFetch<{ slug: string }>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name, slug: effectiveSlug || undefined }),
    });
    setLoading(false);
    if (!res.ok) {
      setError(
        (res.data as { error?: string } | null)?.error ?? "Failed to create workspace"
      );
      return;
    }
    await refreshWorkspaces();
    setCurrentWorkspaceSlug(res.data.slug);
    setName("");
    setSlug("");
    setSlugTouched(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create workspace"
      description="A workspace is where your knowledge lives — keep it solo or invite others."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ws-name">Name</Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme"
            required
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ws-slug">Slug</Label>
          <Input
            id="ws-slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="acme"
          />
          <p className="text-xs text-muted-foreground">
            Used in URLs and API tokens. Lowercase letters, numbers, and dashes.
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !name}>
            {loading ? "Creating..." : "Create workspace"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
