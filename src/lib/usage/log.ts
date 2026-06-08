import { db } from "@/lib/db";
import {
  usageEvents,
  type UsageSurface,
} from "@/lib/db/schema";

export interface LogUsageInput {
  surface: UsageSurface;
  operation: string;
  via?: "web" | "mcp" | "cli" | "api" | "system";
  units?: number;
  billable?: boolean;
  platformOrgId?: string | null;
  workspaceId?: string | null;
  tenantId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

const OPERATION_UNITS: Record<string, number> = {
  search: 1,
  "node.create": 2,
  "node.update": 2,
  "node.delete": 0,
  "node.read": 1,
  "overview.read": 1,
  "related.read": 1,
  "tenant.create": 0,
  "dream.run": 10,
  "api.request": 1,
};

export function unitsForOperation(operation: string, override?: number): number {
  if (override !== undefined) return override;
  return OPERATION_UNITS[operation] ?? 1;
}

export function logUsage(input: LogUsageInput): void {
  const units = unitsForOperation(input.operation, input.units);
  db.insert(usageEvents)
    .values({
      surface: input.surface,
      operation: input.operation,
      via: input.via ?? "web",
      units,
      billable: input.billable ?? units > 0,
      platformOrgId: input.platformOrgId ?? null,
      workspaceId: input.workspaceId ?? null,
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      metadata: input.metadata ?? {},
    })
    .execute()
    .catch((err) => {
      console.error("[usage] log failed:", err instanceof Error ? err.message : err);
    });
}

export function surfaceFromVia(via: "web" | "mcp" | "cli" | "api" | "system"): UsageSurface {
  return via === "api" ? "platform" : "personal";
}
