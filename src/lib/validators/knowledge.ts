import { z } from "zod";

export const knowledgeNodeTypes = [
  "pattern",
  "convention",
  "module",
  "architecture",
  "decision",
  "concept",
  "note",
  "reference",
] as const;

export const edgeRelationships = [
  "uses",
  "follows",
  "contains",
  "depends_on",
  "related_to",
  "extends",
  "contradicts",
  "alternative_to",
  "same_concept",
  "evolved_from",
  "implements",
] as const;

export const createNodeSchema = z.object({
  type: z.enum(knowledgeNodeTypes),
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  source: z.string().optional(),
  sourceMeta: z.record(z.string(), z.unknown()).optional().default({}),
  relatedTo: z
    .array(
      z.object({
        id: z.string().uuid(),
        relationship: z.enum(edgeRelationships),
      })
    )
    .optional()
    .default([]),
});

export const updateNodeSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).optional(),
  type: z.enum(knowledgeNodeTypes).optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
  sourceMeta: z.record(z.string(), z.unknown()).optional(),
});

export const searchSchema = z.object({
  query: z.string().min(1),
  type: z.enum(knowledgeNodeTypes).optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateNodeInput = z.infer<typeof createNodeSchema>;
export type UpdateNodeInput = z.infer<typeof updateNodeSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
