const DIMENSIONS = 768;
const MODEL = "text-embedding-005";

export { DIMENSIONS };

async function getAccessToken(): Promise<string> {
  // On Cloud Run, the metadata server provides access tokens automatically
  const metadataUrl =
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

  try {
    const res = await fetch(metadataUrl, {
      headers: { "Metadata-Flavor": "Google" },
    });
    if (res.ok) {
      const data = await res.json();
      return data.access_token;
    }
  } catch {
    // Not on Cloud Run — fall back to GOOGLE_ACCESS_TOKEN env var for local dev
  }

  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (token) return token;

  throw new Error(
    "No Google auth available. Set GOOGLE_ACCESS_TOKEN for local dev or run on Cloud Run."
  );
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.GCP_PROJECT_ID;
  if (!projectId) throw new Error("GCP_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set");

  const region = process.env.GCP_REGION ?? "us-central1";
  const accessToken = await getAccessToken();

  const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${MODEL}:predict`;

  // Truncate to ~8000 tokens (~32000 chars)
  const input = text.slice(0, 32000);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      instances: [{ content: input }],
      parameters: { outputDimensionality: DIMENSIONS },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Vertex AI embeddings failed: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.predictions[0].embeddings.values;
}

export async function generateNodeEmbedding(
  title: string,
  content: string
): Promise<number[]> {
  return generateEmbedding(`${title}\n\n${content}`);
}
