import { eq, and, isNull, type SQL } from "drizzle-orm";
import { knowledgeNodes } from "@/lib/db/schema";

/** Scope knowledge queries by tenant. null = personal/non-tenant rows only. */
export function tenantCondition(tenantId: string | null): SQL {
  if (tenantId === null) {
    return isNull(knowledgeNodes.tenantId);
  }
  return eq(knowledgeNodes.tenantId, tenantId);
}
