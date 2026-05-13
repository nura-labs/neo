import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/auth/api";
import { db } from "@/lib/db";
import { activityEvents, users } from "@/lib/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

/**
 * Flexible activity query. All filters are optional.
 *
 * Query params:
 *   window=24h|7d|30d|90d|365d|all       (default: 7d)
 *   from=<ISO date>                       (overrides window)
 *   types=search,node.create,...          (CSV of types)
 *   via=web,mcp,cli                       (CSV of surfaces)
 *   actor=me|all|<userId>                 (default: all)
 *   limit=200                             (default 100, max 500)
 *   group=day|hour|none                   (default: none → returns events;
 *                                          day → also returns timeseries)
 *
 * Always returns:
 *   { events: [...], total: N, byType: {...}, byVia: {...},
 *     timeseries?: [{bucket, count}] }
 */
export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await getAuthenticatedContext(request);
  } catch {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const window = url.searchParams.get("window") ?? "7d";
  const fromParam = url.searchParams.get("from");
  const typesCsv = url.searchParams.get("types");
  const viaCsv = url.searchParams.get("via");
  const actor = url.searchParams.get("actor") ?? "all";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 500);
  const group = (url.searchParams.get("group") ?? "none") as "none" | "day" | "hour";

  const since =
    fromParam ? new Date(fromParam) :
    window === "24h" ? new Date(Date.now() - 24 * 3600_000) :
    window === "7d"  ? new Date(Date.now() - 7 * 86400_000) :
    window === "30d" ? new Date(Date.now() - 30 * 86400_000) :
    window === "90d" ? new Date(Date.now() - 90 * 86400_000) :
    window === "365d" ? new Date(Date.now() - 365 * 86400_000) :
    new Date(0);

  const conditions = [
    eq(activityEvents.workspaceId, ctx.workspace.id),
    gte(activityEvents.createdAt, since),
  ];
  if (typesCsv) {
    const types = typesCsv.split(",").map((s) => s.trim()).filter(Boolean);
    if (types.length) conditions.push(inArray(activityEvents.type, types));
  }
  if (viaCsv) {
    const vias = viaCsv.split(",").map((s) => s.trim()).filter(Boolean);
    if (vias.length) conditions.push(inArray(activityEvents.via, vias));
  }
  if (actor === "me") {
    conditions.push(eq(activityEvents.actorUserId, ctx.user.id));
  } else if (actor !== "all") {
    conditions.push(eq(activityEvents.actorUserId, actor));
  }

  const where = and(...conditions);

  // Events list with actor info
  const eventsRows = await db
    .select({
      event: activityEvents,
      actor: { username: users.username, name: users.name, email: users.email },
    })
    .from(activityEvents)
    .leftJoin(users, eq(activityEvents.actorUserId, users.id))
    .where(where)
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);

  // Aggregates (always: total, byType, byVia)
  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityEvents)
    .where(where);

  const byTypeRows = await db
    .select({ type: activityEvents.type, count: sql<number>`count(*)::int` })
    .from(activityEvents)
    .where(where)
    .groupBy(activityEvents.type)
    .orderBy(desc(sql`count(*)`));

  const byViaRows = await db
    .select({ via: activityEvents.via, count: sql<number>`count(*)::int` })
    .from(activityEvents)
    .where(where)
    .groupBy(activityEvents.via);

  // Optional timeseries — node-postgres driver returns { rows: [...] } from db.execute
  let timeseries: { bucket: string; count: number }[] | undefined;
  if (group === "day" || group === "hour") {
    const tsResult = await db
      .select({
        bucket:
          group === "hour"
            ? sql<string>`date_trunc('hour', ${activityEvents.createdAt})`.as("bucket")
            : sql<string>`date_trunc('day', ${activityEvents.createdAt})`.as("bucket"),
        count: sql<number>`count(*)::int`,
      })
      .from(activityEvents)
      .where(where)
      .groupBy(sql`bucket`)
      .orderBy(sql`bucket asc`);

    timeseries = tsResult.map((r) => ({
      bucket: typeof r.bucket === "string" ? r.bucket : new Date(r.bucket).toISOString(),
      count: r.count,
    }));
  }

  return NextResponse.json({
    window,
    from: since.toISOString(),
    total: totalRow?.count ?? 0,
    byType: Object.fromEntries(byTypeRows.map((r) => [r.type, r.count])),
    byVia: Object.fromEntries(byViaRows.map((r) => [r.via, r.count])),
    timeseries,
    events: eventsRows.map((r) => ({
      id: r.event.id,
      type: r.event.type,
      via: r.event.via,
      summary: r.event.summary,
      payload: r.event.payload,
      createdAt: r.event.createdAt,
      actor: r.actor,
    })),
  });
}
