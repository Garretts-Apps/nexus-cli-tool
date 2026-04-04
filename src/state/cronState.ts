// Tier 4 auxiliary state: Cron / scheduled-task session state.
// Extracted from src/bootstrap/state.ts (ARCH-002 Phase 1).

export type SessionCronTask = {
  id: string
  cron: string
  prompt: string
  createdAt: number
  recurring?: boolean
  /**
   * When set, the task was created by an in-process teammate (not the team lead).
   * The scheduler routes fires to that teammate's pendingUserMessages queue
   * instead of the main REPL command queue. Session-only — never written to disk.
   */
  agentId?: string
}

let scheduledTasksEnabled = false
let sessionCronTasks: SessionCronTask[] = []

export function setScheduledTasksEnabled(enabled: boolean): void {
  scheduledTasksEnabled = enabled
}

export function getScheduledTasksEnabled(): boolean {
  return scheduledTasksEnabled
}

export function getSessionCronTasks(): SessionCronTask[] {
  return sessionCronTasks
}

export function addSessionCronTask(task: SessionCronTask): void {
  sessionCronTasks.push(task)
}

/**
 * Returns the number of tasks actually removed. Callers use this to skip
 * downstream work (e.g. the disk read in removeCronTasks) when all ids
 * were accounted for here.
 */
export function removeSessionCronTasks(ids: readonly string[]): number {
  if (ids.length === 0) return 0
  const idSet = new Set(ids)
  const remaining = sessionCronTasks.filter(t => !idSet.has(t.id))
  const removed = sessionCronTasks.length - remaining.length
  if (removed === 0) return 0
  sessionCronTasks = remaining
  return removed
}

/** Reset to initial state (test helper). */
export function resetCronState(): void {
  scheduledTasksEnabled = false
  sessionCronTasks = []
}
