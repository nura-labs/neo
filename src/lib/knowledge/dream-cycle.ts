import { eq, and, sql, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { knowledgeNodes, knowledgeEdges, dreamSuggestions } from "@/lib/db/schema";
import { createEdge } from "@/lib/db/queries";

// ─── Config ─────────────────────────────────────────────

const CHUNK_SIZE = 50;         // edges per LLM call
const SAMPLE_PERCENT = 0.05;   // 5% re-audit of already-analyzed edges
const MAX_SAMPLE = 200;        // cap sampling for very large graphs
const MAX_DISCOVERY_PAIRS = 500; // cap vector similarity candidates

// ─── Types ──────────────────────────────────────────────

export interface DreamCycleResult {
  userId: string;
  stats: {
    totalEdges: number;
    dirtyEdges: number;
    sampledEdges: number;
    orphansFound: number;
    candidatePairs: number;
  };
  actions: {
    edgesFixed: number;
    edgesRemoved: number;
    edgesCreated: number;
    suggestionsAccepted: number;
    suggestionsDismissed: number;
  };
  llmCalls: number;
}

// ─── LLM ────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  try {
    const res = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" } }
    );
    if (res.ok) return (await res.json()).access_token;
  } catch {}
  return process.env.GOOGLE_ACCESS_TOKEN ?? "";
}

