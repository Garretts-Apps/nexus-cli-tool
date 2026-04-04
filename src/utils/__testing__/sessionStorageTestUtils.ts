/**
 * Session Storage Testing Utilities
 *
 * These functions should only be used in tests to reset session state.
 * They are intentionally isolated to prevent accidental use in production code.
 */

// This import will be resolved at test time
// In production builds, the __testing__ directory is excluded
let getProject: () => any
let project: any

// Dynamic import to avoid circular dependencies
try {
  const module = require('../sessionStorage.js') as any
  getProject = module.getProject
  // Access the project variable indirectly through the module
} catch {
  // Test environment may not have full module resolution
}

/**
 * Reset the flush state for a project in testing
 * @internal For testing only
 */
export function resetProjectFlushStateForTesting(): void {
  const proj = getProject?.()
  proj?._resetFlushState?.()
}

/**
 * Reset the entire Project singleton for testing.
 * This ensures tests with different CLAUDE_CONFIG_DIR values
 * don't share stale sessionFile paths.
 * @internal For testing only
 */
export function resetProjectForTesting(): void {
  // Clear the project singleton
  // This will be recreated on next access
  project = null
}

/**
 * Set the session file path for testing
 * @internal For testing only
 */
export function setSessionFileForTesting(path: string): void {
  const proj = getProject?.()
  if (proj) {
    proj.sessionFile = path
  }
}

/**
 * Set the remote ingress URL for testing
 * @internal For testing only
 */
export function setRemoteIngressUrlForTesting(url: string): void {
  const proj = getProject?.()
  if (proj) {
    proj.setRemoteIngressUrl(url)
  }
}
