// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
// Background memory summarization. Fires the /auto-summarize prompt as a forked
// subagent when time-gate passes AND enough sessions have accumulated.
//
// Gate order (cheapest first):
//   1. Time: hours since lastConsolidatedAt >= minHours (one stat)
//   2. Sessions: transcript count with mtime > lastConsolidatedAt >= minSessions
//   3. Lock: no other process mid-consolidation
//
// State is closure-scoped inside initAutoSummarize() rather than module-level
// (tests call initAutoSummarize() in beforeEach for a fresh closure).

import type { REPLHookContext } from '../../utils/hooks/postSamplingHooks.js'
import {
  createCacheSafeParams,
  runForkedAgent,
} from '../../utils/forkedAgent.js'
import {
  createUserMessage,
  createMemorySavedMessage,
} from '../../utils/messages.js'
import type { Message } from '../../types/message.js'
import { logForDebugging } from '../../utils/debug.js'
import type { ToolUseContext } from '../../Tool.js'
import { logEvent } from '../analytics/index.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../analytics/growthbook.js'
import { isAutoMemoryEnabled, getAutoMemPath } from '../../memdir/paths.js'
import { isAutoSummarizeEnabled } from './config.js'
import { getProjectDir } from '../../utils/sessionStorage.js'
import { getOriginalCwd, getSessionId } from '../../bootstrap/state.js'
import { getIsRemoteMode, getKairosActive } from '../../state/sessionConfig.js'
import { createAutoMemCanUseTool } from '../extractMemories/extractMemories.js'
import { buildSummarizationPrompt } from './summarizationPrompt.js'
import {
  readLastConsolidatedAt,
  listSessionsTouchedSince,
  tryAcquireConsolidationLock,
  rollbackConsolidationLock,
} from './consolidationLock.js'
import {
  registerMemoryConsolidationTask,
  addConsolidationTurn,
  completeMemoryConsolidationTask,
  failMemoryConsolidationTask,
  isMemoryConsolidationTask,
} from '../../tasks/MemoryConsolidationTask/MemoryConsolidationTask.js'
import { FILE_EDIT_TOOL_NAME } from '../../tools/FileEditTool/constants.js'
import { FILE_WRITE_TOOL_NAME } from '../../tools/FileWriteTool/prompt.js'

// Scan throttle: when time-gate passes but session-gate doesn't, the lock
// mtime doesn't advance, so the time-gate keeps passing every turn.
const SESSION_SCAN_INTERVAL_MS = 10 * 60 * 1000

type AutoSummarizeConfig = {
  minHours: number
  minSessions: number
}

const DEFAULTS: AutoSummarizeConfig = {
  minHours: 24,
  minSessions: 5,
}

/**
 * Thresholds from tengu_onyx_plover. The enabled gate lives in config.ts
 * (isAutoSummarizeEnabled); this returns only the scheduling knobs. Defensive
 * per-field validation since GB cache can return stale wrong-type values.
 */
function getConfig(): AutoSummarizeConfig {
  const raw =
    getFeatureValue_CACHED_MAY_BE_STALE<Partial<AutoSummarizeConfig> | null>(
      'tengu_onyx_plover',
      null,
    )
  return {
    minHours:
      typeof raw?.minHours === 'number' &&
      Number.isFinite(raw.minHours) &&
      raw.minHours > 0
        ? raw.minHours
        : DEFAULTS.minHours,
    minSessions:
      typeof raw?.minSessions === 'number' &&
      Number.isFinite(raw.minSessions) &&
      raw.minSessions > 0
        ? raw.minSessions
        : DEFAULTS.minSessions,
  }
}

function isGateOpen(): boolean {
  if (getKairosActive()) return false // KAIROS mode uses disk-skill consolidation
  if (getIsRemoteMode()) return false
  if (!isAutoMemoryEnabled()) return false
  return isAutoSummarizeEnabled()
}

