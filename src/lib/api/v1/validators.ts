import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export const createTenantSchema = z.object({
  external_id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createKeySchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.enum(["read", "write", "admin"])).optional(),
});

export const contextSearchSchema = z.object({
  query: z.string().min(1),
  top_k: z.number().int().min(1).max(100).optional(),
  mode: z.enum(["hybrid", "semantic", "text"]).optional().default("hybrid"),
  type: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
