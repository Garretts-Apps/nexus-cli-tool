// Tier 3 volatile runtime state: Cost, duration, line counts, token usage, turn counters.
// Extracted from src/bootstrap/state.ts (ARCH-002 Phase 2).

import sumBy from 'lodash-es/sumBy.js'
import type { ModelUsage } from 'src/entrypoints/agentSdkTypes.js'

// ── Metrics state ──

let totalCostUSD = 0
let totalAPIDuration = 0
let totalAPIDurationWithoutRetries = 0
let totalToolDuration = 0
let turnHookDurationMs = 0
let turnToolDurationMs = 0
let turnClassifierDurationMs = 0
let turnToolCount = 0
let turnHookCount = 0
let turnClassifierCount = 0
let startTime = Date.now()
let lastInteractionTime = Date.now()
let totalLinesAdded = 0
let totalLinesRemoved = 0
let hasUnknownModelCostFlag = false
let modelUsage: { [modelName: string]: ModelUsage } = {}

// ── Turn-level token tracking (module-private) ──

let outputTokensAtTurnStart = 0
let currentTurnTokenBudget: number | null = null
let budgetContinuationCount = 0

// ── Interaction time batching ──

let interactionTimeDirty = false

// ── Cost / duration functions ──

export function addToTotalDurationState(
  duration: number,
  durationWithoutRetries: number,
): void {
  totalAPIDuration += duration
  totalAPIDurationWithoutRetries += durationWithoutRetries
}

export function resetTotalDurationStateAndCost_FOR_TESTS_ONLY(): void {
  totalAPIDuration = 0
  totalAPIDurationWithoutRetries = 0
  totalCostUSD = 0
}

export function addToTotalCostState(
  cost: number,
  usage: ModelUsage,
  model: string,
): void {
  modelUsage[model] = usage
  totalCostUSD += cost
}

export function getTotalCostUSD(): number {
  return totalCostUSD
}

export function getTotalAPIDuration(): number {
  return totalAPIDuration
}

export function getTotalDuration(): number {
  return Date.now() - startTime
}

export function getTotalAPIDurationWithoutRetries(): number {
  return totalAPIDurationWithoutRetries
}

export function getTotalToolDuration(): number {
  return totalToolDuration
}

export function addToToolDuration(duration: number): void {
  totalToolDuration += duration
  turnToolDurationMs += duration
  turnToolCount++
}

// ── Turn hook duration ──

export function getTurnHookDurationMs(): number {
  return turnHookDurationMs
}

export function addToTurnHookDuration(duration: number): void {
  turnHookDurationMs += duration
  turnHookCount++
}

export function resetTurnHookDuration(): void {
  turnHookDurationMs = 0
  turnHookCount = 0
}

export function getTurnHookCount(): number {
  return turnHookCount
}

// ── Turn tool duration ──

export function getTurnToolDurationMs(): number {
  return turnToolDurationMs
}

export function resetTurnToolDuration(): void {
  turnToolDurationMs = 0
  turnToolCount = 0
}

export function getTurnToolCount(): number {
  return turnToolCount
}

// ── Turn classifier duration ──

export function getTurnClassifierDurationMs(): number {
  return turnClassifierDurationMs
}

export function addToTurnClassifierDuration(duration: number): void {
  turnClassifierDurationMs += duration
  turnClassifierCount++
}

export function resetTurnClassifierDuration(): void {
  turnClassifierDurationMs = 0
  turnClassifierCount = 0
}

export function getTurnClassifierCount(): number {
  return turnClassifierCount
}

// ── Interaction time ──

/**
 * Marks that an interaction occurred.
 *
 * By default the actual Date.now() call is deferred until the next Ink render
 * frame (via flushInteractionTime()) so we avoid calling Date.now() on every
 * single keypress.
 *
 * Pass `immediate = true` when calling from React useEffect callbacks or
 * other code that runs *after* the Ink render cycle has already flushed.
 * Without it the timestamp stays stale until the next render, which may never
 * come if the user is idle (e.g. permission dialog waiting for input).
 */
export function updateLastInteractionTime(immediate?: boolean): void {
  if (immediate) {
    flushInteractionTime_inner()
  } else {
    interactionTimeDirty = true
  }
}

/**
 * If an interaction was recorded since the last flush, update the timestamp
 * now. Called by Ink before each render cycle so we batch many keypresses into
 * a single Date.now() call.
 */
export function flushInteractionTime(): void {
  if (interactionTimeDirty) {
    flushInteractionTime_inner()
  }
}

function flushInteractionTime_inner(): void {
  lastInteractionTime = Date.now()
  interactionTimeDirty = false
}

