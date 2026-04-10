import { createHash } from "crypto";

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
  const { randomBytes } = require("crypto") as typeof import("crypto");
  return randomBytes(32).toString("hex");
}

export function generateClientId(): string {
  const { randomBytes } = require("crypto") as typeof import("crypto");
  return `neo-client-${randomBytes(16).toString("hex")}`;
}

export function generateClientSecret(): string {
  const { randomBytes } = require("crypto") as typeof import("crypto");
  return `neo-secret-${randomBytes(32).toString("hex")}`;
}
