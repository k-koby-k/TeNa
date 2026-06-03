// Fixed-window rate limiting backed by Workers KV. Cheap and good enough for a
// known audience: one counter key per (subject, window). KV's eventual
// consistency means the cap is approximate at the edges — fine for "stop a
// bot/script from burning Gemini tokens".

import type { KVNamespace } from "@cloudflare/workers-types";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/** Increment the counter for `subject` in the current window. */
export async function hit(
  kv: KVNamespace,
  subject: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / windowSec);
  const key = `rl:${subject}:${window}`;
  const current = Number((await kv.get(key)) ?? "0") + 1;
  // TTL a bit past the window so the key self-cleans.
  await kv.put(key, String(current), { expirationTtl: windowSec * 2 });
  const resetAt = (window + 1) * windowSec;
  return {
    ok: current <= limit,
    remaining: Math.max(0, limit - current),
    retryAfterSec: Math.max(1, resetAt - now),
  };
}
