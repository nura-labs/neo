# Neo

**The context engine for individuals and teams.**

Neo is a workspace-based knowledge graph by [Nura Labs](https://nura.sh). It captures how you and your team build — patterns, conventions, architecture, decisions — and makes that context available to every AI agent, from one shared substrate.

- **Product site:** [nura.sh/neo](https://www.nura.sh/neo)
- **App & dashboard:** [neo.nura.sh](https://neo.nura.sh)
- **Platform API docs:** [nura.sh/neo/docs](https://nura.sh/neo/docs)

---

## The problem

Your context lives nowhere together.

Decisions, patterns, and notes scatter across chat threads, docs, and your own head. Every new session with Claude Code, Cursor, or Codex starts from zero. Personal work and team knowledge live in separate silos. Each AI tool wants its own config and memory — there is no portable layer that travels with you.

Neo fixes this with **workspaces**: solo or shared containers where humans and agents both contribute to the same graph, with attribution preserved.

---

## What Neo does

| Capability | Description |
|---|---|
| **Workspaces** | One workspace per project, team, or client. Switch between them like Slack workspaces — same product, same API, scales 1 to N. |
| **Knowledge graph** | Structured nodes (patterns, decisions, modules, …) connected by typed relationships. Browse in the dashboard or query programmatically. |
| **Hybrid search** | Full-text + semantic search merged with Reciprocal Rank Fusion (RRF). Agents find the right context before they code. |
| **Wikilinks** | Write `[[Node Title]]` or `[[Node Title\|relationship]]` in markdown — edges are created automatically. Slug-based linking, no UUIDs required. |
| **Dream Cycle** | Scheduled graph maintenance: audits edges, discovers missing connections, resolves suggestions. Runs weekly (Builder) or daily (Team+) on hosted plans. |
| **Multi-actor** | You, teammates, and AI tools all read and write the same workspace. Activity is logged with source attribution. |
| **Privacy by design** | Your data is never used for model training. Workspace isolation, encryption in transit and at rest, export and delete on demand. |

---

## How it works

```
  Sources                    Knowledge graph              Consumers
  ───────                    ───────────────              ─────────
  You & teammates    ──►    Patterns, decisions,    ──►  Claude Code
  AI agents (MCP)            conventions, modules         Cursor · Codex
  CLI · REST API             connected by edges           Windsurf · Copilot CLI
                             + hybrid search              Your own apps (API)
```

1. **Capture** — Agents index a codebase locally (source code never leaves your machine), then send structured summaries to Neo via MCP or CLI. Humans add notes and decisions in the dashboard.
2. **Connect** — Wikilinks and the Dream Cycle weave nodes into a living graph.
3. **Consume** — Before coding, agents search Neo for project-specific patterns and decisions. One MCP connection serves every tool.

---

## Integrations

Neo is consumable three ways — use whichever fits your flow.

### MCP (Model Context Protocol)

Connect once; every supported editor reads and writes the same workspace.

```bash
# Claude Code
claude mcp add --transport http neo https://neo.nura.sh/api/mcp

# Cursor — add to MCP settings
# { "neo": { "url": "https://neo.nura.sh/api/mcp" } }
```

On first use, your browser opens to authenticate. MCP tools include:

| Tool | Purpose |
|---|---|
| `whoami` | Confirm active workspace |
| `get_overview` | Graph stats, type/source breakdown, recent nodes |
| `search` | Hybrid semantic + text search |
| `get_node` / `get_related` | Fetch a node by slug and its neighbors |
| `how_to` | Guided lookup for common tasks |
| `add_knowledge` | Create a node (supports wikilinks) |
| `update_knowledge` | Patch title, content, type, tags |
| `link_knowledge` | Create typed edges between existing nodes |
| `add_url` | Ingest a URL as reference content |

Works with **Claude Code**, **Cursor**, **Codex**, **Windsurf**, and **Copilot CLI**.

### CLI

Terminal-native interface for humans and agent pipelines.

```bash
npm install -g @nuralabs/neo

neo auth login          # browser device flow
neo workspace use acme  # switch workspace
neo search "auth pattern" --json
neo add --type pattern --title "Auth flow" --content "..."
neo mcp install all     # auto-configure detected agents
```

Repository: [nura-labs/neo-cli](https://github.com/nura-labs/neo-cli)

### REST API

Embed Neo's context layer in your own product — multi-tenant workspaces, search, and graph operations.

- **Base URL:** `https://neo.nura.sh/v1`
- **OpenAPI:** [neo.nura.sh/v1/openapi.json](https://neo.nura.sh/v1/openapi.json)
- **Platform dashboard:** [neo.nura.sh/platform](https://neo.nura.sh/platform)

Account-level API keys (`sk-neo-acct-…`) with `read`, `write`, and `admin` scopes. Context routes require `X-Neo-Workspace` and `X-Neo-Tenant-Id` headers for tenant isolation.

See the [Platform API docs](https://nura.sh/neo/docs) for the full endpoint reference.

### Skills

Pre-built agent skills for common Neo workflows:

```bash
npx skills add nura-labs/neo-skills
```

| Skill | Purpose |
|---|---|
| `neo` | Search before coding, follow existing patterns |
| `neo-index` | Index a codebase into the knowledge graph |
| `neo-wikilinks` | Write content with `[[wikilinks]]` that auto-create connections |

Repository: [nura-labs/neo-skills](https://github.com/nura-labs/neo-skills)

---

## Knowledge model

### Node types (18)

| Category | Types |
|---|---|
| **Knowledge** — how things work | `pattern`, `convention`, `architecture`, `decision`, `concept`, `workflow`, `snippet` |
| **Structure** — what things are | `module`, `api`, `service`, `config` |
| **Entity** — who/what is involved | `person`, `project`, `team`, `tool` |
| **Reference** — external knowledge | `reference`, `research`, `note` |

### Edge relationships (11)

`uses` · `follows` · `contains` · `depends_on` · `related_to` · `extends` · `contradicts` · `alternative_to` · `same_concept` · `evolved_from` · `implements`

---

## This repository

The Neo web application: dashboard, MCP server, workspace management, knowledge graph UI, and Dream Cycle worker.

### Stack

- **App:** Next.js 16, React 19, TypeScript
- **Database:** PostgreSQL + pgvector (Cloud SQL)
- **Search:** Hybrid — tsvector (text) + pgvector (semantic) via Reciprocal Rank Fusion
- **Embeddings:** Vertex AI text-embedding-005 (768d)
- **Auth:** Firebase Auth (email + GitHub OAuth)
- **MCP:** Model Context Protocol server for AI agents
- **Dream Cycle:** Automated graph maintenance via Gemini Flash + Pro
- **Deploy:** Google Cloud Run + Cloud Build

### Development

Prerequisites: Node.js 20+, PostgreSQL with pgvector, Firebase project, Vertex AI access for embeddings.

```bash
cp .env.example .env   # fill in DATABASE_URL, Firebase, etc.
npm install
npm run dev            # http://localhost:3000
```

For local embeddings, set a Google access token:

```bash
export GOOGLE_ACCESS_TOKEN=$(gcloud auth print-access-token)
```

### Database

```bash
npm run db:generate   # Generate migration
npm run db:migrate    # Apply migrations
npm run db:push       # Push schema directly (dev only)
npm run db:studio     # Drizzle Studio
```

### Project structure

```
src/
├── app/
│   ├── (dashboard)/     # Knowledge graph UI, settings, activity
│   └── api/               # REST routes, MCP transport, CLI device auth
├── lib/
│   ├── db/                # Drizzle schema, queries
│   ├── knowledge/         # Embeddings, wikilinks, Dream Cycle
│   └── mcp/               # MCP tool definitions
└── components/            # Dashboard, graph visualization, workspace UI
```

---

## Related projects

| Repo | Description |
|---|---|
| [neo-cli](https://github.com/nura-labs/neo-cli) | Terminal interface (`@nuralabs/neo`) |
| [neo-skills](https://github.com/nura-labs/neo-skills) | Agent skills for indexing and querying |

---

## License

Proprietary — [Nura Labs](https://nura.sh)
