# postbuzz

Official TypeScript SDK for the [post.buzz](https://post.buzz) REST API — the programmatic layer under `postbuzz-cli` and `postbuzz-mcp`. Post, schedule, and analyze across 16+ social platforms (X, Instagram, TikTok, LinkedIn, YouTube, Facebook, Pinterest, Reddit, Threads, Bluesky, Mastodon, Discord, Slack, Telegram, Google Business Profile, and more).

- **Zero runtime dependencies** — plain `fetch`, Node 20+ / Bun / Deno / edge runtimes.
- **One method per REST route** — the method list *is* the [OpenAPI spec](https://post.buzz/api/openapi.json); response types mirror the API's response schemas exactly.
- **Typed errors** — every non-2xx response maps to a `PostBuzzError` with `status`, `code`, `message`, and `details`.

## Installation

```bash
npm install postbuzz
```

## Quick start

```ts
import { PostBuzz } from "postbuzz";

const pb = new PostBuzz({ apiKey: process.env.POSTBUZZ_API_KEY! });

// Verify setup first (mirrors the CLI `doctor` / MCP `check_setup`)
const setup = await pb.organization.checkSetup();
if (!setup.ok) throw new Error(JSON.stringify(setup.checks));

const accounts = await pb.accounts.list();

const post = await pb.posts.create({
  caption: "Hello from the SDK 🐝",
  accountIds: [accounts[0]!.id],
}); // → { id, status: "draft" }

await pb.posts.schedule({
  caption: "Scheduled tomorrow",
  accountIds: [accounts[0]!.id],
  scheduledAt: "2026-10-01T09:00:00Z",
});

await pb.posts.update(post.id, { caption: "Edited caption" });
console.log(await pb.posts.list({ status: "draft", q: "Hello" }));
```

## Authentication

Create an API key in post.buzz under **Settings → API Keys** (`sx_live_…`). Pass it via `apiKey`; optionally override `baseUrl` (default `https://post.buzz/api`) for staging or self-hosting. Every request sends `Authorization: Bearer <key>`.

## Resources & methods

| Resource | Methods (REST route) |
|---|---|
| `posts` | `list` (GET /v1/posts — limit/offset/status/q), `create` (POST), `schedule` (POST + scheduledAt), `get`, `update` (PATCH), `delete`, `retry`, `reschedule`, `analytics`, `refreshAnalytics` |
| `accounts` | `list`, `get`, `connectUrl` (OAuth URL), `refresh` (token), `disconnect` (cascade), `analytics`, `refreshAnalytics`, `tools`, `runTool` (Reddit flairs, Pinterest boards) |
| `media` | `createFromUrl` (URL ingest), `uploadFile` (multipart local file), `list`, `get`, `delete` |
| `comments` | `create` (now or scheduled), `list`, `get`, `update`, `delete`, `retry` (publish now) |
| `inbox` | `list` (comments/mentions/DMs), `reply`, `editReply` |
| `analytics` | `summary`, `bestTimes` |
| `teams` | `list`, `get`, `create`, `update`, `delete`, `addAccount`, `removeAccount` |
| `platforms` | `list`, `get` (per-platform field schemas) |
| `organization` | `get`, `usage`, `checkSetup` |
| `imports` | `createPostCsv`, `listPostCsv`, `getPostCsv`, `listPostCsvRows`, `retryPostCsv` |
| `clips` | `create` (long video → short clips, async), `list`, `get`, `usage` |

### File uploads

```ts
import { openAsBlob } from "node:fs";

const media = await pb.media.uploadFile({
  file: await openAsBlob("./pic.png", { type: "image/png" }),
  fileName: "pic.png",
}); // → media row; reference media.id in posts.create({ mediaIds: [...] })
```

### CSV bulk import

```ts
const job = await pb.imports.createPostCsv({
  csv: "caption,platforms\nHello,x\nHi instagram,instagram\n",
}); // inline result or { jobId, status: "pending" }
const rows = await pb.imports.listPostCsvRows(job.jobId);
```

## Timeouts & retries

Each request times out after 60 s (`timeoutMs`). Rate-limited responses (429)
are retried up to `maxRetries` times (default 2), honoring `Retry-After`;
transient 5xx and network errors are retried only for idempotent methods
(GET/DELETE), so a POST is never sent twice.

```ts
const pb = new PostBuzz({ apiKey, timeoutMs: 30_000, maxRetries: 4 });
```

## Errors

```ts
import { PostBuzz, PostBuzzError } from "postbuzz";

try {
  await pb.posts.get("missing");
} catch (err) {
  if (err instanceof PostBuzzError) {
    err.status;  // 404
    err.code;    // "not_found" (API code), "HTTP_<status>", "TIMEOUT" or "UNREACHABLE"
    err.message; // "Post not found"
    err.details; // structured context when the API sent one
  }
}
```

Error envelope: `{ error: { code, message, details? } }` — the same shape the CLI prints and the MCP returns with `isError: true`.

## Development

```bash
bun install
bun run typecheck
bun run test      # vitest: route mapping, error contract, retries
bun run build     # tsup → dist/ (ESM + CJS + d.ts)
```

`postbuzz-cli` and `postbuzz-mcp` depend on the published package from npm.

## License

MIT
