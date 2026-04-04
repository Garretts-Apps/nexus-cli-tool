// Tier 4 auxiliary state: Team session state.
// Extracted from src/bootstrap/state.ts (ARCH-002 Phase 1).

let sessionCreatedTeams: Set<string> = new Set()

export function getSessionCreatedTeams(): Set<string> {
  return sessionCreatedTeams
}

export function addSessionCreatedTeam(name: string): void {
  sessionCreatedTeams.add(name)
}

export function removeSessionCreatedTeam(name: string): void {
  sessionCreatedTeams.delete(name)
}

export function hasSessionCreatedTeam(name: string): boolean {
  return sessionCreatedTeams.has(name)
}

/** Reset to initial state (test helper). */
export function resetTeamState(): void {
  sessionCreatedTeams = new Set()
}