export function getLastInteractionTime(): number {
  return lastInteractionTime
}

// ── Lines changed ──

export function addToTotalLinesChanged(added: number, removed: number): void {
  totalLinesAdded += added
  totalLinesRemoved += removed
}

export function getTotalLinesAdded(): number {
  return totalLinesAdded
}

export function getTotalLinesRemoved(): number {
  return totalLinesRemoved
}

// ── Token aggregation ──

export function getTotalInputTokens(): number {
  return sumBy(Object.values(modelUsage), 'inputTokens')
}

export function getTotalOutputTokens(): number {
  return sumBy(Object.values(modelUsage), 'outputTokens')
}

export function getTotalCacheReadInputTokens(): number {
  return sumBy(Object.values(modelUsage), 'cacheReadInputTokens')
}

export function getTotalCacheCreationInputTokens(): number {
  return sumBy(Object.values(modelUsage), 'cacheCreationInputTokens')
}

export function getTotalWebSearchRequests(): number {
  return sumBy(Object.values(modelUsage), 'webSearchRequests')
}

// ── Turn token budget ──

export function getTurnOutputTokens(): number {
  return getTotalOutputTokens() - outputTokensAtTurnStart
}

export function getCurrentTurnTokenBudget(): number | null {
  return currentTurnTokenBudget
}

export function snapshotOutputTokensForTurn(budget: number | null): void {
  outputTokensAtTurnStart = getTotalOutputTokens()
  currentTurnTokenBudget = budget
  budgetContinuationCount = 0
}

export function getBudgetContinuationCount(): number {
  return budgetContinuationCount
}

export function incrementBudgetContinuationCount(): void {
  budgetContinuationCount++
}

// ── Unknown model cost ──

export function setHasUnknownModelCost(): void {
  hasUnknownModelCostFlag = true
}

export function hasUnknownModelCost(): boolean {
  return hasUnknownModelCostFlag
}

// ── Model usage ──

export function getModelUsage(): { [modelName: string]: ModelUsage } {
  return modelUsage
}

export function getUsageForModel(model: string): ModelUsage | undefined {
  return modelUsage[model]
}

// ── Cost state reset / restore ──

export function resetCostState(): void {
  totalCostUSD = 0
  totalAPIDuration = 0
  totalAPIDurationWithoutRetries = 0
  totalToolDuration = 0
  startTime = Date.now()
  totalLinesAdded = 0
  totalLinesRemoved = 0
  hasUnknownModelCostFlag = false
  modelUsage = {}
}

/**
 * Sets cost state values for session restore.
 * Called by restoreCostStateForSession in cost-tracker.ts.
 */
export function setCostStateForRestore({
  totalCostUSD: costUSD,
  totalAPIDuration: apiDuration,
  totalAPIDurationWithoutRetries: apiDurationNoRetries,
  totalToolDuration: toolDuration,
  totalLinesAdded: linesAdded,
  totalLinesRemoved: linesRemoved,
  lastDuration,
  modelUsage: usage,
}: {
  totalCostUSD: number
  totalAPIDuration: number
  totalAPIDurationWithoutRetries: number
  totalToolDuration: number
  totalLinesAdded: number
  totalLinesRemoved: number
  lastDuration: number | undefined
  modelUsage: { [modelName: string]: ModelUsage } | undefined
}): void {
  totalCostUSD = costUSD
  totalAPIDuration = apiDuration
  totalAPIDurationWithoutRetries = apiDurationNoRetries
  totalToolDuration = toolDuration
  totalLinesAdded = linesAdded
  totalLinesRemoved = linesRemoved

  // Restore per-model usage breakdown
  if (usage) {
    modelUsage = usage
  }

  // Adjust startTime to make wall duration accumulate
  if (lastDuration) {
    startTime = Date.now() - lastDuration
  }
}

/** Reset to initial state (test helper). */
export function resetMetricsState(): void {
  totalCostUSD = 0
  totalAPIDuration = 0
  totalAPIDurationWithoutRetries = 0
  totalToolDuration = 0
  turnHookDurationMs = 0
  turnToolDurationMs = 0
  turnClassifierDurationMs = 0
  turnToolCount = 0
  turnHookCount = 0
  turnClassifierCount = 0
  startTime = Date.now()
  lastInteractionTime = Date.now()
  totalLinesAdded = 0
  totalLinesRemoved = 0
  hasUnknownModelCostFlag = false
  modelUsage = {}
  outputTokensAtTurnStart = 0
  currentTurnTokenBudget = null
  budgetContinuationCount = 0
  interactionTimeDirty = false
}