// Ant-build-only test override. Bypasses enabled/time/session gates but NOT
// the lock (so repeated turns don't pile up consolidations) or the memory-dir
// precondition. Still scans sessions so the prompt's session-hint is populated.
function isForced(): boolean {
  return false
}

type AppendSystemMessageFn = NonNullable<ToolUseContext['appendSystemMessage']>

let runner:
  | ((
      context: REPLHookContext,
      appendSystemMessage?: AppendSystemMessageFn,
    ) => Promise<void>)
  | null = null

/**
 * Call once at startup (from backgroundHousekeeping alongside
 * initExtractMemories), or per-test in beforeEach for a fresh closure.
 */
export function initAutoSummarize(): void {
  let lastSessionScanAt = 0

  runner = async function runAutoSummarize(context, appendSystemMessage) {
    const cfg = getConfig()
    const force = isForced()
    if (!force && !isGateOpen()) return

    // --- Time gate ---
    let lastAt: number
    try {
      lastAt = await readLastConsolidatedAt()
    } catch (e: unknown) {
      logForDebugging(
        `[autoSummarize] readLastConsolidatedAt failed: ${(e as Error).message}`,
      )
      return
    }
    const hoursSince = (Date.now() - lastAt) / 3_600_000
    if (!force && hoursSince < cfg.minHours) return

    // --- Scan throttle ---
    const sinceScanMs = Date.now() - lastSessionScanAt
    if (!force && sinceScanMs < SESSION_SCAN_INTERVAL_MS) {
      logForDebugging(
        `[autoSummarize] scan throttle — time-gate passed but last scan was ${Math.round(sinceScanMs / 1000)}s ago`,
      )
      return
    }
    lastSessionScanAt = Date.now()

    // --- Session gate ---
    let sessionIds: string[]
    try {
      sessionIds = await listSessionsTouchedSince(lastAt)
    } catch (e: unknown) {
      logForDebugging(
        `[autoSummarize] listSessionsTouchedSince failed: ${(e as Error).message}`,
      )
      return
    }
    // Exclude the current session (its mtime is always recent).
    const currentSession = getSessionId()
    sessionIds = sessionIds.filter(id => id !== currentSession)
    if (!force && sessionIds.length < cfg.minSessions) {
      logForDebugging(
        `[autoSummarize] skip — ${sessionIds.length} sessions since last consolidation, need ${cfg.minSessions}`,
      )
      return
    }

    // --- Lock ---
    // Under force, skip acquire entirely — use the existing mtime so
    // kill's rollback is a no-op (rewinds to where it already is).
    // The lock file stays untouched; next non-force turn sees it as-is.
    let priorMtime: number | null
    if (force) {
      priorMtime = lastAt
    } else {
      try {
        priorMtime = await tryAcquireConsolidationLock()
      } catch (e: unknown) {
        logForDebugging(
          `[autoSummarize] lock acquire failed: ${(e as Error).message}`,
        )
        return
      }
      if (priorMtime === null) return
    }

    logForDebugging(
      `[autoSummarize] firing — ${hoursSince.toFixed(1)}h since last, ${sessionIds.length} sessions to review`,
    )
    logEvent('internal_memory_fired', {
      hours_since: Math.round(hoursSince),
      sessions_since: sessionIds.length,
    })

    const setAppState =
      context.toolUseContext.setAppStateForTasks ??
      context.toolUseContext.setAppState
    const abortController = new AbortController()
    const taskId = registerMemoryConsolidationTask(setAppState, {
      sessionsReviewing: sessionIds.length,
      priorMtime,
      abortController,
    })

    try {
      const memoryRoot = getAutoMemPath()
      const transcriptDir = getProjectDir(getOriginalCwd())
      // Tool constraints note goes in `extra`, not the shared prompt body —
      // manual /auto-summarize runs in the main loop with normal permissions and this
      // would be misleading there.
      const extra = `

**Tool constraints for this run:** Bash is restricted to read-only commands (\`ls\`, \`find\`, \`grep\`, \`cat\`, \`stat\`, \`wc\`, \`head\`, \`tail\`, and similar). Anything that writes, redirects to a file, or modifies state will be denied. Plan your exploration with this in mind — no need to probe.

Sessions since last consolidation (${sessionIds.length}):
${sessionIds.map(id => `- ${id}`).join('\n')}`
      const prompt = buildSummarizationPrompt(memoryRoot, transcriptDir, extra)

      const result = await runForkedAgent({
        promptMessages: [createUserMessage({ content: prompt })],
        cacheSafeParams: createCacheSafeParams(context),
        canUseTool: createAutoMemCanUseTool(memoryRoot),
        querySource: 'auto_dream',
        forkLabel: 'auto_dream',
        skipTranscript: true,
        overrides: { abortController },
        onMessage: makeConsolidationProgressWatcher(taskId, setAppState),
      })

      completeMemoryConsolidationTask(taskId, setAppState)
      // Inline completion summary in the main transcript (same surface as
      // extractMemories's "Saved N memories" message).
      const consolidationState = context.toolUseContext.getAppState().tasks?.[taskId]
      if (
        appendSystemMessage &&
        isMemoryConsolidationTask(consolidationState) &&
        consolidationState.filesTouched.length > 0
      ) {
        appendSystemMessage({
          ...createMemorySavedMessage(consolidationState.filesTouched),
          verb: 'Improved',
        })
      }
      logForDebugging(
        `[autoSummarize] completed — cache: read=${result.totalUsage.cache_read_input_tokens} created=${result.totalUsage.cache_creation_input_tokens}`,
      )
      logEvent('internal_memory_completed', {
        cache_read: result.totalUsage.cache_read_input_tokens,
        cache_created: result.totalUsage.cache_creation_input_tokens,
        output: result.totalUsage.output_tokens,
        sessions_reviewed: sessionIds.length,
      })
    } catch (e: unknown) {
      // If the user killed from the bg-tasks dialog, MemoryConsolidationTask.kill already
      // aborted, rolled back the lock, and set status=killed. Don't overwrite
      // or double-rollback.
      if (abortController.signal.aborted) {
        logForDebugging('[autoSummarize] aborted by user')
        return
      }
      logForDebugging(`[autoSummarize] fork failed: ${(e as Error).message}`)
      logEvent('internal_memory_failed', {})
      failMemoryConsolidationTask(taskId, setAppState)
      // Rewind mtime so time-gate passes again. Scan throttle is the backoff.
      await rollbackConsolidationLock(priorMtime)
    }
  }
}

