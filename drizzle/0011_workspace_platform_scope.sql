-- Backfill platform_org_id on the oldest owned workspace for users who already
-- enabled platform globally (pre workspace-scoped fix). Only one workspace per
-- user is linked so platform mode does not appear on every workspace.
UPDATE "workspaces" w
SET "platform_org_id" = po."id"
FROM "platform_orgs" po
WHERE po."user_id" = w."created_by_user_id"
  AND w."platform_org_id" IS NULL
  AND w."id" = (
    SELECT ws."id"
    FROM "workspaces" ws
    INNER JOIN "memberships" m ON m."workspace_id" = ws."id"
    WHERE m."user_id" = po."user_id"
      AND m."role" = 'owner'
    ORDER BY ws."created_at" ASC
    LIMIT 1
  );
