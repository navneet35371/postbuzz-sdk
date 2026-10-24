/**
 * Types mirroring the post.buzz REST v1 OpenAPI response schemas
 * (apps/api/lib/openapi-schemas.ts is the source of truth — drift there is
 * drift here). All datetime fields are ISO-8601 strings as the API emits them.
 */

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** v1 error envelope: `{ error: { code, message, details? } }`. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface Post {
  id: string;
  userId: string;
  caption: string | null;
  firstComment: string | null;
  postType: string;
  status: string;
  scheduledAt: string | null;
  postedAt: string | null;
  delayMinutes: number | null;
  pollQuestion: string | null;
  pollOptions: string[] | null;
  pollDurationDays: number | null;
  threadParts?: Record<string, string[]> | null;
  platformPostId: string | null;
  crossPostGroupId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountProfile {
  id: string;
  platform: string;
  platformId: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  signature: string | null;
  minPostGapMinutes: number | null;
  followersCount: number | null;
  followersSyncedAt: string | null;
  tier: string | null;
  tokenExpiresAt: string | null;
  disconnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountListItem {
  id: string;
  platform: string;
  username: string | null;
  displayName: string | null;
}

export interface Media {
  id: string;
  userId: string;
  filePath: string;
  thumbnailPath: string | null;
  mediaType: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  fileSize: number | null;
  mimeType: string | null;
  aiDescription: string | null;
  aiDescriptionAt: string | null;
  transcript: string | null;
  createdAt: string;
}

export interface MediaListItem {
  id: string;
  filePath: string;
  thumbnailPath: string | null;
  mediaType: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  fileSize: number | null;
  aiDescription: string | null;
  createdAt: string;
}

export interface ScheduledComment {
  id: string;
  postId: string;
  accountId: string;
  userId: string;
  parentCommentId: string | null;
  text: string;
  scheduledAt: string;
  status: string;
  platformPostId: string | null;
  publishedAt: string | null;
  error: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface InboxItem {
  id: string;
  userId: string;
  accountId: string;
  sourceType: string;
  isMention: boolean;
  sourceId: string;
  platform: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
  authorPlatformId: string | null;
  textPreview: string | null;
  mediaCaption: string | null;
  mediaThumbnailUrl: string | null;
  permalink: string | null;
  parentPlatformPostId: string | null;
  platformCreatedAt: string | null;
  status: string;
  likedAt: string | null;
  moderationStatus: string | null;
  moderatedAt: string | null;
  syncedAt: string | null;
  createdAt: string;
}

export interface Insight {
  id: string;
  userId: string;
  accountId: string;
  postId: string | null;
  platformPostId: string | null;
  permalink: string | null;
  postType: string | null;
  captionTone: string | null;
  postedAt: string | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
  impressions: number | null;
  mediaUrl: string | null;
  caption: string | null;
  fetchedAt: string | null;
  createdAt: string;
}

export interface TeamMember {
  teamId: string;
  accountId: string;
  platform: string;
  username: string | null;
  displayName: string | null;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  members: TeamMember[];
}

export interface Success {
  success: true;
}

// ---------------------------------------------------------------------------
// Route payloads
// ---------------------------------------------------------------------------

export interface PostDetail extends Post {
  accounts: Array<{
    account: AccountProfile;
    captionOverride: string | null;
    fields: Record<string, string> | null;
    permalink: string | null;
  }>;
  media: Array<{
    media: Media;
    sortOrder: number;
  }>;
}

export interface ListPostsResponse {
  data: Post[];
  limit: number;
  offset: number;
}

export interface CreatePostResponse {
  id: string;
  status: string;
}

export interface RetryPostResponse {
  jobId: string;
  status: string;
  requeued: number;
  published?: number;
  failed?: number;
  retried?: number;
  errors?: string[];
}

export interface AccountAnalytics {
  bestTone: string | null;
  bestTimeBlock: string | null;
  bestPostType: string | null;
  topCaptionThemes: string[];
  totalPosts: number;
  avgEngagementRate: number | null;
  totalReach: number;
  totalLikes: number;
  totalComments: number;
  totalSaves: number;
}

export interface BestTimeRecommendation {
  day: string;
  hour: number;
  reason: string;
}

export interface BestTimes {
  hasEnoughData: boolean;
  recommendations: BestTimeRecommendation[];
  sampleCount?: number;
  fromCache?: boolean;
}

export interface AccountBackfillResult {
  accountId: string;
  platform: string;
  status: "success" | "skipped" | "failed";
  fetched: number;
  upserted: number;
  inserted?: number;
  updated?: number;
  pruned?: number;
  error?: string;
}

export interface BackfillProgress {
  totalAccounts: number;
  completedAccounts: number;
  accountResults: AccountBackfillResult[];
}

export interface BackfillResponse {
  jobId: string;
  status: string;
  progress?: BackfillProgress;
}

export interface CsvRowResult {
  rowIndex: number;
  row: Record<string, unknown>;
  status: "SUCCESS" | "FAILED";
  postId?: string;
  error?: string;
}

export interface CsvImportResult {
  total: number;
  succeeded: number;
  failed: number;
  rows: CsvRowResult[];
}

export interface CsvImportCreateResponse {
  jobId: string;
  status: string;
  result?: CsvImportResult;
}

export interface CsvImportSummary {
  id: string;
  status: string;
  total: number;
  succeeded: number;
  failed: number;
  errorMessage: string | null;
  createdAt?: string;
}

export interface PlatformField {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  notes?: string;
}

export interface PlatformReferenceEntry {
  capabilities: string[];
  fields: PlatformField[];
}

export interface PlanLimits {
  members: number;
  workspaces: number;
  channels: number;
  postsPerMonth: number | null;
  xPostsPerMonth: number;
  autoDmPerMonth: number;
  autoCommentsPerMonth: number;
  linkInBioPages: number;
  agents: number;
  mediaStorageBytes: number;
  aiActionsPerMonth: number;
  imageGenerationsPerMonth: number;
  videoCreditsPerMonth: number;
  maxFileSize: { image: number; video: number };
}

export interface Organization {
  userId: string;
  plan: string;
  status: string | null;
  limits: PlanLimits;
  accounts: {
    total: number;
    byPlatform: Record<string, number>;
  };
}

export interface Usage {
  postsThisMonth: number;
  postsMonthlyLimit: number | null;
  credits: {
    total: number;
    used: number;
    available: number;
    monthlyResetAt: string | null;
  };
}

export interface SetupCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DiagnosticsSetup {
  ok: boolean;
  checks: SetupCheck[];
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

export interface PostAccountOverride {
  accountId: string;
  captionOverride?: string | null;
  fields?: Record<string, string>;
}

export interface CreatePostInput {
  caption?: string;
  firstComment?: string;
  postType?: string;
  accountIds: string[];
  mediaIds?: string[];
  accountOverrides?: PostAccountOverride[];
  /** ISO 8601 — omit to save as a draft. */
  scheduledAt?: string;
  /** Thread renditions keyed by accountId (postType "thread"). */
  threadParts?: Record<string, string[]> | null;
}

export interface UpdatePostInput {
  caption?: string;
  firstComment?: string | null;
  postType?: string;
  status?: "draft" | "scheduled" | "published" | "failed";
  /** ISO 8601; `null` clears the schedule. */
  scheduledAt?: string | null;
  delayMinutes?: number | null;
  accountIds?: string[];
  accountOverrides?: PostAccountOverride[];
  mediaIds?: string[];
  poll?: {
    question: string;
    options: string[];
    durationDays: number;
  } | null;
  threadParts?: Record<string, string[]> | null;
}

export interface ListPostsOptions {
  limit?: number;
  offset?: number;
  status?: "draft" | "scheduled" | "publishing" | "published" | "failed";
  q?: string;
}

export interface CreateCommentInput {
  postId: string;
  accountId: string;
  text: string;
  /** ISO 8601 — omit to publish immediately. */
  scheduledAt?: string;
  parentCommentId?: string;
}

export interface UpdateCommentInput {
  text?: string;
  scheduledAt?: string;
}

export interface ListInboxOptions {
  status?: "unread" | "read" | "replied";
  sourceType?: "comment" | "mention" | "dm";
  platform?: string;
  accountId?: string;
  limit?: number;
  offset?: number;
}

export interface ListMediaOptions {
  type?: "image" | "video";
  limit?: number;
  offset?: number;
}

export interface CreateMediaFromUrlInput {
  url: string;
  mediaType?: "image" | "video" | "document";
}

export interface CreateTeamInput {
  name: string;
  slug?: string;
  description?: string;
  avatarUrl?: string;
  accountIds?: string[];
}

export interface UpdateTeamInput {
  name?: string;
  slug?: string;
  description?: string | null;
  avatarUrl?: string | null;
  accountIds?: string[];
}

export interface AnalyticsWindowOptions {
  windowDays?: number;
}

export interface RefreshAnalyticsInput {
  windowDays?: number;
  limit?: number;
}

export interface CreateCsvImportInput {
  /** Public URL of the CSV file. */
  url?: string;
  /** Raw CSV text. */
  csv?: string;
}

export interface ListCsvImportsOptions {
  limit?: number;
  offset?: number;
}

export interface ListCsvImportRowsOptions {
  status?: "SUCCESS" | "FAILED";
  limit?: number;
  offset?: number;
}

export type AccountToolResult = {
  flairs?: Array<{ id: string; text: string }>;
  boards?: Array<{ id: string; name: string }>;
};

export type AccountToolName = "reddit-flairs" | "pinterest-boards";

// ---------------------------------------------------------------------------
// Clipping
// ---------------------------------------------------------------------------

export interface CreateClipInput {
  /** Source video URL (e.g. YouTube). */
  url: string;
  /** 1–10, default 5. */
  maxClips?: number;
  /** How landscape video is fitted to vertical: blurred bars or crop. */
  fit?: "blur" | "crop";
  /** Accounts to auto-post finished clips to (max 20). */
  channelIds?: string[];
  /** Client-chosen key (≤100 chars); resending it returns the same job. */
  idempotencyKey: string;
}

export interface ClipPick {
  start: number;
  end: number;
  title: string;
  caption: string;
}

export interface ClipResult {
  pickIndex: number;
  status: string;
  videoPath?: string;
  thumbnailPath?: string;
  fileSize?: number;
  thumbnailSize?: number;
  width?: number;
  height?: number;
  duration?: number;
  mediaId?: string;
  postIds?: string[];
  errorCode?: string;
}

export interface ClipJob {
  id: string;
  sourceUrl: string;
  title: string | null;
  duration: number | null;
  maxClips: number;
  fit: string;
  channelIds: string[];
  status: string;
  stage: string;
  picks: ClipPick[] | null;
  results: ClipResult[];
  reservedMinutes: number;
  refunded: boolean;
  errorCode: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClipUsage {
  used: number;
  limit: number;
}
