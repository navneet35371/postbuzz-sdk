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

### File uploads

```ts
import { readFileSync } from "node:fs";

const bytes = readFileSync("./pic.png");
const media = await pb.media.uploadFile({
  file: new File([bytes], "pic.png", { type: "image/png" }),
}); // → media row; reference media.id in posts.create({ mediaIds: [...] })
```

### CSV bulk import

```ts
const job = await pb.imports.createPostCsv({
  csv: "caption,platforms\nHello,x\nHi instagram,instagram\n",
}); // inline result or { jobId, status: "pending" }
const rows = await pb.imports.listPostCsvRows(job.jobId);
```

## Errors

```ts
import { PostBuzz, PostBuzzError } from "postbuzz";

try {
  await pb.posts.get("missing");
} catch (err) {
  if (err instanceof PostBuzzError) {
    err.status;  // 404
    err.code;    // "not_found" (API code) or "HTTP_<status>" / "UNREACHABLE"
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
bun test          # vitest: 16 route-mapping + error-contract tests against a stub server
bun run build     # tsup → dist/ (ESM + d.ts)
```

The sibling repos `postbuzz-cli` and `postbuzz-mcp` consume this package via `file:../postbuzz-sdk` in dev and inline it at build time.

## License

MIT
