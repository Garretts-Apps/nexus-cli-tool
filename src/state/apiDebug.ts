// Tier 4 auxiliary state: API debug and diagnostic state.
// Extracted from src/bootstrap/state.ts (ARCH-002 Phase 3).

import type { BetaMessageStreamParams } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'

// Last API request for bug reports
let lastAPIRequest: Omit<BetaMessageStreamParams, 'messages'> | null = null
// Messages from the last API request (internal-only; reference, not clone).
// Captures the exact post-compaction, CLAUDE.md-injected message set sent
// to the API so /share's serialized_conversation.json reflects reality.
let lastAPIRequestMessages: BetaMessageStreamParams['messages'] | null = null
// Last auto-mode classifier request(s) for /share transcript
let lastClassifierRequests: unknown[] | null = null
// CLAUDE.md content cached by context.ts for the auto-mode classifier.
// Breaks the yoloClassifier → claudemd → filesystem → permissions cycle.
let cachedClaudeMdContent: string | null = null

export function setLastAPIRequest(
  params: Omit<BetaMessageStreamParams, 'messages'> | null,
): void {
  lastAPIRequest = params
}

export function getLastAPIRequest(): Omit<
  BetaMessageStreamParams,
  'messages'
> | null {
  return lastAPIRequest
}

export function setLastAPIRequestMessages(
  messages: BetaMessageStreamParams['messages'] | null,
): void {
  lastAPIRequestMessages = messages
}

export function getLastAPIRequestMessages():
  | BetaMessageStreamParams['messages']
  | null {
  return lastAPIRequestMessages
}

export function setLastClassifierRequests(requests: unknown[] | null): void {
  lastClassifierRequests = requests
}

export function getLastClassifierRequests(): unknown[] | null {
  return lastClassifierRequests
}

export function setCachedClaudeMdContent(content: string | null): void {
  cachedClaudeMdContent = content
}

export function getCachedClaudeMdContent(): string | null {
  return cachedClaudeMdContent
}

/** Reset to initial state (test helper). */
export function resetApiDebugState(): void {
  lastAPIRequest = null
  lastAPIRequestMessages = null
  lastClassifierRequests = null
  cachedClaudeMdContent = null
}
