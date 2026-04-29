# Neo

The behavioral memory layer for AI agents. Neo captures how your team builds — patterns, conventions, architecture, decisions — and makes that knowledge available to every AI agent via MCP.

**By [Nura Labs](https://nura.sh)**

## Stack

- **App**: Next.js 16, React 19, TypeScript
- **Database**: PostgreSQL + pgvector (Cloud SQL)
- **Search**: Hybrid — tsvector (text) + pgvector (semantic) via Reciprocal Rank Fusion
- **Embeddings**: Vertex AI text-embedding-005 (768d)
- **Auth**: Firebase Auth (email + GitHub OAuth)
- **MCP**: Model Context Protocol server for AI agents
- **Dream Cycle**: Automated graph maintenance via Gemini Flash + Pro
- **Deploy**: Google Cloud Run + Cloud Build

## Features

- **Knowledge graph** with 18 node types and 11 relationship types
- **Typed wikilinks** — `[[Node Title|relationship]]` auto-generates edges
- **Hybrid search** — text + semantic, merged with RRF
- **Dream Cycle** — cron job that audits edges, discovers connections, resolves suggestions
- **Slug-based linking** — no UUIDs needed, agents create edges by title
- **User isolation** — all queries scoped per user, zero cross-user data leakage

## Development

```bash
npm install
npm run dev
```

## Database

```bash
npm run db:generate   # Generate migration
npm run db:migrate    # Apply migrations
npm run db:push       # Push schema directly
```

## License

Proprietary — Nura Labs
