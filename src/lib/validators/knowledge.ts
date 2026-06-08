import { z } from "zod";

export const knowledgeNodeTypes = [
  // Knowledge types — how things work
  "pattern",       // Recurring solution (e.g. "Repository Pattern")
  "convention",    // Team standard (e.g. "API naming conventions")
  "architecture",  // System design (e.g. "Event-driven architecture")
  "decision",      // ADR / why we chose X over Y
  "concept",       // Abstract idea or mental model
  "workflow",      // Step-by-step process (e.g. "Deploy to production")
  "snippet",       // Reusable code example

  // Structure types — what things are
  "module",        // Code module or package
  "api",           // API endpoint or contract
  "service",       // External service or microservice
  "config",        // Configuration pattern or env setup

  // Entity types — who/what is involved
  "person",        // Team member, stakeholder, contact
  "project",       // Active project or initiative
  "team",          // Team or org unit
  "tool",          // Technology, library, framework

  // Reference types — external knowledge
  "reference",     // Article, doc, external link
  "research",      // Investigation, analysis, comparison
  "note",          // Freeform note, anything else
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
