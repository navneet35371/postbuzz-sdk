import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { PostBuzz, PostBuzzError } from "../src/index.js";

/**
 * Stub post.buzz REST server: records (method, path, auth) per request and
 * replies with a canned envelope. Tests assert the SDK maps methods → routes
 * correctly and decodes envelopes/errors faithfully.
 */
interface Recorded {
  method: string;
  path: string;
  auth?: string;
  contentType?: string;
  body?: string;
}

let server: Server;
let base = "";
const recorded: Recorded[] = [];
/** Next response the stub will send; tests queue one per request. */
const responses: Array<{ status: number; body: string }> = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      recorded.push({
        method: req.method ?? "",
        // Strip the /api mount prefix — the SDK composes baseUrl + "/v1/...".
        path: (req.url ?? "").replace(/^\/api/, ""),
        auth: req.headers.authorization,
        contentType: req.headers["content-type"],
        body: body.length > 0 ? body : undefined,
      });
      const next = responses.shift() ?? { status: 200, body: "{}" };
      res.statusCode = next.status;
      res.setHeader("content-type", "application/json");
      res.end(next.body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  base = `http://127.0.0.1:${addr.port}/api`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function client() {
  return new PostBuzz({ apiKey: "sx_live_test", baseUrl: base });
}

/** Queue a success envelope and reset the recorded-request log. */
function ok(data: unknown, extra: Record<string, unknown> = {}) {
  responses.push({ status: 200, body: JSON.stringify({ data, ...extra }) });
  recorded.length = 0;
}

function fail(status: number, body: unknown) {
  responses.push({ status, body: JSON.stringify(body) });
  recorded.length = 0;
}

/** Await `p` and return the PostBuzzError it rejects with (fail the test on
 *  success or a foreign error type). */
async function expectError(p: Promise<unknown>): Promise<PostBuzzError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof PostBuzzError) return e;
    throw e;
  }
  throw new Error("expected the call to reject with PostBuzzError");
}

function last(): Recorded {
  const r = recorded[recorded.length - 1];
  if (!r) throw new Error("no request recorded");
  return r;
}

// ---------------------------------------------------------------------------

