// Tier 4 auxiliary state: Invoked-skill tracking for compaction preservation.
// Extracted from src/bootstrap/state.ts (ARCH-002 Phase 1).

// Keys are composite: `${agentId ?? ''}:${skillName}` to prevent cross-agent overwrites
export type InvokedSkillInfo = {
  skillName: string
  skillPath: string
  content: string
  invokedAt: number
  agentId: string | null
}

let invokedSkills: Map<string, InvokedSkillInfo> = new Map()

export function addInvokedSkill(
  skillName: string,
  skillPath: string,
  content: string,
  agentId: string | null = null,
): void {
  const key = `${agentId ?? ''}:${skillName}`
  invokedSkills.set(key, {
    skillName,
    skillPath,
    content,
    invokedAt: Date.now(),
    agentId,
  })
}

export function getInvokedSkills(): Map<string, InvokedSkillInfo> {
  return invokedSkills
}

export function getInvokedSkillsForAgent(
  agentId: string | undefined | null,
): Map<string, InvokedSkillInfo> {
  const normalizedId = agentId ?? null
  const filtered = new Map<string, InvokedSkillInfo>()
  for (const [key, skill] of invokedSkills) {
    if (skill.agentId === normalizedId) {
      filtered.set(key, skill)
    }
  }
  return filtered
}

export function clearInvokedSkills(
  preservedAgentIds?: ReadonlySet<string>,
): void {
  if (!preservedAgentIds || preservedAgentIds.size === 0) {
    invokedSkills.clear()
    return
  }
  for (const [key, skill] of invokedSkills) {
    if (skill.agentId === null || !preservedAgentIds.has(skill.agentId)) {
      invokedSkills.delete(key)
    }
  }
}

export function clearInvokedSkillsForAgent(agentId: string): void {
  for (const [key, skill] of invokedSkills) {
    if (skill.agentId === agentId) {
      invokedSkills.delete(key)
    }
  }
}

/** Reset to initial state (test helper). */
export function resetSkillState(): void {
  invokedSkills = new Map()
}
