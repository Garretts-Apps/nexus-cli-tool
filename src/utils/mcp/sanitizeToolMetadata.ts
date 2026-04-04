/**
 * MCP Tool Metadata Sanitization
 *
 * Sanitizes tool descriptions and validates schemas to prevent
 * prompt injection and excessive context bloat.
 */

/**
 * Sanitize tool description for safe inclusion in model context.
 * Removes HTML, limits length, normalizes whitespace.
 *
 * @param desc - Original tool description (may contain user input)
 * @returns Sanitized description safe for model context
 */
export function sanitizeToolDescription(desc: string): string {
  if (!desc || typeof desc !== 'string') {
    return ''
  }

  return desc
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove multiple asterisks (markdown emphasis)
    .replace(/\*{2,}/g, '*')
    // Remove backticks (code formatting)
    .replace(/`{2,}/g, '`')
    // Normalize whitespace
    .trim()
    // Limit to 500 characters to prevent context bloat
    .substring(0, 500)
    .trim()
}

/**
 * Validate tool name format (alphanumeric, underscore, hyphen only).
 * Prevents injection of special characters that could cause issues.
 *
 * @param name - Tool name to validate
 * @returns Validated name or empty string if invalid
 */
export function validateToolName(name: unknown): string {
  if (typeof name !== 'string' || !name) {
    return ''
  }

  // Allow alphanumeric, underscore, hyphen; must start with letter/number
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '')

  // Limit length to 100 characters
  return sanitized.substring(0, 100)
}

/**
 * Validate and sanitize tool input schema.
 * Ensures schema is valid JSON and not excessively deep or large.
 *
 * @param schema - Input schema object (may be user-provided)
 * @returns Validated schema or empty object if invalid
 */
export function validateToolSchema(schema: unknown): Record<string, unknown> {
  // Must be an object
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return {}
  }

  // Check depth (max 10 levels)
  if (getObjectDepth(schema) > 10) {
    console.warn('Tool schema exceeds max depth, truncating')
    return {}
  }

  // Check size (max 100KB stringified)
  const stringified = JSON.stringify(schema)
  if (stringified.length > 102400) {
    console.warn('Tool schema exceeds max size, truncating')
    return {}
  }

  return schema as Record<string, unknown>
}

/**
 * Calculate object depth to detect excessively nested structures.
 * @internal
 */
function getObjectDepth(obj: unknown, maxDepth = 10, currentDepth = 0): number {
  if (currentDepth >= maxDepth) return maxDepth
  if (!obj || typeof obj !== 'object') return currentDepth

  if (Array.isArray(obj)) {
    return Math.max(...obj.map(item => getObjectDepth(item, maxDepth, currentDepth + 1)))
  }

  const values = Object.values(obj as Record<string, unknown>)
  if (values.length === 0) return currentDepth + 1

  return Math.max(...values.map(v => getObjectDepth(v, maxDepth, currentDepth + 1)))
}

/**
 * Sanitize complete MCP tool definition for safe inclusion in model context.
 *
 * @param tool - Tool definition with name, description, schema
 * @returns Sanitized tool with validated metadata
 */
export function sanitizeMCPToolDefinition(tool: {
  name?: unknown
  description?: unknown
  input_schema?: unknown
  [key: string]: unknown
}): {
  name: string
  description: string
  input_schema: Record<string, unknown>
  [key: string]: unknown
} {
  return {
    ...tool,
    name: validateToolName(tool.name),
    description: sanitizeToolDescription(
      typeof tool.description === 'string' ? tool.description : '',
    ),
    input_schema: validateToolSchema(tool.input_schema),
  }
}
