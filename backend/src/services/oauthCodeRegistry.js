const crypto = require('crypto');

/**
 * Guarantees that a given OAuth authorization code is exchanged with the
 * provider AT MOST ONCE, however many times the callback URL is requested.
 *
 * An OAuth authorization code is single-use: the moment it has been traded
 * for an access token, any further exchange is rejected by the provider
 * ("This authorization code has been used." from Facebook). The callback
 * route, though, is an ordinary GET URL sitting in the browser's address
 * bar and history — it gets re-requested for all sorts of reasons outside
 * this app's control: the user reloading or navigating back to it, a
 * platform/proxy retrying an idempotent GET after a slow cold start, a
 * browser prefetch, or a link scanner following the URL. Every one of those
 * used to trigger a second live token exchange and dead-end the user on a
 * raw provider error.
 *
 * The registry makes the first request the only one that ever talks to the
 * provider. Later requests carrying the same code either wait for that
 * exchange to finish (concurrent retry) or read its recorded outcome
 * (a reload) and are completed from it.
 *
 * In-memory by design: this is a de-duplication cache for a window of
 * seconds, not a store of record. A restart or a second instance simply
 * falls back to the pre-existing behaviour — which the caller now handles
 * gracefully by redirecting to the frontend with an error instead of
 * printing the provider's message as JSON.
 */

// How long a completed outcome stays replayable. Long enough to cover a
// reload or a retry, short enough that a leaked code (browser history,
// referrer, proxy log) is not a lasting credential.
const OUTCOME_TTL_MS = 3 * 60 * 1000;
// A duplicate never waits on an in-flight exchange longer than this.
const INFLIGHT_TIMEOUT_MS = 20 * 1000;
// Hard ceiling so a flood of bogus callbacks can't grow the map unbounded.
const MAX_ENTRIES = 500;

const entries = new Map();

function keyFor(provider, code) {
  return crypto.createHash('sha256').update(`${provider}:${code}`).digest('hex');
}

function purge(now = Date.now()) {
  entries.forEach((entry, key) => {
    if (entry.expiresAt <= now) entries.delete(key);
  });
  if (entries.size > MAX_ENTRIES) {
    // Oldest-first: Map preserves insertion order.
    const excess = entries.size - MAX_ENTRIES;
    let removed = 0;
    for (const key of entries.keys()) {
      entries.delete(key);
      if ((removed += 1) >= excess) break;
    }
  }
}

/**
 * Claims `code` for this request.
 *
 * Returns either
 *   `{ duplicate: false, settle(outcome) }` — this request owns the
 *   exchange and MUST call `settle` exactly once with
 *   `{ ok: true, userId }` or `{ ok: false, reason }`; or
 *   `{ duplicate: true, outcome() }` — another request already owns it;
 *   `outcome()` resolves with that request's result (never rejects, and
 *   resolves to `{ ok: false, reason: 'timeout' }` if the owner stalls).
 */
function claim(provider, code) {
  purge();
  const key = keyFor(provider, code);
  const existing = entries.get(key);

  if (existing) {
    return {
      duplicate: true,
      key,
      outcome: () =>
        Promise.race([
          existing.promise,
          new Promise((resolve) => {
            const timer = setTimeout(
              () => resolve({ ok: false, reason: 'timeout' }),
              INFLIGHT_TIMEOUT_MS
            );
            // Don't hold the event loop open just to time a duplicate out.
            if (timer.unref) timer.unref();
          }),
        ]),
    };
  }

  let resolveOutcome;
  const promise = new Promise((resolve) => {
    resolveOutcome = resolve;
  });
  const entry = {
    promise,
    settled: false,
    expiresAt: Date.now() + INFLIGHT_TIMEOUT_MS + OUTCOME_TTL_MS,
  };
  entries.set(key, entry);

  return {
    duplicate: false,
    key,
    settle(outcome) {
      if (entry.settled) return;
      entry.settled = true;
      entry.expiresAt = Date.now() + OUTCOME_TTL_MS;
      resolveOutcome(outcome);
    },
  };
}

/** Test hook — drops every cached claim. */
function reset() {
  entries.clear();
}

module.exports = { claim, reset, OUTCOME_TTL_MS, INFLIGHT_TIMEOUT_MS };