describe("client construction", () => {
  it("throws MISSING_API_KEY without a key", () => {
    let err: unknown;
    try {
      new PostBuzz({ apiKey: "" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PostBuzzError);
    expect((err as PostBuzzError).code).toBe("MISSING_API_KEY");
  });
});

describe("route mapping — one SDK method per REST route", () => {
  // Created inside beforeAll: the describe callback itself runs before the
  // server has bound its port, so baseUrl must not be captured early.
  let pb: PostBuzz;
  beforeAll(() => {
    pb = client();
  });

  async function expectRoute(
    label: string,
    invoke: () => Promise<unknown>,
    method: string,
    path: string,
  ) {
    ok(null);
    await invoke();
    const r = last();
    expect({ method: r.method, path: r.path }, label).toEqual({
      method,
      path,
    });
    expect(r.auth, `${label} auth`).toBe("Bearer sx_live_test");
  }

  it("posts resource", async () => {
    await expectRoute("posts.list", () => pb.posts.list(), "GET", "/v1/posts");
    await expectRoute(
      "posts.create",
      () => pb.posts.create({ accountIds: ["a1"], caption: "hi" }),
      "POST",
      "/v1/posts",
    );
    await expectRoute("posts.get", () => pb.posts.get("p1"), "GET", "/v1/posts/p1");
    await expectRoute(
      "posts.update",
      () => pb.posts.update("p1", { caption: "x" }),
      "PATCH",
      "/v1/posts/p1",
    );
    await expectRoute(
      "posts.delete",
      () => pb.posts.delete("p1"),
      "DELETE",
      "/v1/posts/p1",
    );
    await expectRoute(
      "posts.retry",
      () => pb.posts.retry("p1"),
      "POST",
      "/v1/posts/p1/retry",
    );
    await expectRoute(
      "posts.reschedule",
      () => pb.posts.reschedule("p1", "2026-10-01T00:00:00Z"),
      "POST",
      "/v1/posts/p1/reschedule",
    );
    await expectRoute(
      "posts.analytics",
      () => pb.posts.analytics("p1"),
      "GET",
      "/v1/posts/p1/analytics",
    );
    await expectRoute(
      "posts.refreshAnalytics",
      () => pb.posts.refreshAnalytics("p1"),
      "POST",
      "/v1/posts/p1/analytics/refresh",
    );
  });

  it("accounts resource", async () => {
    await expectRoute(
      "accounts.list",
      () => pb.accounts.list(),
      "GET",
      "/v1/accounts",
    );
    await expectRoute(
      "accounts.get",
      () => pb.accounts.get("a1"),
      "GET",
      "/v1/accounts/a1",
    );
    await expectRoute(
      "accounts.connectUrl",
      () => pb.accounts.connectUrl("x"),
      "GET",
      "/v1/accounts/connect-url?platform=x&client=web",
    );
    await expectRoute(
      "accounts.refresh",
      () => pb.accounts.refresh("a1"),
      "POST",
      "/v1/accounts/a1/refresh",
    );
    await expectRoute(
      "accounts.disconnect",
      () => pb.accounts.disconnect("a1"),
      "DELETE",
      "/v1/accounts/a1",
    );
    await expectRoute(
      "accounts.analytics",
      () => pb.accounts.analytics("a1"),
      "GET",
      "/v1/accounts/a1/analytics",
    );
    await expectRoute(
      "accounts.refreshAnalytics",
      () => pb.accounts.refreshAnalytics("a1"),
      "POST",
      "/v1/accounts/a1/analytics/refresh",
    );
    await expectRoute(
      "accounts.tools",
      () => pb.accounts.tools("a1"),
      "GET",
      "/v1/accounts/a1/tools",
    );
    await expectRoute(
      "accounts.runTool",
      () => pb.accounts.runTool("a1", "reddit-flairs", { subreddit: "news" }),
      "POST",
      "/v1/accounts/a1/tools/reddit-flairs",
    );
  });

  it("media resource", async () => {
    await expectRoute(
      "media.createFromUrl",
      () => pb.media.createFromUrl({ url: "https://x/y.png" }),
      "POST",
      "/v1/media",
    );
    ok(null);
    await pb.media.uploadFile({
      file: new File([new Uint8Array([1, 2])], "pic.png", {
        type: "image/png",
      }),
    });
    const r = last();
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/v1/media/upload");
    expect(r.contentType).toContain("multipart/form-data");
    expect(r.body).toContain("pic.png");
    await expectRoute(
      "media.list",
      () => pb.media.list({ type: "image" }),
      "GET",
      "/v1/media?type=image",
    );
    await expectRoute("media.get", () => pb.media.get("m1"), "GET", "/v1/media/m1");
    await expectRoute(
      "media.delete",
      () => pb.media.delete("m1"),
      "DELETE",
      "/v1/media/m1",
    );
  });

  it("comments resource", async () => {
    await expectRoute(
      "comments.create",
      () =>
        pb.comments.create({
          postId: "p1",
          accountId: "a1",
          text: "hi",
        }),
      "POST",
      "/v1/comments",
    );
    await expectRoute(
      "comments.list",
      () => pb.comments.list({ postId: "p1" }),
      "GET",
      "/v1/comments?postId=p1",
    );
    await expectRoute(
      "comments.get",
      () => pb.comments.get("c1"),
      "GET",
      "/v1/comments/c1",
    );
    await expectRoute(
      "comments.update",
      () => pb.comments.update("c1", { text: "x" }),
      "PATCH",
      "/v1/comments/c1",
    );
    await expectRoute(
      "comments.delete",
      () => pb.comments.delete("c1"),
      "DELETE",
      "/v1/comments/c1",
    );
    await expectRoute(
      "comments.retry",
      () => pb.comments.retry("c1"),
      "POST",
      "/v1/comments/c1/retry",
    );
  });

  it("inbox resource", async () => {
    await expectRoute("inbox.list", () => pb.inbox.list(), "GET", "/v1/inbox");
    await expectRoute(
      "inbox.reply",
      () => pb.inbox.reply("i1", "hello"),
      "POST",
      "/v1/inbox/i1/reply",
    );
    await expectRoute(
      "inbox.editReply",
      () => pb.inbox.editReply("i1", "r1", "edited"),
      "PATCH",
      "/v1/inbox/i1/replies/r1",
    );
  });

  it("analytics + platforms + organization resources", async () => {
    await expectRoute(
      "analytics.summary",
      () => pb.analytics.summary({ windowDays: 7 }),
      "GET",
      "/v1/analytics/summary?windowDays=7",
    );
    await expectRoute(
      "analytics.bestTimes",
      () => pb.analytics.bestTimes(),
      "GET",
      "/v1/best-times",
    );
    await expectRoute(
      "platforms.list",
      () => pb.platforms.list(),
      "GET",
      "/v1/platforms",
    );
    await expectRoute(
      "platforms.get",
      () => pb.platforms.get("instagram"),
      "GET",
      "/v1/platforms/instagram",
    );
    await expectRoute(
      "organization.get",
      () => pb.organization.get(),
      "GET",
      "/v1/organization",
    );
    await expectRoute(
      "organization.usage",
      () => pb.organization.usage(),
      "GET",
      "/v1/usage",
    );
    await expectRoute(
      "organization.checkSetup",
      () => pb.organization.checkSetup(),
      "GET",
      "/v1/diagnostics/setup",
    );
  });

  it("teams resource", async () => {
    await expectRoute("teams.list", () => pb.teams.list(), "GET", "/v1/teams");
    await expectRoute(
      "teams.create",
      () => pb.teams.create({ name: "Growth" }),
      "POST",
      "/v1/teams",
    );
    await expectRoute("teams.get", () => pb.teams.get("t1"), "GET", "/v1/teams/t1");
    await expectRoute(
      "teams.update",
      () => pb.teams.update("t1", { name: "x" }),
      "PATCH",
      "/v1/teams/t1",
    );
    await expectRoute(
      "teams.delete",
      () => pb.teams.delete("t1"),
      "DELETE",
      "/v1/teams/t1",
    );
    await expectRoute(
      "teams.addAccount",
      () => pb.teams.addAccount("t1", "a1"),
      "POST",
      "/v1/teams/t1/accounts",
    );
    await expectRoute(
      "teams.removeAccount",
      () => pb.teams.removeAccount("t1", "a1"),
      "DELETE",
      "/v1/teams/t1/accounts/a1",
    );
  });

  it("imports resource", async () => {
    await expectRoute(
      "imports.createPostCsv",
      () => pb.imports.createPostCsv({ csv: "caption\nhi" }),
      "POST",
      "/v1/imports/posts/csv",
    );
    await expectRoute(
      "imports.listPostCsv",
      () => pb.imports.listPostCsv(),
      "GET",
      "/v1/imports/posts/csv",
    );
    await expectRoute(
      "imports.getPostCsv",
      () => pb.imports.getPostCsv("j1"),
      "GET",
      "/v1/imports/posts/csv/j1",
    );
    await expectRoute(
      "imports.listPostCsvRows",
      () => pb.imports.listPostCsvRows("j1"),
      "GET",
      "/v1/imports/posts/csv/j1/rows",
    );
    await expectRoute(
      "imports.retryPostCsv",
      () => pb.imports.retryPostCsv("j1"),
      "POST",
      "/v1/imports/posts/csv/j1/retry",
    );
  });
});

describe("payload handling", () => {
  it("sends the JSON body and decodes the data envelope", async () => {
    const post = { id: "p1", caption: "hello", status: "draft" };
    ok(post);
    const out = await client().posts.create({
      accountIds: ["a1"],
      caption: "hello",
    });
    expect(out).toEqual(post);
    const r = last();
    expect(r.contentType).toBe("application/json");
    expect(JSON.parse(r.body!)).toEqual({
      accountIds: ["a1"],
      caption: "hello",
    });
  });

  it("decodes bare (unwrapped) success bodies — POST /v1/posts shape", async () => {
    const bare = { id: "p2", status: "draft" };
    responses.push({ status: 201, body: JSON.stringify(bare) });
    const out = await client().posts.create({
      accountIds: ["a1"],
      caption: "hi",
    });
    expect(out).toEqual(bare);
  });
  it("returns list envelopes with pagination siblings", async () => {
    responses.push({
      status: 200,
      body: JSON.stringify({ data: [], limit: 10, offset: 0 }),
    });
    const out = await client().posts.list({ limit: 10 });
    expect(out).toEqual({ data: [], limit: 10, offset: 0 });
  });

  it("omits undefined query params", async () => {
    ok([]);
    await client().posts.list({ status: "draft" });
    expect(last().path).toBe("/v1/posts?status=draft");
  });
});

describe("error mapping", () => {
  it("maps the v1 error envelope to PostBuzzError", async () => {
    fail(404, {
      error: { code: "not_found", message: "Post not found", details: { id: "x" } },
    });
    const err = await expectError(client().posts.get("x"));
    expect(err).toBeInstanceOf(PostBuzzError);
    expect(err.status).toBe(404);
    expect(err.code).toBe("not_found");
    expect(err.message).toBe("Post not found");
    expect(err.details).toEqual({ id: "x" });
  });

  it("maps the legacy { error: string } shape", async () => {
    fail(400, { error: "Cannot delete published post" });
    const err = await expectError(client().posts.delete("p1"));
    expect(err).toBeInstanceOf(PostBuzzError);
    expect(err.status).toBe(400);
    expect(err.code).toBe("HTTP_400");
    expect(err.message).toBe("Cannot delete published post");
  });

  it("maps a non-JSON error body to HTTP_<status>", async () => {
    responses.push({ status: 502, body: "Bad gateway" });
    const err = await expectError(client().posts.list());
    expect(err.status).toBe(502);
    expect(err.code).toBe("HTTP_502");
    expect(err.message).toContain("Bad gateway");
  });

  it("maps connection failures to UNREACHABLE", async () => {
    const pb = new PostBuzz({
      apiKey: "sx_live_test",
      baseUrl: "http://127.0.0.1:1/api",
    });
    const err = await expectError(pb.posts.list());
    expect(err).toBeInstanceOf(PostBuzzError);
    expect(err.code).toBe("UNREACHABLE");
  });
});
