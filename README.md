# @droplinkperformance/bitbucket-mcp-server

Provider-agnostic, AI-review-first [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for Bitbucket Cloud.

The primary value of this server is **AI-powered code review and pull request analysis**, not CRUD against the Bitbucket API. Every major dependency (SCM access, cache, token storage, rate limiting, LLM, events) is hidden behind a provider-agnostic interface so the same business logic can later target GitHub / GitLab / Azure DevOps and OpenAI / Anthropic / Gemini / Bedrock without changes to use-cases, agents, or domain contracts.

> Status: **Phase 1**. See [Roadmap](#roadmap).

## Features (Phase 1)

- Dual transports: **stdio** (Cursor / Claude Desktop) and **Streamable HTTP** (Fastify, for remote/production).
- **Auto-discovered tools** via a `ToolRegistry` — no manual registration.
- Explicit **`BitbucketContext`** (`workspace` + optional `repository`) on every tool — multi-workspace ready.
- Resilient `BitbucketClient`: auth injection, auto-pagination, retry/backoff, rate-limit handling, caching, secret masking.
- Two auth strategies: **OAuth 2.0** (Authorization Code, with rotating refresh-token persistence) and **Bearer token**.
- **AI code review** (`analyze_pull_request`) backed by a `CodeReviewAgent` that chunks large PRs and returns a standard `ReviewResult`.
- Pluggable **LLM provider** (OpenAI / Anthropic / Gemini / Bedrock), **cache** (memory / Redis), and **token store** (file / memory / Redis).

### Tools

| Tool | Description |
| --- | --- |
| `get_current_user` | Authenticated user. |
| `list_pull_requests` | List PRs (filter by state/query). |
| `get_pull_request` | Fetch a PR by id. |
| `create_pull_request` | Open a PR. |
| `get_pull_request_diff` | Raw unified diff. |
| `get_pull_request_files` | Changed files + line stats. |
| `get_pull_request_comments` | PR comments. |
| `comment_pull_request` | Add a (optionally inline) comment. |
| `analyze_pull_request` | AI review returning a standard `ReviewResult`. |

All tool inputs accept `workspace` (optional if `BITBUCKET_DEFAULT_WORKSPACE` is set) and, where applicable, `repository`.

## Architecture

```
src/
  index.ts            entry: chooses transport
  container.ts        composition root (the only place wiring concretes)
  mcp/                McpServer + ToolRegistry (auto-discovery) + transports
  tools/              thin MCP adapters (*.tool.ts) -> call exactly one use-case
  application/        use-cases (CQRS-ish: command|query) with Input/Output DTOs
  agents/             autonomous workflows implementing Agent<TInput,TOutput>
  domain/             provider-agnostic types, repository contracts, ReviewResult
  repositories/bitbucket/  Bitbucket implementations of the contracts
  clients/bitbucket/  resilient REST client
  auth/               AuthProvider (+ token/oauth) and TokenStore implementations
  cache/              CacheProvider (+ memory/redis)
  ratelimit/          RateLimitStrategy (+ bitbucket)
  llm/                LlmProvider (+ openai/anthropic/gemini/bedrock)
  events/             EventBus (+ in-memory)
  services/           reusable services (masking, chunking)
  telemetry/          OpenTelemetry bootstrap + metrics
  infrastructure/     config, logger, http, attachments
  shared/             errors, result envelope, http-status, BitbucketContext
```

Flow: `tool -> use-case -> (agent | repository contract) -> repositories/bitbucket -> BitbucketClient`. Agents may also use the `LlmProvider` and `EventBus`. Tools never contain business logic.

## Requirements

- Node.js 23+

## Install

Published as [`@droplinkperformance/bitbucket-mcp-server`](https://www.npmjs.com/package/@droplinkperformance/bitbucket-mcp-server).

```bash
npx -y @droplinkperformance/bitbucket-mcp-server
```

From source:

```bash
npm install
npm run build
```

## Release

Merges to `main` run [`.github/workflows/release.yml`](.github/workflows/release.yml): tests, build, then [semantic-release](https://semantic-release.gitbook.io/). Version and npm publish happen only when the merge includes [Conventional Commits](https://www.conventionalcommits.org/):

| Commit | Bump |
| --- | --- |
| `fix:` | patch |
| `feat:` | minor |
| `BREAKING CHANGE` / `feat!:` | major |

Other messages skip publish. The GitHub secret `NPM_TOKEN` (npm Automation token for the `droplinkperformance` org) is required.

After a successful npm release, the same workflow publishes metadata to the [MCP Registry](https://modelcontextprotocol.io/registry/quickstart) as `io.github.droplinkperformance/bitbucket-mcp-server` (OIDC, no extra secret). [github.com/mcp](https://github.com/mcp) syncs from that registry; if the server does not appear, email partnerships@github.com.

To stay on `0.x` for the first release, tag the current commit (`git tag v0.1.0 && git push origin v0.1.0`) before the first conventional merge; otherwise semantic-release starts at `1.0.0`.

## Configuration

Copy `.env.example` to `.env` and fill in values. Load it with Node's built-in flag:

```bash
node --env-file=.env dist/index.js
```

Key variables:

| Variable | Default | Notes |
| --- | --- | --- |
| `MCP_TRANSPORT` | `stdio` | `stdio` or `http`. |
| `HTTP_HOST` / `HTTP_PORT` | `0.0.0.0` / `3000` | HTTP transport bind. |
| `BITBUCKET_DEFAULT_WORKSPACE` | – | Fallback when a tool omits `workspace`. |
| `BITBUCKET_ACCESS_TOKEN` | – | API token (ATATT…), app password, or OAuth access token |
| `BITBUCKET_EMAIL` | – | **Required** with API tokens (ATATT…) — your Atlassian account email |
| `BITBUCKET_CLIENT_ID` / `BITBUCKET_CLIENT_SECRET` | – | Required for **OAuth** (when no access token). |
| `BITBUCKET_REFRESH_TOKEN` | – | Optional seed for headless OAuth. |
| `TOKEN_STORE` | `file` | `file` \| `memory` \| `redis`. |
| `CACHE_PROVIDER` | `memory` | `memory` \| `redis`. |
| `LLM_PROVIDER` | `openai` | `openai` \| `anthropic` \| `gemini` \| `bedrock`. |
| `MAX_FILES_PER_CHUNK` / `MAX_DIFF_LINES_PER_CHUNK` | `50` / `5000` | Large-PR chunking thresholds. |
| `OTEL_ENABLED` | `false` | No-op metrics unless enabled. |

### Authentication

**Bearer (OAuth access token):** set `BITBUCKET_ACCESS_TOKEN` only (non-ATATT tokens).

**API token (recommended, ATATT…):** set `BITBUCKET_ACCESS_TOKEN` **and** `BITBUCKET_EMAIL` (your Atlassian account email from Bitbucket → Personal settings → Email aliases). API tokens use HTTP Basic auth, not Bearer.

**App password (legacy, until June 2026):** set `BITBUCKET_ACCESS_TOKEN` and `BITBUCKET_USERNAME` (your Bitbucket username).

**OAuth 2.0 (Authorization Code):** set `BITBUCKET_CLIENT_ID` / `BITBUCKET_CLIENT_SECRET`. Tokens are persisted by the configured `TOKEN_STORE`; Bitbucket rotates refresh tokens, and the server persists the new one on every refresh. For headless boot, provide a previously obtained `BITBUCKET_REFRESH_TOKEN`.

Bitbucket OAuth endpoints used: authorize `https://bitbucket.org/site/oauth2/authorize`, token `https://bitbucket.org/site/oauth2/access_token`. The authorize URL can be built from `OAuthProvider.buildAuthorizeUrl()` and the returned `?code=` exchanged via `OAuthProvider.loginWithCode(code)`.

### LLM provider

Set `LLM_PROVIDER` and the matching key:

```env
LLM_PROVIDER=openai      # OPENAI_API_KEY
LLM_PROVIDER=anthropic   # ANTHROPIC_API_KEY
LLM_PROVIDER=gemini      # GEMINI_API_KEY
LLM_PROVIDER=bedrock     # AWS creds + BEDROCK_MODEL_ID (needs @aws-sdk/client-bedrock-runtime)
```

`ioredis` (Redis providers) and `@aws-sdk/client-bedrock-runtime` (Bedrock) are optional and loaded lazily — only needed when selected.

## Running

### stdio

```bash
MCP_TRANSPORT=stdio node --env-file=.env dist/index.js
```

### Streamable HTTP

```bash
MCP_TRANSPORT=http HTTP_PORT=3000 node --env-file=.env dist/index.js
# health:   GET  http://localhost:3000/health
# endpoint: POST http://localhost:3000/mcp
```

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

### Cursor

`~/.cursor/mcp.json` (or project `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "npx",
      "args": ["-y", "@droplinkperformance/bitbucket-mcp-server"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "BITBUCKET_ACCESS_TOKEN": "ATATT-your-api-token",
        "BITBUCKET_EMAIL": "you@company.com",
        "BITBUCKET_DEFAULT_WORKSPACE": "your-workspace",
        "LLM_PROVIDER": "openai",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "npx",
      "args": ["-y", "@droplinkperformance/bitbucket-mcp-server"],
      "env": {
        "BITBUCKET_ACCESS_TOKEN": "your-token",
        "BITBUCKET_DEFAULT_WORKSPACE": "your-workspace",
        "LLM_PROVIDER": "anthropic",
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

## Development

```bash
npm run dev          # tsx watch (stdio)
npm run typecheck
npm run lint
npm test
npm run test:coverage
```

## Roadmap

- **Phase 1 (this release):** auth, abstractions, `BitbucketClient`, tool auto-discovery, PR tools, `analyze_pull_request`.
- **Phase 2:** Pipelines + full-text paginated logs, `pipeline-investigator` agent, `auto_review_pull_request` (dry-run / publish inline comments).
- **Phase 3:** Remaining CRUD — repositories, commits, branches, tags, issues, workspaces, members, search.
- **Phase 4:** `analyze_dotnet_pull_request` (dotnet-review agent), advanced agents, automation workflows.
- **Phase 5:** Docker, Compose, Helm, production deploy guide.

## License

MIT
