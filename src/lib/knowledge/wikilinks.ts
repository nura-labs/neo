import { edgeRelationships } from "@/lib/validators/knowledge";

export interface WikiLink {
  raw: string;
  target: string;
  relationship: string;
  section: string | null;
}

const WIKILINK_REGEX = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;

const validRelationships = new Set<string>(edgeRelationships);

export function parseWikilinks(content: string): WikiLink[] {
  const links: WikiLink[] = [];
  const seen = new Set<string>();

  for (const match of content.matchAll(WIKILINK_REGEX)) {
    const raw = match[0];
    const target = match[1].trim();
    const section = match[2]?.trim() ?? null;
    const relationship = match[3]?.trim() ?? "related_to";

    const key = `${target}|${relationship}`;
    if (seen.has(key)) continue;
    seen.add(key);

    links.push({
      raw,
      target,
      relationship: validRelationships.has(relationship) ? relationship : "related_to",
      section,
    });
  }

  return links;
}
