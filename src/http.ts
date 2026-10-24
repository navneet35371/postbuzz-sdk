/**
 * HTTP core for the post.buzz REST v1 API. One `request()` helper every
 * resource method goes through: Bearer auth, JSON encode/decode, and the
 * error-envelope → PostBuzzError mapping live here so no route handling can
 * drift.
 */

import type { ApiErrorBody } from "./types.js";

/** Default production API base. The REST sub-app is mounted under `/api`,
 *  per-route paths carry the `/v1` segment. */
export const DEFAULT_BASE_URL = "https://post.buzz/api";

/** Error thrown for every non-2xx API response (and transport failures).
 *  `code` is the API's machine error code (e.g. "not_found",
 *  "subscription_required"); `status` is the HTTP status; `details` carries
 *  structured context when the API sent one. */
export class PostBuzzError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  /** Raw response body text, for diagnostics when the body wasn't JSON. */
  readonly responseBody?: string;

  constructor(opts: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
    responseBody?: string;
  }) {
    super(opts.message);
    this.name = "PostBuzzError";
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
    this.responseBody = opts.responseBody;
  }
}

/** Shape every resource method returns through — the API wraps payloads in
 *  `{ data: ... }` (lists add pagination siblings). */
export type ApiResponse<T> = { data: T } & Record<string, unknown>;

export interface Requester {
  request<T>(
    method: string,
    path: string,
    opts?: { query?: Record<string, unknown>; body?: unknown },
  ): Promise<T>;
  /** Full envelope access for responses with extra siblings (e.g. GET
   *  /v1/posts returns `{ data, limit, offset }`). */
  requestEnvelope<E>(
    method: string,
    path: string,
    opts?: { query?: Record<string, unknown>; body?: unknown },
  ): Promise<E>;
  baseUrl: string;
}

/** Encode interpolated path segments so an id can never change the route
 *  (`path\`/v1/posts/${id}\``). */
export function path(
  strings: TemplateStringsArray,
  ...values: string[]
): string {
  return strings.reduce(
    (out, part, i) => out + encodeURIComponent(values[i - 1]!) + part,
  );
}

/** Code for the legacy `{ error: string }` body, which carries no code. */
const LEGACY_CODES: Record<number, string> = {
  400: "bad_request",
  403: "forbidden",
  404: "not_found",
};

/** Statuses worth retrying: rate limits and transient gateway failures. */
const RETRYABLE_STATUS = new Set([408, 429, 502, 503, 504]);
const IDEMPOTENT = new Set(["GET", "HEAD", "PUT", "DELETE"]);

declare const __SDK_VERSION__: string;
const USER_AGENT = `postbuzz-sdk/${
  typeof __SDK_VERSION__ === "string" ? __SDK_VERSION__ : "dev"
}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry-After (seconds or HTTP date) → ms, else exponential backoff. */
function retryDelay(res: Response | undefined, attempt: number): number {
  const header = res?.headers.get("retry-after");
  if (header) {
    const secs = Number(header);
    const ms = Number.isNaN(secs) ? Date.parse(header) - Date.now() : secs * 1000;
    if (ms >= 0) return Math.min(ms, 60_000);
  }
  return Math.min(500 * 2 ** attempt, 8_000) * (0.5 + Math.random() / 2);
}

export function createRequester(opts: {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  maxRetries?: number;
}): Requester {
  if (!opts.apiKey) {
    throw new PostBuzzError({
      status: 0,
      code: "MISSING_API_KEY",
      message:
        "An API key is required. Create one in post.buzz under Settings → API Keys, then pass it as { apiKey } (or set POSTBUZZ_API_KEY).",
    });
  }
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const doFetch = opts.fetch ?? globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const maxRetries = opts.maxRetries ?? 2;

  async function raw(
    method: string,
    path: string,
    reqOpts?: { query?: Record<string, unknown>; body?: unknown },
  ): Promise<Response> {
    const url = new URL(baseUrl + path);
    if (reqOpts?.query) {
      for (const [key, value] of Object.entries(reqOpts.query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${opts.apiKey}`,
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    };
    let body: FormData | string | undefined;
    if (reqOpts?.body !== undefined) {
      if (reqOpts.body instanceof FormData) {
        body = reqOpts.body;
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(reqOpts.body);
      }
    }

    // Network errors and 5xx are only retried for idempotent methods — a
    // POST may have landed. 429 is always safe: the API rejected it unrun.
    let res: Response | undefined;
    for (let attempt = 0; ; attempt++) {
      try {
        res = await doFetch(url, {
          method,
          headers,
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (cause) {
        if (attempt < maxRetries && IDEMPOTENT.has(method)) {
          await sleep(retryDelay(undefined, attempt));
          continue;
        }
        const timedOut =
          cause instanceof Error && cause.name === "TimeoutError";
        throw new PostBuzzError({
          status: 0,
          code: timedOut ? "TIMEOUT" : "UNREACHABLE",
          message: timedOut
            ? `post.buzz API did not respond within ${timeoutMs}ms (${method} ${url.pathname})`
            : `Could not reach the post.buzz API at ${url.origin}: ${
                cause instanceof Error ? cause.message : String(cause)
              }`,
        });
      }
      const retryable =
        res.status === 429 ||
        (RETRYABLE_STATUS.has(res.status) && IDEMPOTENT.has(method));
      if (!retryable || attempt >= maxRetries) break;
      await res.body?.cancel();
      await sleep(retryDelay(res, attempt));
    }

    if (!res.ok) {
      const text = await res.text();
      let code = `HTTP_${res.status}`;
      let message = text || res.statusText;
      let details: unknown;
      try {
        const parsed = JSON.parse(text) as ApiErrorBody | { error: string };
        if (typeof parsed.error === "string") {
          // Legacy shape still used by POST /v1/posts and DELETE /v1/posts/:id.
          code = LEGACY_CODES[res.status] ?? code;
          message = parsed.error;
        } else if (parsed.error?.code) {
          code = parsed.error.code;
          message = parsed.error.message;
          details = parsed.error.details;
        }
      } catch {
        // Non-JSON body — keep code/message defaults.
      }
      throw new PostBuzzError({
        status: res.status,
        code,
        message,
        details,
        responseBody: text,
      });
    }
    return res;
  }

  return {
    baseUrl,
    async request<T>(
      method: string,
      path: string,
      reqOpts?: { query?: Record<string, unknown>; body?: unknown },
    ): Promise<T> {
      const res = await raw(method, path, reqOpts);
      const text = await res.text();
      if (!text) return undefined as T;
      const envelope = JSON.parse(text) as ApiResponse<T>;
      // Most routes wrap payloads in { data: ... }; some (POST /v1/posts,
      // DELETE /v1/posts/:id) return the payload bare. Pass bare bodies
      // through instead of silently degrading to undefined.
      return envelope?.data !== undefined ? envelope.data : (envelope as T);
    },
    async requestEnvelope<E>(
      method: string,
      path: string,
      reqOpts?: { query?: Record<string, unknown>; body?: unknown },
    ): Promise<E> {
      const res = await raw(method, path, reqOpts);
      return (await res.json()) as E;
    },
  };
}