async function callModel(
  model: string,
  prompt: string,
  maxTokens: number
): Promise<string | null> {
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.GCP_PROJECT_ID;
  if (!projectId) return null;

  const region = process.env.GCP_REGION ?? "us-central1";
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens },
      }),
    });

    if (!res.ok) {
      console.error(`[Dream] ${model} HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch (err) {
    console.error(`[Dream] ${model} error:`, err);
    return null;
  }
}

function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    const clean = text.replace(/^```json\s*\n?/, "").replace(/\n?\s*```$/, "").trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

// ─── Helpers ────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

interface EdgeRow {
  edge_id: string;
  relationship: string;
  auto_generated: boolean;
  source_title: string;
  source_type: string;
  target_title: string;
  target_type: string;
  [key: string]: unknown;
}

function formatEdgeList(edges: EdgeRow[]): string {
  return edges
    .map(
      (e, i) =>
        `${i}: "${e.source_title}" (${e.source_type}) → ${e.relationship} → "${e.target_title}" (${e.target_type})`
    )
    .join("\n");
}

const AUDIT_PROMPT_TEMPLATE = (count: number, edgeList: string) => `You are auditing ${count} edges in a knowledge graph.

For each edge, check:
1. Is the connection valid? (do these nodes actually relate?)
2. Is the DIRECTION correct? (e.g. "Database Layer contains Project Overview" is WRONG — Overview contains Database Layer)
3. Is the relationship type the best choice?

Valid types: uses, follows, contains, depends_on, related_to, extends, contradicts, alternative_to, same_concept, evolved_from, implements

Edges:
${edgeList}

Return a JSON array with ONLY edges that need changes. Skip correct ones.
Each entry: {"index": N, "action": "fix"|"remove", "correct_relationship": "...", "reason": "..."}
- "remove" if the edge is invalid or direction is wrong
- "fix" if only the relationship type needs changing

Return [] if all edges are correct.
Respond ONLY with the JSON array, no markdown:`;

// ─── Dream Cycle Core ──────────────────────────────────

export async function runDreamCycle(userId: string): Promise<DreamCycleResult> {
  const actions = { edgesFixed: 0, edgesRemoved: 0, edgesCreated: 0, suggestionsAccepted: 0, suggestionsDismissed: 0 };
  let llmCalls = 0;
  const now = new Date();

  // ══════════════════════════════════════════════════════
  // PHASE 1: AUDIT EDGES (delta + sampling)
  //
  // "Dirty" edges = never analyzed OR their nodes changed
  // since last analysis. Plus a random sample of old ones.
  // ══════════════════════════════════════════════════════

  // 1a. Dirty edges: new or nodes modified after last analysis
  const dirtyEdges = await db.execute<EdgeRow>(sql`
    SELECT
      ke.id as edge_id, ke.relationship, ke.auto_generated,
      src.title as source_title, src.type as source_type,
      tgt.title as target_title, tgt.type as target_type
    FROM knowledge_edges ke
    JOIN knowledge_nodes src ON src.id = ke.source_id AND src.user_id = ${userId}
    JOIN knowledge_nodes tgt ON tgt.id = ke.target_id AND tgt.user_id = ${userId}
    WHERE ke.last_analyzed_at IS NULL
       OR src.updated_at > ke.last_analyzed_at
       OR tgt.updated_at > ke.last_analyzed_at
  `);

  // 1b. Sample of already-analyzed edges (quality control)
  const totalEdgesResult = await db.execute<{ cnt: number }>(sql`
    SELECT count(*)::int as cnt
    FROM knowledge_edges ke
    JOIN knowledge_nodes src ON src.id = ke.source_id AND src.user_id = ${userId}
  `);
  const totalEdges = totalEdgesResult.rows?.[0]?.cnt ?? 0;

  const sampleSize = Math.min(
    Math.ceil(totalEdges * SAMPLE_PERCENT),
    MAX_SAMPLE
  );

  const sampledEdges = sampleSize > 0
    ? await db.execute<EdgeRow>(sql`
        SELECT
          ke.id as edge_id, ke.relationship, ke.auto_generated,
          src.title as source_title, src.type as source_type,
          tgt.title as target_title, tgt.type as target_type
        FROM knowledge_edges ke
        JOIN knowledge_nodes src ON src.id = ke.source_id AND src.user_id = ${userId}
        JOIN knowledge_nodes tgt ON tgt.id = ke.target_id AND tgt.user_id = ${userId}
        WHERE ke.last_analyzed_at IS NOT NULL
        ORDER BY RANDOM()
        LIMIT ${sampleSize}
      `)
    : { rows: [] };

  // Combine dirty + sample, deduplicate
  const seenIds = new Set<string>();
  const edgesToAudit: EdgeRow[] = [];

  for (const edge of [...(dirtyEdges.rows ?? []), ...(sampledEdges.rows ?? [])]) {
    if (seenIds.has(edge.edge_id)) continue;
    seenIds.add(edge.edge_id);
    edgesToAudit.push(edge);
  }

  // Process in chunks of CHUNK_SIZE
  for (const edgeChunk of chunk(edgesToAudit, CHUNK_SIZE)) {
    const result = parseJson<
      Array<{ index: number; action: "fix" | "remove"; correct_relationship?: string; reason: string }>
    >(await callModel("gemini-2.0-flash", AUDIT_PROMPT_TEMPLATE(edgeChunk.length, formatEdgeList(edgeChunk)), 4096));
    llmCalls++;

    if (result && Array.isArray(result)) {
      for (const fix of result) {
        const edge = edgeChunk[fix.index];
        if (!edge) continue;

        if (fix.action === "remove" && edge.auto_generated) {
          await db.delete(knowledgeEdges).where(eq(knowledgeEdges.id, edge.edge_id));
          actions.edgesRemoved++;
        } else if (fix.action === "fix" && fix.correct_relationship) {
          await db
            .update(knowledgeEdges)
            .set({ relationship: fix.correct_relationship })
            .where(eq(knowledgeEdges.id, edge.edge_id));
          actions.edgesFixed++;
        }
      }
    }

    // Mark all edges in this chunk as analyzed
    for (const edge of edgeChunk) {
      await db
        .update(knowledgeEdges)
        .set({ lastAnalyzedAt: now })
        .where(eq(knowledgeEdges.id, edge.edge_id));
    }
  }

  // ══════════════════════════════════════════════════════
  // PHASE 2: FIND ORPHANS
  // ══════════════════════════════════════════════════════

  const orphans = await db.execute<{ id: string; title: string; type: string }>(sql`
    SELECT kn.id, kn.title, kn.type
    FROM knowledge_nodes kn
    WHERE kn.user_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM knowledge_edges ke
        WHERE ke.source_id = kn.id OR ke.target_id = kn.id
      )
  `);
  const orphanRows = orphans.rows ?? [];

  // ══════════════════════════════════════════════════════
  // PHASE 3: DISCOVER NEW CONNECTIONS
  //
  // Vector similarity → collect candidates → single LLM
  // call per chunk to classify relationships.
  // ══════════════════════════════════════════════════════

  interface Candidate {
    sourceId: string;
    sourceTitle: string;
    sourceType: string;
    targetId: string;
    targetTitle: string;
    targetType: string;
    similarity: number;
  }

  const candidates: Candidate[] = [];
  const analyzedPairs = new Set<string>();

  const nodesWithEmbeddings = await db
    .select({
      id: knowledgeNodes.id,
      title: knowledgeNodes.title,
      type: knowledgeNodes.type,
    })
    .from(knowledgeNodes)
    .where(
      and(
        eq(knowledgeNodes.userId, userId),
        sql`${knowledgeNodes.embedding} IS NOT NULL`
      )
    );

  for (const node of nodesWithEmbeddings) {
    if (candidates.length >= MAX_DISCOVERY_PAIRS) break;

    const neighbors = await db.execute<{
      id: string;
      title: string;
      type: string;
      distance: number;
    }>(sql`
      SELECT kn2.id, kn2.title, kn2.type,
             kn.embedding <=> kn2.embedding AS distance
      FROM knowledge_nodes kn
      JOIN knowledge_nodes kn2
        ON kn2.user_id = ${userId}
        AND kn2.id != kn.id
        AND kn2.embedding IS NOT NULL
      WHERE kn.id = ${node.id}
        AND kn.user_id = ${userId}
      ORDER BY kn.embedding <=> kn2.embedding
      LIMIT 3
    `);

    for (const neighbor of (neighbors.rows ?? [])) {
      const similarity = 1 - neighbor.distance;
      if (similarity < 0.75) continue;

      const pairKey = [node.id, neighbor.id].sort().join("|");
      if (analyzedPairs.has(pairKey)) continue;
      analyzedPairs.add(pairKey);

      // Check no edge exists
      const existing = await db
        .select({ id: knowledgeEdges.id })
        .from(knowledgeEdges)
        .where(
          sql`(source_id = ${node.id} AND target_id = ${neighbor.id})
           OR (source_id = ${neighbor.id} AND target_id = ${node.id})`
        )
        .limit(1);

      if (existing.length > 0) continue;

      candidates.push({
        sourceId: node.id,
        sourceTitle: node.title,
        sourceType: node.type,
        targetId: neighbor.id,
        targetTitle: neighbor.title,
        targetType: neighbor.type,
        similarity,
      });
    }
  }

  // Process discovery candidates in chunks
  for (const candidateChunk of chunk(candidates, CHUNK_SIZE)) {
    const candidateList = candidateChunk
      .map(
        (c, i) =>
          `${i}: "${c.sourceTitle}" (${c.sourceType}) ↔ "${c.targetTitle}" (${c.targetType}) [sim: ${c.similarity.toFixed(2)}]`
      )
      .join("\n");

    const discoverPrompt = `Analyze ${candidateChunk.length} semantically similar node pairs that are NOT yet connected.

For each, decide: should they be connected? What relationship? Which direction?

Valid types: uses, follows, contains, depends_on, related_to, extends, contradicts, alternative_to, same_concept, evolved_from, implements

Pairs:
${candidateList}

Return JSON array with ONLY pairs that SHOULD be connected. Skip pairs that shouldn't.
Each: {"index": N, "relationship": "...", "direction": "source_to_target"|"target_to_source", "confidence": 0.0-1.0}

Return [] if none should connect.
Respond ONLY with JSON array, no markdown:`;

    const result = parseJson<
      Array<{
        index: number;
        relationship: string;
        direction: "source_to_target" | "target_to_source";
        confidence: number;
      }>
    >(await callModel("gemini-2.5-pro", discoverPrompt, 8192));
    llmCalls++;

    if (result && Array.isArray(result)) {
      for (const suggestion of result) {
        const c = candidateChunk[suggestion.index];
        if (!c || suggestion.confidence < 0.7) continue;

        const sourceId = suggestion.direction === "source_to_target" ? c.sourceId : c.targetId;
        const targetId = suggestion.direction === "source_to_target" ? c.targetId : c.sourceId;

        const edge = await createEdge({
          sourceId,
          targetId,
          relationship: suggestion.relationship,
          weight: suggestion.confidence,
          autoGenerated: true,
        });
        if (edge) actions.edgesCreated++;
      }
    }
  }

  // ══════════════════════════════════════════════════════
  // PHASE 4: RESOLVE PENDING SUGGESTIONS
  // ══════════════════════════════════════════════════════

  const pendingSuggestions = await db
    .select()
    .from(dreamSuggestions)
    .where(
      and(eq(dreamSuggestions.userId, userId), eq(dreamSuggestions.status, "pending"))
    );

  const actionable = pendingSuggestions.filter(
    (s) => s.type === "edge_suggestion" || s.type === "edge_removal"
  );

  for (const suggChunk of chunk(actionable, CHUNK_SIZE)) {
    const suggList = suggChunk
      .map((s, i) => {
        const p = s.payload as Record<string, unknown>;
        if (s.type === "edge_suggestion") {
          return `${i}: SUGGEST "${p.sourceTitle}" → ${p.relationship} → "${p.targetTitle}" (conf: ${p.confidence})`;
        }
        return `${i}: REMOVE "${p.sourceTitle}" → ${p.currentRelationship} → "${p.targetTitle}" (reason: ${p.reason})`;
      })
      .join("\n");

    const resolvePrompt = `Review ${suggChunk.length} knowledge graph suggestions. Accept or dismiss each.

${suggList}

Return JSON array: {"index": N, "accept": true/false}
Respond ONLY with JSON array, no markdown:`;

    const result = parseJson<Array<{ index: number; accept: boolean }>>(
      await callModel("gemini-2.5-pro", resolvePrompt, 4096)
    );
    llmCalls++;

    if (result && Array.isArray(result)) {
      for (const decision of result) {
        const sugg = suggChunk[decision.index];
        if (!sugg) continue;

        if (decision.accept) {
          const p = sugg.payload as Record<string, unknown>;
          if (sugg.type === "edge_suggestion") {
            const edge = await createEdge({
              sourceId: p.sourceId as string,
              targetId: p.targetId as string,
              relationship: (p.relationship as string) ?? "related_to",
              weight: (p.confidence as number) ?? 1.0,
              autoGenerated: true,
            });
            if (edge) actions.edgesCreated++;
          } else if (sugg.type === "edge_removal") {
            await db.delete(knowledgeEdges).where(eq(knowledgeEdges.id, p.edgeId as string));
            actions.edgesRemoved++;
          }
          await db.update(dreamSuggestions).set({ status: "accepted" }).where(eq(dreamSuggestions.id, sugg.id));
          actions.suggestionsAccepted++;
        } else {
          await db.update(dreamSuggestions).set({ status: "dismissed" }).where(eq(dreamSuggestions.id, sugg.id));
          actions.suggestionsDismissed++;
        }
      }
    }
  }

  // Auto-dismiss orphan/contradiction suggestions (informational)
  for (const s of pendingSuggestions.filter((s) => s.type === "orphan" || s.type === "contradiction")) {
    await db.update(dreamSuggestions).set({ status: "dismissed" }).where(eq(dreamSuggestions.id, s.id));
    actions.suggestionsDismissed++;
  }

  return {
    userId,
    stats: {
      totalEdges,
      dirtyEdges: dirtyEdges.rows?.length ?? 0,
      sampledEdges: sampledEdges.rows?.length ?? 0,
      orphansFound: orphanRows.length,
      candidatePairs: candidates.length,
    },
    actions,
    llmCalls,
  };
}
