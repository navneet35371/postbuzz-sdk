/**
 * The post.buzz API client. One class, resource namespaces, one method per
 * REST v1 route — the method list is the route list:
 *
 *   posts        list/create/get/update/delete/retry/reschedule,
 *                analytics, refreshAnalytics
 *   accounts     list/get/connectUrl/refresh/disconnect, analytics,
 *                refreshAnalytics, tools, runTool
 *   media        createFromUrl/uploadFile/list/get/delete
 *   comments     create/list/get/update/delete/retry
 *   inbox        list/reply/editReply
 *   analytics    summary/bestTimes
 *   teams        list/create/get/update/delete, addAccount/removeAccount
 *   platforms    list/get
 *   organization get, usage, checkSetup (diagnostics)
 *   imports      createPostCsv/listPostCsv/getPostCsv/listPostCsvRows/
 *                retryPostCsv
 */

import { createRequester, DEFAULT_BASE_URL, type Requester } from "./http.js";
import type {
  AccountAnalytics,
  AccountListItem,
  AccountProfile,
  AccountToolName,
  AccountToolResult,
  BackfillResponse,
  BestTimes,
  CreateCommentInput,
  CreateMediaFromUrlInput,
  CreatePostInput,
  CreatePostResponse,
  CreateTeamInput,
  CreateCsvImportInput,
  CsvImportCreateResponse,
  CsvImportSummary,
  Insight,
  ListCsvImportRowsOptions,
  ListCsvImportsOptions,
  ListInboxOptions,
  ListMediaOptions,
  ListPostsOptions,
  ListPostsResponse,
  Media,
  MediaListItem,
  Organization,
  PlatformReferenceEntry,
  Post,
  PostDetail,
  RetryPostResponse,
  ScheduledComment,
  Success,
  Team,
  UpdateCommentInput,
  UpdatePostInput,
  UpdateTeamInput,
  Usage,
  DiagnosticsSetup,
  InboxItem,
} from "./types.js";

export interface PostBuzzOptions {
  /** API key from post.buzz → Settings → API Keys (`sx_live_...`). */
  apiKey: string;
  /** API base URL. Defaults to production (`https://post.buzz/api`). */
  baseUrl?: string;
  /** Fetch implementation — injectable for tests. */
  fetch?: typeof globalThis.fetch;
}

export class PostBuzz {
  readonly posts: PostsResource;
  readonly accounts: AccountsResource;
  readonly media: MediaResource;
  readonly comments: CommentsResource;
  readonly inbox: InboxResource;
  readonly analytics: AnalyticsResource;
  readonly teams: TeamsResource;
  readonly platforms: PlatformsResource;
  readonly organization: OrganizationResource;
  readonly imports: ImportsResource;
  readonly baseUrl: string;

  constructor(opts: PostBuzzOptions) {
    const r: Requester = createRequester(opts);
    this.baseUrl = r.baseUrl;
    this.posts = new PostsResource(r);
    this.accounts = new AccountsResource(r);
    this.media = new MediaResource(r);
    this.comments = new CommentsResource(r);
    this.inbox = new InboxResource(r);
    this.analytics = new AnalyticsResource(r);
    this.teams = new TeamsResource(r);
    this.platforms = new PlatformsResource(r);
    this.organization = new OrganizationResource(r);
    this.imports = new ImportsResource(r);
  }
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export class PostsResource {
  constructor(private readonly r: Requester) {}

  /** GET /v1/posts */
  list(opts: ListPostsOptions = {}): Promise<ListPostsResponse> {
    return this.r.requestEnvelope<ListPostsResponse>("GET", "/v1/posts", {
      query: opts as Record<string, unknown>,
    });
  }

  /** POST /v1/posts — omit scheduledAt to save as a draft. */
  create(input: CreatePostInput): Promise<CreatePostResponse> {
    return this.r.request<CreatePostResponse>("POST", "/v1/posts", {
      body: input,
    });
  }

  /** Convenience: create with an ISO scheduledAt (schedules the post). */
  schedule(input: CreatePostInput & { scheduledAt: string }): Promise<CreatePostResponse> {
    return this.create(input);
  }

  /** GET /v1/posts/:id — post + accounts (permalinks) + media. */
  get(id: string): Promise<PostDetail> {
    return this.r.request<PostDetail>("GET", `/v1/posts/${id}`);
  }

  /** PATCH /v1/posts/:id */
  update(id: string, input: UpdatePostInput): Promise<Post> {
    return this.r.request<Post>("PATCH", `/v1/posts/${id}`, { body: input });
  }

  /** DELETE /v1/posts/:id — published posts cannot be deleted. */
  delete(id: string): Promise<Success> {
    return this.r.request<Success>("DELETE", `/v1/posts/${id}`);
  }

  /** POST /v1/posts/:id/retry — re-queue a post's failed schedules. */
  retry(id: string): Promise<RetryPostResponse> {
    return this.r.request<RetryPostResponse>("POST", `/v1/posts/${id}/retry`);
  }

  /** POST /v1/posts/:id/reschedule — move a post's target time. */
  reschedule(id: string, scheduledAt: string): Promise<Post> {
    return this.r.request<Post>("POST", `/v1/posts/${id}/reschedule`, {
      body: { scheduledAt },
    });
  }

  /** GET /v1/posts/:id/analytics */
  analytics(id: string): Promise<Insight> {
    return this.r.request<Insight>("GET", `/v1/posts/${id}/analytics`);
  }

  /** POST /v1/posts/:id/analytics/refresh — enqueue an insight backfill. */
  refreshAnalytics(id: string, opts: { windowDays?: number; limit?: number } = {}): Promise<BackfillResponse> {
    return this.r.request<BackfillResponse>(
      "POST",
      `/v1/posts/${id}/analytics/refresh`,
      { body: opts },
    );
  }
}

export class AccountsResource {
  constructor(private readonly r: Requester) {}

