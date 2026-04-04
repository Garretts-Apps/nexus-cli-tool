/**
 * Shared validation utilities for credential helper paths.
 *
 * Used by both src/utils/auth.ts and src/services/mcp/headersHelper.ts
 * to reject shell metacharacters before executing user-supplied helper paths.
 */

// Characters that have special meaning in shells and could enable injection attacks.
export const SHELL_METACHARACTERS = /[;&|`$<>()\n\r'"\\]/

/**
 * Validate that a helper path is a plain executable name and does not contain
 * shell metacharacters that could enable shell injection.
 *
 * @throws {Error} If the path is falsy or contains shell metacharacters.
 * @returns The validated path (unchanged).
 */
export function validateHelperPath(path: string | undefined): string {
  if (!path) throw new Error('Helper path is required')
  if (SHELL_METACHARACTERS.test(path)) {
    throw new Error(
      `Helper path contains shell metacharacters and was rejected for security reasons: ${path}`,
    )
  }
  return path
}
