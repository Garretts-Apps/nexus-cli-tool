// Background task entry for auto-summarize (memory consolidation subagent).
// Makes the otherwise-invisible forked agent visible in the footer pill and
// Shift+Down dialog. The consolidation agent itself is unchanged — this is pure UI
// surfacing via the existing task registry.

import { rollbackConsolidationLock } from '../../services/autoSummarize/consolidationLock.js'
import type { SetAppState, Task, TaskStateBase } from '../../Task.js'
import { createTaskStateBase, generateTaskId } from '../../Task.js'
import { registerTask, updateTaskState } from '../../utils/task/framework.js'

// Keep only the N most recent turns for live display.
const MAX_TURNS = 30

// A single assistant turn from the consolidation agent, tool uses collapsed to a count.
export type ConsolidationTurn = {
  text: string
  toolUseCount: number
}

// No phase detection — the summarization prompt has a 4-stage structure
// (orient/gather/consolidate/prune) but we don't parse it. Just flip from
// 'starting' to 'updating' when the first Edit/Write tool_use lands.
export type ConsolidationPhase = 'starting' | 'updating'

export type MemoryConsolidationTaskState = TaskStateBase & {
  type: 'dream'
  phase: ConsolidationPhase
  sessionsReviewing: number
  /**
   * Paths observed in Edit/Write tool_use blocks via onMessage. This is an
   * INCOMPLETE reflection of what the consolidation agent actually changed — it misses
   * any bash-mediated writes and only captures the tool calls we pattern-match.
   * Treat as "at least these were touched", not "only these were touched".
   */
  filesTouched: string[]
  /** Assistant text responses, tool uses collapsed. Prompt is NOT included. */
  turns: ConsolidationTurn[]
  abortController?: AbortController
  /** Stashed so kill can rewind the lock mtime (same path as fork-failure). */
  priorMtime: number
}

export function isMemoryConsolidationTask(task: unknown): task is MemoryConsolidationTaskState {
  return (
    typeof task === 'object' &&
    task !== null &&
    'type' in task &&
    task.type === 'dream'
  )
}

export function registerMemoryConsolidationTask(
  setAppState: SetAppState,
  opts: {
    sessionsReviewing: number
    priorMtime: number
    abortController: AbortController
  },
): string {
  const id = generateTaskId('dream')
  const task: MemoryConsolidationTaskState = {
    ...createTaskStateBase(id, 'dream', 'dreaming'),
    type: 'dream',
    status: 'running',
    phase: 'starting',
    sessionsReviewing: opts.sessionsReviewing,
    filesTouched: [],
    turns: [],
    abortController: opts.abortController,
    priorMtime: opts.priorMtime,
  }
  registerTask(task, setAppState)
  return id
}

export function addConsolidationTurn(
  taskId: string,
  turn: ConsolidationTurn,
  touchedPaths: string[],
  setAppState: SetAppState,
): void {
  updateTaskState<MemoryConsolidationTaskState>(taskId, setAppState, task => {
    const seen = new Set(task.filesTouched)
    const newTouched = touchedPaths.filter(p => !seen.has(p) && seen.add(p))
    // Skip the update entirely if the turn is empty AND nothing new was
    // touched. Avoids re-rendering on pure no-ops.
    if (
      turn.text === '' &&
      turn.toolUseCount === 0 &&
      newTouched.length === 0
    ) {
      return task
    }
    return {
      ...task,
      phase: newTouched.length > 0 ? 'updating' : task.phase,
      filesTouched:
        newTouched.length > 0
          ? [...task.filesTouched, ...newTouched]
          : task.filesTouched,
      turns: task.turns.slice(-(MAX_TURNS - 1)).concat(turn),
    }
  })
}

export function completeMemoryConsolidationTask(
  taskId: string,
  setAppState: SetAppState,
): void {
  // notified: true immediately — consolidation has no model-facing notification path
  // (it's UI-only), and eviction requires terminal + notified. The inline
  // appendSystemMessage completion note IS the user surface.
  updateTaskState<MemoryConsolidationTaskState>(taskId, setAppState, task => ({
    ...task,
    status: 'completed',
    endTime: Date.now(),
    notified: true,
    abortController: undefined,
  }))
}

export function failMemoryConsolidationTask(taskId: string, setAppState: SetAppState): void {
  updateTaskState<MemoryConsolidationTaskState>(taskId, setAppState, task => ({
    ...task,
    status: 'failed',
    endTime: Date.now(),
    notified: true,
    abortController: undefined,
  }))
}

export const MemoryConsolidationTask: Task = {
  name: 'MemoryConsolidationTask',
  type: 'dream',

  async kill(taskId, setAppState) {
    let priorMtime: number | undefined
    updateTaskState<MemoryConsolidationTaskState>(taskId, setAppState, task => {
      if (task.status !== 'running') return task
      task.abortController?.abort()
      priorMtime = task.priorMtime
      return {
        ...task,
        status: 'killed',
        endTime: Date.now(),
        notified: true,
        abortController: undefined,
      }
    })
    // Rewind the lock mtime so the next session can retry. Same path as the
    // fork-failure catch in autoSummarize.ts. If updateTaskState was a no-op
    // (already terminal), priorMtime stays undefined and we skip.
    if (priorMtime !== undefined) {
      await rollbackConsolidationLock(priorMtime)
    }
  },
}
