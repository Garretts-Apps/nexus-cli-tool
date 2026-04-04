// Tier 4 auxiliary state: Prompt cache latch flags.
// Extracted from src/bootstrap/state.ts (ARCH-002 Phase 3).

// Cached prompt cache 1h TTL allowlist from GrowthBook (session-stable)
let promptCache1hAllowlist: string[] | null = null
// Cached 1h TTL user eligibility (session-stable). Latched on first
// evaluation so mid-session overage flips don't change the cache_control
// TTL, which would bust the server-side prompt cache.
let promptCache1hEligible: boolean | null = null
// Sticky-on latch for AFK_MODE_BETA_HEADER. Once auto mode is first
// activated, keep sending the header for the rest of the session so
// Shift+Tab toggles don't bust the ~50-70K token prompt cache.
let afkModeHeaderLatched: boolean | null = null
// Sticky-on latch for FAST_MODE_BETA_HEADER. Once fast mode is first
// enabled, keep sending the header so cooldown enter/exit doesn't
// double-bust the prompt cache. The `speed` body param stays dynamic.
let fastModeHeaderLatched: boolean | null = null
// Sticky-on latch for the cache-editing beta header. Once cached
// microcompact is first enabled, keep sending the header so mid-session
// GrowthBook/settings toggles don't bust the prompt cache.
let cacheEditingHeaderLatched: boolean | null = null
// Sticky-on latch for clearing thinking from prior tool loops. Triggered
// when >1h since last API call (confirmed cache miss — no cache-hit
// benefit to keeping thinking). Once latched, stays on so the newly-warmed
// thinking-cleared cache isn't busted by flipping back to keep:'all'.
let thinkingClearLatched: boolean | null = null
// Set to true after compaction (auto or manual /compact). Consumed by
// logAPISuccess to tag the first post-compaction API call so we can
// distinguish compaction-induced cache misses from TTL expiry.
let pendingPostCompaction = false

export function getPromptCache1hAllowlist(): string[] | null {
  return promptCache1hAllowlist
}

export function setPromptCache1hAllowlist(allowlist: string[] | null): void {
  promptCache1hAllowlist = allowlist
}

export function getPromptCache1hEligible(): boolean | null {
  return promptCache1hEligible
}

export function setPromptCache1hEligible(eligible: boolean | null): void {
  promptCache1hEligible = eligible
}

export function getAfkModeHeaderLatched(): boolean | null {
  return afkModeHeaderLatched
}

export function setAfkModeHeaderLatched(v: boolean): void {
  afkModeHeaderLatched = v
}

export function getFastModeHeaderLatched(): boolean | null {
  return fastModeHeaderLatched
}

export function setFastModeHeaderLatched(v: boolean): void {
  fastModeHeaderLatched = v
}

export function getCacheEditingHeaderLatched(): boolean | null {
  return cacheEditingHeaderLatched
}

export function setCacheEditingHeaderLatched(v: boolean): void {
  cacheEditingHeaderLatched = v
}

export function getThinkingClearLatched(): boolean | null {
  return thinkingClearLatched
}

export function setThinkingClearLatched(v: boolean): void {
  thinkingClearLatched = v
}

/**
 * Reset beta header latches to null. Called on /clear and /compact so a
 * fresh conversation gets fresh header evaluation.
 */
export function clearBetaHeaderLatches(): void {
  afkModeHeaderLatched = null
  fastModeHeaderLatched = null
  cacheEditingHeaderLatched = null
  thinkingClearLatched = null
}

/** Mark that a compaction just occurred. The next API success event will
 *  include isPostCompaction=true, then the flag auto-resets. */
export function markPostCompaction(): void {
  pendingPostCompaction = true
}

/** Consume the post-compaction flag. Returns true once after compaction,
 *  then returns false until the next compaction. */
export function consumePostCompaction(): boolean {
  const was = pendingPostCompaction
  pendingPostCompaction = false
  return was
}

/** Reset to initial state (test helper). */
export function resetPromptCacheLatchState(): void {
  promptCache1hAllowlist = null
  promptCache1hEligible = null
  afkModeHeaderLatched = null
  fastModeHeaderLatched = null
  cacheEditingHeaderLatched = null
  thinkingClearLatched = null
  pendingPostCompaction = false
}
