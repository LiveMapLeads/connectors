// Test helpers — a stubbed global `fetch` so the suite exercises the real action/trigger
// code paths against a MOCKED /api/v1, never the live API and never spending credits.
import { vi } from 'vitest';

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Headers;
  body: unknown;
}

export interface StubResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Replace `globalThis.fetch` with a stub that records each request (URL, method, headers,
 * parsed JSON body) and returns the `StubResponse` the handler chooses. Returns the live
 * array of recorded requests. Call `restoreFetch()` in an `afterEach`.
 */
export function stubFetch(handler: (req: RecordedRequest) => StubResponse): RecordedRequest[] {
  const recorded: RecordedRequest[] = [];
  globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    let body: unknown;
    try {
      const text = await request.clone().text();
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = undefined;
    }
    const record: RecordedRequest = {
      url: request.url,
      method: request.method,
      headers: request.headers,
      body,
    };
    recorded.push(record);
    const res = handler(record);
    return new Response(res.body === undefined ? null : JSON.stringify(res.body), {
      status: res.status,
      headers: { 'content-type': 'application/json', ...(res.headers ?? {}) },
    });
  }) as typeof fetch;
  return recorded;
}

export function restoreFetch(): void {
  vi.restoreAllMocks();
}

/** A throwaway test API key — never a real credential. */
export const TEST_KEY = 'lml_test_key_0000';