  /** GET /v1/accounts */
  list(): Promise<AccountListItem[]> {
    return this.r.request<AccountListItem[]>("GET", "/v1/accounts");
  }

  /** GET /v1/accounts/:id */
  get(id: string): Promise<AccountProfile> {
    return this.r.request<AccountProfile>("GET", `/v1/accounts/${id}`);
  }

  /** GET /v1/accounts/connect-url — the OAuth authorize URL for a platform. */
  connectUrl(platform: string, opts: { client?: "web" | "mobile" } = {}): Promise<{ url: string }> {
    return this.r.request<{ url: string }>("GET", "/v1/accounts/connect-url", {
      query: { platform, client: opts.client ?? "web" },
    });
  }

  /** POST /v1/accounts/:id/refresh — refresh the OAuth access token. */
  refresh(id: string): Promise<AccountProfile> {
    return this.r.request<AccountProfile>("POST", `/v1/accounts/${id}/refresh`);
  }

  /** DELETE /v1/accounts/:id — disconnect (cascades pending schedules,
   *  comment automation, inbox, goals, agents; keeps published history). */
  disconnect(id: string): Promise<Success> {
    return this.r.request<Success>("DELETE", `/v1/accounts/${id}`);
  }

  /** GET /v1/accounts/:id/analytics */
  analytics(id: string, opts: { windowDays?: number } = {}): Promise<AccountAnalytics> {
    return this.r.request<AccountAnalytics>(
      "GET",
      `/v1/accounts/${id}/analytics`,
      { query: opts as Record<string, unknown> },
    );
  }

  /** POST /v1/accounts/:id/analytics/refresh */
  refreshAnalytics(id: string, opts: { windowDays?: number; limit?: number } = {}): Promise<BackfillResponse> {
    return this.r.request<BackfillResponse>(
      "POST",
      `/v1/accounts/${id}/analytics/refresh`,
      { body: opts },
    );
  }

  /** GET /v1/accounts/:id/tools — available per-platform lookups. */
  tools(id: string): Promise<{
    tools: string[];
    inputHints: Record<string, Record<string, string>>;
  }> {
    return this.r.request("GET", `/v1/accounts/${id}/tools`);
  }

  /** POST /v1/accounts/:id/tools/:tool — run one (e.g. reddit-flairs with
   *  `{ subreddit }`, pinterest-boards with `{}`). */
  runTool(
    id: string,
    tool: AccountToolName,
    input: Record<string, unknown> = {},
  ): Promise<AccountToolResult> {
    return this.r.request<AccountToolResult>(
      "POST",
      `/v1/accounts/${id}/tools/${tool}`,
      { body: input },
    );
  }
}

export class MediaResource {
  constructor(private readonly r: Requester) {}

  /** POST /v1/media — ingest from a public URL. */
  createFromUrl(input: CreateMediaFromUrlInput): Promise<Media> {
    return this.r.request<Media>("POST", "/v1/media", { body: input });
  }

