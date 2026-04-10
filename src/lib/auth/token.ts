import { randomBytes } from "crypto";

export function generateApiToken(): string {
  return `sk-neo-${randomBytes(24).toString("hex")}`;
}
