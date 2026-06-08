import { createHash, randomBytes } from "crypto";

export function verifyPkce(
  codeVerifier: string,
  codeChallenge: string,
  method: string = "S256"
): boolean {
  if (method !== "S256") return false;

  const hash = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return hash === codeChallenge;
}

export function generateCode(): string {
  return randomBytes(32).toString("hex");
}

export function generateClientId(): string {
  return `neo-client-${randomBytes(16).toString("hex")}`;
}

export function generateClientSecret(): string {
  return `neo-secret-${randomBytes(32).toString("hex")}`;
}