  /** POST /v1/media/upload — multipart local-file upload.
   *  `input` may be a path string (Node: read from disk) or a File/Blob. */
  async uploadFile(input: {
    file: Blob;
    fileName?: string;
    mediaType?: "image" | "video" | "document";
  }): Promise<Media> {
    const form = new FormData();
    const name =
      input.fileName ??
      (input.file instanceof File ? input.file.name : "upload");
    form.append("file", input.file, name);
    if (input.mediaType) form.append("mediaType", input.mediaType);
    return this.r.request<Media>("POST", "/v1/media/upload", { body: form });
  }

  /** GET /v1/media */
  list(opts: ListMediaOptions = {}): Promise<{ items: MediaListItem[]; total: number }> {
    return this.r.request<{ items: MediaListItem[]; total: number }>(
      "GET",
      "/v1/media",
      { query: opts as Record<string, unknown> },
    );
  }

  /** GET /v1/media/:id */
  get(id: string): Promise<Media> {
    return this.r.request<Media>("GET", `/v1/media/${id}`);
  }

  /** DELETE /v1/media/:id */
  delete(id: string): Promise<Success> {
    return this.r.request<Success>("DELETE", `/v1/media/${id}`);
  }
}

export class CommentsResource {
  constructor(private readonly r: Requester) {}

  /** POST /v1/comments — omit scheduledAt to publish immediately. */
  create(input: CreateCommentInput): Promise<ScheduledComment> {
    return this.r.request<ScheduledComment>("POST", "/v1/comments", {
      body: input,
    });
  }

  /** GET /v1/comments?postId=... */
  list(opts: { postId: string; status?: "pending" | "published" | "failed" }): Promise<ScheduledComment[]> {
    return this.r.request<ScheduledComment[]>("GET", "/v1/comments", {
      query: opts as Record<string, unknown>,
    });
  }

  /** GET /v1/comments/:id */
  get(id: string): Promise<ScheduledComment> {
    return this.r.request<ScheduledComment>("GET", `/v1/comments/${id}`);
  }

  /** PATCH /v1/comments/:id — edit a pending comment's text and/or time. */
  update(id: string, input: UpdateCommentInput): Promise<ScheduledComment> {
    return this.r.request<ScheduledComment>("PATCH", `/v1/comments/${id}`, {
      body: input,
    });
  }

  /** DELETE /v1/comments/:id — pending comments only. */
  delete(id: string): Promise<Success> {
    return this.r.request<Success>("DELETE", `/v1/comments/${id}`);
  }

  /** POST /v1/comments/:id/retry — publish a pending/failed comment now. */
  retry(id: string): Promise<ScheduledComment> {
    return this.r.request<ScheduledComment>("POST", `/v1/comments/${id}/retry`);
  }
}

export class InboxResource {
  constructor(private readonly r: Requester) {}

  /** GET /v1/inbox — incoming comments, mentions, and DMs. */
  list(opts: ListInboxOptions = {}): Promise<{ items: InboxItem[]; total: number }> {
    return this.r.request<{ items: InboxItem[]; total: number }>(
      "GET",
      "/v1/inbox",
      { query: opts as Record<string, unknown> },
    );
  }

  /** POST /v1/inbox/:itemId/reply */
  reply(itemId: string, message: string): Promise<Success> {
    return this.r.request<Success>("POST", `/v1/inbox/${itemId}/reply`, {
      body: { message },
    });
  }

  /** PATCH /v1/inbox/:itemId/replies/:replyId — edit a sent reply. */
  editReply(itemId: string, replyId: string, message: string): Promise<Success> {
    return this.r.request<Success>(
      "PATCH",
      `/v1/inbox/${itemId}/replies/${replyId}`,
      { body: { message } },
    );
  }
}

export class AnalyticsResource {
  constructor(private readonly r: Requester) {}

  /** GET /v1/analytics/summary — latest analytics row per accessible
   *  account within the window. */
  summary(opts: { windowDays?: number } = {}): Promise<Insight[]> {
    return this.r.request<Insight[]>("GET", "/v1/analytics/summary", {
      query: opts as Record<string, unknown>,
    });
  }

  /** GET /v1/best-times — recommended posting times. */
  bestTimes(opts: { accountId?: string } = {}): Promise<BestTimes> {
    return this.r.request<BestTimes>("GET", "/v1/best-times", {
      query: opts as Record<string, unknown>,
    });
  }
}

export class TeamsResource {
  constructor(private readonly r: Requester) {}

  /** GET /v1/teams */
  list(): Promise<Team[]> {
    return this.r.request<Team[]>("GET", "/v1/teams");
  }

  /** POST /v1/teams */
  create(input: CreateTeamInput): Promise<Team> {
    return this.r.request<Team>("POST", "/v1/teams", { body: input });
  }