/**
 * Watch the forked agent's messages. For each assistant turn, extracts any
 * text blocks (the agent's reasoning/summary — what the user wants to see)
 * and collapses tool_use blocks to a count. Edit/Write file_paths are
 * collected for phase-flip + the inline completion message.
 */
function makeConsolidationProgressWatcher(
  taskId: string,
  setAppState: import('../../Task.js').SetAppState,
): (msg: Message) => void {
  return msg => {
    if (msg.type !== 'assistant') return
    let text = ''
    let toolUseCount = 0
    const touchedPaths: string[] = []
    for (const block of msg.message.content) {
      if (block.type === 'text') {
        text += block.text
      } else if (block.type === 'tool_use') {
        toolUseCount++
        if (
          block.name === FILE_EDIT_TOOL_NAME ||
          block.name === FILE_WRITE_TOOL_NAME
        ) {
          const input = block.input as { file_path?: unknown }
          if (typeof input.file_path === 'string') {
            touchedPaths.push(input.file_path)
          }
        }
      }
    }
    addConsolidationTurn(
      taskId,
      { text: text.trim(), toolUseCount },
      touchedPaths,
      setAppState,
    )
  }
}

/**
 * Entry point from stopHooks. No-op until initAutoSummarize() has been called.
 * Per-turn cost when enabled: one GB cache read + one stat.
 */
export async function executeAutoSummarize(
  context: REPLHookContext,
  appendSystemMessage?: AppendSystemMessageFn,
): Promise<void> {
  await runner?.(context, appendSystemMessage)
}
