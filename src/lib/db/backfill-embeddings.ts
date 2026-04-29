/**
 * Backfill script: Generate embeddings for existing knowledge nodes via Vertex AI.
 * Run with: npx tsx src/lib/db/backfill-embeddings.ts
 * Idempotent: only updates nodes with null embedding.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, isNull } from "drizzle-orm";
import { knowledgeNodes } from "./schema";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.GCP_PROJECT_ID;
const REGION = process.env.GCP_REGION ?? "us-central1";
const MODEL = "text-embedding-005";
const DIMENSIONS = 768;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function getAccessToken(): Promise<string> {
  try {
    const res = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" } }
    );
    if (res.ok) return (await res.json()).access_token;
  } catch {}
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (token) return token;
  throw new Error("Set GOOGLE_ACCESS_TOKEN for local dev");
}

async function embedOne(text: string, accessToken: string): Promise<number[]> {
  const url = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/${MODEL}:predict`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        instances: [{ content: text }],
        parameters: { outputDimensionality: DIMENSIONS },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.predictions[0].embeddings.values;
    }

    if (response.status === 429) {
      const wait = Math.pow(2, attempt) * 2000;
      console.log(`    Rate limited, waiting ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    throw new Error(`Vertex AI error: ${response.status}`);
  }

  throw new Error("Max retries exceeded");
}

async function backfill() {
  if (!PROJECT_ID) {
    console.error("GCP_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID required");
    process.exit(1);
  }

  const accessToken = await getAccessToken();

  const nodes = await db
    .select({ id: knowledgeNodes.id, title: knowledgeNodes.title, content: knowledgeNodes.content })
    .from(knowledgeNodes)
    .where(isNull(knowledgeNodes.embedding));

  console.log(`Found ${nodes.length} nodes without embeddings`);

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const text = `${node.title}\n\n${node.content}`.slice(0, 32000);

    console.log(`  [${i + 1}/${nodes.length}] ${node.title}`);

    const embedding = await embedOne(text, accessToken);

    await db
      .update(knowledgeNodes)
      .set({ embedding })
      .where(eq(knowledgeNodes.id, node.id));
  }

  console.log("Backfill complete");
  await pool.end();
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
