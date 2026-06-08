"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function SlugRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  useEffect(() => {
    apiFetch<{ id: string }>(`/api/knowledge/by-slug/${slug}`).then((res) => {
      if (res.ok) {
        router.replace(`/knowledge/${res.data.id}`);
      } else {
        router.replace("/knowledge");
      }
    });
  }, [slug, router]);

  return <p className="text-muted-foreground">Resolving link...</p>;
}
