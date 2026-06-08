import { NextResponse } from "next/server";
import {
  aggregateUsage,
  listAccountTokens,
  listTenants,
} from "@/lib/platform/queries";
import {
  getWorkspacePlatformContext,
  handleWorkspacePlatformError,
} from "@/lib/platform/web-auth";

export async function GET(request: Request) {
  try {
    const { org, workspace } = await getWorkspacePlatformContext(request);

    const [usage, tenantList, keys] = await Promise.all([
      aggregateUsage({
        surface: "platform",
        platformOrgId: org.id,
        workspaceId: workspace.id,
        days: 30,
      }),
      listTenants(org.id, { limit: 5 }),
      listAccountTokens(org.id),
    ]);

    const topOperations = Object.entries(usage.by_operation)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([operation, units]) => ({ operation, units }));

    const topChannels = Object.entries(usage.by_via)
      .sort(([, a], [, b]) => b - a)
      .map(([via, units]) => ({ via, units }));

    const topTenants = (usage.by_tenant ?? [])
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        enabled_at: org.enabledAt,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        scope: workspace.scope,
      },
      counts: {
        tenants: tenantList.total,
        api_keys: keys.length,
      },
      usage: {
        period: usage.period,
        totals: usage.totals,
        top_operations: topOperations,
        top_channels: topChannels,
        top_tenants: topTenants,
      },
      recent_tenants: tenantList.tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        external_id: t.externalId,
        created_at: t.createdAt,
      })),
      api_keys: keys.slice(0, 5).map((k) => ({
        id: k.id,
        name: k.name,
        token_prefix: k.tokenPrefix,
        last_used_at: k.lastUsedAt,
        created_at: k.createdAt,
      })),
    });
  } catch (error) {
    const handled = handleWorkspacePlatformError(error);
    if (handled) {
      return NextResponse.json({ error: handled.error }, { status: handled.status });
    }
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
