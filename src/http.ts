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

export function createRequester(opts: {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
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

    let res: Response;
    try {
      res = await doFetch(url, { method, headers, body });
    } catch (cause) {
      throw new PostBuzzError({
        status: 0,
        code: "UNREACHABLE",
        message: `Could not reach the post.buzz API at ${url.origin}: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      });
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
          message = parsed.error;
        } else {
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
      if (res.status === 204) return undefined as T;
      const envelope = (await res.json()) as ApiResponse<T>;
      return envelope.data;
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
