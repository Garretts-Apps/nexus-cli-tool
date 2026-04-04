/**
 * Error Classification and Logging
 *
 * Utilities to classify errors as expected or unexpected, and log
 * unexpected errors for visibility. This prevents silent failures.
 */

/**
 * Expected error patterns that should not be logged as warnings
 */
const EXPECTED_ERROR_PATTERNS = [
  /^ENOENT/, // File not found
  /^EACCES/, // Permission denied
  /^EEXIST/, // File/dir already exists
  /timeout/i, // Timeout errors
  /cancelled/i, // User cancelled
  /abort/i, // Aborted operation
  /network|disconnect|closed/i, // Network errors
]

/**
 * Classify whether an error is expected (normal operation) or unexpected (potential bug)
 * @param error - The error to classify
 * @returns true if the error is expected, false if it should be logged as unexpected
 */
export function isExpectedError(error: unknown): boolean {
  if (!error) return true // No error is "expected"

  const message = getErrorMessage(error)

  // Check if error matches expected patterns
  return EXPECTED_ERROR_PATTERNS.some(pattern => pattern.test(message))
}

/**
 * Extract error message from any error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as Record<string, unknown>).message)
  }
  return String(error)
}

/**
 * Try an operation and log if an unexpected error occurs
 * @param operation - Function to execute
 * @param context - Context for logging (file, function name, etc.)
 * @returns Result of operation or false if error occurs
 */
export async function tryOrLog<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T | false> {
  try {
    return await operation()
  } catch (error) {
    if (!isExpectedError(error)) {
      const message = getErrorMessage(error)
      console.warn(`Unexpected error in ${context}: ${message}`)
      if (error instanceof Error && error.stack) {
        console.debug(error.stack)
      }
    }
    return false
  }
}

/**
 * Try a sync operation and log if an unexpected error occurs
 * @param operation - Function to execute
 * @param context - Context for logging (file, function name, etc.)
 * @returns Result of operation or false if error occurs
 */
export function trySyncOrLog<T>(
  operation: () => T,
  context: string,
): T | false {
  try {
    return operation()
  } catch (error) {
    if (!isExpectedError(error)) {
      const message = getErrorMessage(error)
      console.warn(`Unexpected error in ${context}: ${message}`)
      if (error instanceof Error && error.stack) {
        console.debug(error.stack)
      }
    }
    return false
  }
}
