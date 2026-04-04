/**
 * Test Helpers
 *
 * Factory functions for creating test data objects.
 * These provide minimal valid structures matching the codebase types.
 */

import type { UUID } from 'crypto'

/**
 * Create a minimal user message for testing.
 */
export function createTestUserMessage(
  content: string = 'test message',
  overrides: Record<string, unknown> = {},
) {
  return {
    type: 'user' as const,
    uuid: '00000000-0000-0000-0000-000000000001' as UUID,
    message: {
      role: 'user' as const,
      content,
    },
    ...overrides,
  }
}

/**
 * Create a minimal assistant message for testing.
 */
export function createTestAssistantMessage(
  content: string = 'assistant response',
  overrides: Record<string, unknown> = {},
) {
  return {
    type: 'assistant' as const,
    uuid: '00000000-0000-0000-0000-000000000002' as UUID,
    message: {
      role: 'assistant' as const,
      content: [{ type: 'text' as const, text: content }],
    },
    costUSD: 0,
    durationMs: 0,
    ...overrides,
  }
}

/**
 * Create a test UUID string.
 */
export function createTestUUID(index: number = 1): UUID {
  const hex = index.toString(16).padStart(12, '0')
  return `00000000-0000-0000-0000-${hex}` as UUID
}

/**
 * Create a test session config object.
 */
export function createTestSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-session-001',
    cwd: '/test/project',
    model: 'test-model',
    ...overrides,
  }
}