  /** GET /v1/teams/:id */
  get(id: string): Promise<Team> {
    return this.r.request<Team>("GET", `/v1/teams/${id}`);
  }

  /** PATCH /v1/teams/:id */
  update(id: string, input: UpdateTeamInput): Promise<Success> {
    return this.r.request<Success>("PATCH", `/v1/teams/${id}`, { body: input });
  }

  /** DELETE /v1/teams/:id — refused while the team still owns accounts. */
  delete(id: string): Promise<Success> {
    return this.r.request<Success>("DELETE", `/v1/teams/${id}`);
  }

  /** POST /v1/teams/:id/accounts — assign an account to the team. */
  addAccount(id: string, accountId: string): Promise<Success> {
    return this.r.request<Success>("POST", `/v1/teams/${id}/accounts`, {
      body: { accountId },
    });
  }

  /** DELETE /v1/teams/:id/accounts/:accountId — reassign to the default team. */
  removeAccount(id: string, accountId: string): Promise<Success> {
    return this.r.request<Success>(
      "DELETE",
      `/v1/teams/${id}/accounts/${accountId}`,
    );
  }
}

export class PlatformsResource {
  constructor(private readonly r: Requester) {}

  /** GET /v1/platforms — per-platform capabilities + publish field schemas. */
  list(): Promise<Record<string, PlatformReferenceEntry>> {
    return this.r.request<Record<string, PlatformReferenceEntry>>(
      "GET",
      "/v1/platforms",
    );
  }

  /** GET /v1/platforms/:platform */
  get(platform: string): Promise<PlatformReferenceEntry> {
    return this.r.request<PlatformReferenceEntry>(
      "GET",
      `/v1/platforms/${platform}`,
    );
  }
}

export class OrganizationResource {
  constructor(private readonly r: Requester) {}

  /** GET /v1/organization — plan, limits, connected-account summary. */
  get(): Promise<Organization> {
    return this.r.request<Organization>("GET", "/v1/organization");
  }

  /** GET /v1/usage — monthly post usage + credit balance. */
  usage(): Promise<Usage> {
    return this.r.request<Usage>("GET", "/v1/usage");
  }

  /** GET /v1/diagnostics/setup — the setup self-check (api key, accounts,
   *  quota). The first call any automation should make. */
  checkSetup(): Promise<DiagnosticsSetup> {
    return this.r.request<DiagnosticsSetup>("GET", "/v1/diagnostics/setup");
  }
}

export class ImportsResource {
  constructor(private readonly r: Requester) {}

  /** POST /v1/imports/posts/csv — bulk-create posts from a CSV (URL or text).
   *  Runs inline when small, else enqueues a background job. */
  createPostCsv(input: CreateCsvImportInput): Promise<CsvImportCreateResponse> {
    return this.r.request<CsvImportCreateResponse>(
      "POST",
      "/v1/imports/posts/csv",
      { body: input },
    );
  }

  /** GET /v1/imports/posts/csv — the caller's CSV import jobs. */
  listPostCsv(opts: ListCsvImportsOptions = {}): Promise<{
    items: CsvImportSummary[];
    total: number;
  }> {
    return this.r.request<{ items: CsvImportSummary[]; total: number }>(
      "GET",
      "/v1/imports/posts/csv",
      { query: opts as Record<string, unknown> },
    );
  }

  /** GET /v1/imports/posts/csv/:id — job summary with counts. */
  getPostCsv(id: string): Promise<CsvImportSummary> {
    return this.r.request<CsvImportSummary>(
      "GET",
      `/v1/imports/posts/csv/${id}`,
    );
  }

  /** GET /v1/imports/posts/csv/:id/rows — per-row SUCCESS/FAILED results. */
  listPostCsvRows(
    id: string,
    opts: ListCsvImportRowsOptions = {},
  ): Promise<{
    rows: Array<{
      rowIndex: number;
      row: Record<string, unknown>;
      status: "SUCCESS" | "FAILED";
      postId?: string;
      error?: string;
    }>;
    total: number;
  }> {
    return this.r.request("GET", `/v1/imports/posts/csv/${id}/rows`, {
      query: opts as Record<string, unknown>,
    });
  }

  /** POST /v1/imports/posts/csv/:id/retry — re-run the failed rows. */
  retryPostCsv(id: string): Promise<{ jobId: string | null; retrying: number }> {
    return this.r.request<{ jobId: string | null; retrying: number }>(
      "POST",
      `/v1/imports/posts/csv/${id}/retry`,
    );
  }
}

export { DEFAULT_BASE_URL };
