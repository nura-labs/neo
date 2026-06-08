import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/api";
import {
  createAccountToken,
  enablePlatformOrg,
  getPlatformOrgByUserId,
} from "@/lib/platform/queries";
import { generateSlug } from "@/lib/utils/slugify";

const enableSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export async function POST(request: Request) {
  let user;
  try {
    user = await getAuthenticatedUser(request);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const existing = await getPlatformOrgByUserId(user.id);
    if (existing) {
      return NextResponse.json(
        {
          enabled: true,
          organization: {
            id: existing.id,
            name: existing.name,
            slug: existing.slug,
            plan: existing.plan,
            enabled_at: existing.enabledAt,
          },
        },
        { status: 200 }
      );
    }

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // empty body is fine
    }

    const input = enableSchema.parse(body);
    const name = input.name ?? `${user.name}'s organization`;
    const slug = input.slug ?? (generateSlug(name) || user.username);

    const org = await enablePlatformOrg({
      userId: user.id,
      name,
      slug,
    });

    const { token, plaintext } = await createAccountToken({
      platformOrgId: org.id,
      createdByUserId: user.id,
      name: "Default",
    });

    return NextResponse.json(
      {
        enabled: true,
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          enabled_at: org.enabledAt,
        },
        default_key: {
          id: token.id,
          name: token.name,
          token_prefix: token.tokenPrefix,
          secret: plaintext,
          scopes: token.scopes,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("enable platform failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
