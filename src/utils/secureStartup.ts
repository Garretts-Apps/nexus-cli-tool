/**
 * Secure Startup Utilities
 *
 * Sanitizes sensitive environment variables at startup to prevent
 * credential exposure via /proc/environ (same-UID process vulnerability).
 */

// Cache credentials in memory before deleting from process.env
const CACHED_CREDENTIALS = new Map<string, string | undefined>()

const SENSITIVE_VARS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_API_KEY',
  'AWS_SECRET_ACCESS_KEY',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'NEXUS_API_KEY',
]

/**
 * Remove sensitive credentials from process.env at startup
 *
 * This prevents API keys and tokens from being readable by other
 * same-UID processes through /proc/[pid]/environ.
 * Credentials are cached in memory first to maintain usability.
 */
export function sanitizeProcessEnv(): void {
  // Cache credentials before deleting
  for (const key of SENSITIVE_VARS) {
    if (key in process.env) {
      CACHED_CREDENTIALS.set(key, process.env[key])
      delete process.env[key]
    }
  }
}

/**
 * Get a cached credential value
 * @internal Use this instead of process.env for sensitive values
 */
export function getCachedCredential(key: string): string | undefined {
  return CACHED_CREDENTIALS.get(key)
}

/**
 * Verify that sensitive env vars are not exposed
 * Called as a safety check to ensure sanitization was successful
 */
export function verifySanitization(): boolean {
  for (const key of SENSITIVE_VARS) {
    if (key in process.env) {
      console.warn(`WARNING: Sensitive variable ${key} still in process.env`)
      return false
    }
  }

  return true
}

/**
 * Initialize secure environment at startup
 * Should be called early in main.ts before any API operations
 */
export function initializeSecureEnvironment(): void {
  sanitizeProcessEnv()
  verifySanitization()
}
