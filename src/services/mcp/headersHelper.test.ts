import { describe, it, expect, vi } from 'vitest'

// Mock all deps
vi.mock('../../bootstrap/state.js', () => ({
  getIsNonInteractiveSession: () => false,
  getSessionBypassPermissionsMode: () => false,
}))
vi.mock('../../utils/config.js', () => ({
  checkHasTrustDialogAccepted: () => true,
}))
vi.mock('../../utils/debug.js', () => ({ logAntError: vi.fn() }))
vi.mock('../../utils/errors.js', () => ({ errorMessage: (e: Error) => e.message }))

const mockExecFileNoThrow = vi.fn()
vi.mock('../../utils/execFileNoThrow.js', () => ({
  execFileNoThrowWithCwd: (...args: unknown[]) => mockExecFileNoThrow(...args),
}))
vi.mock('../../utils/log.js', () => ({
  logError: vi.fn(),
  logMCPDebug: vi.fn(),
  logMCPError: vi.fn(),
}))
vi.mock('../../utils/slowOperations.js', () => ({
  jsonParse: (s: string) => JSON.parse(s),
}))
vi.mock('../analytics/index.js', () => ({ logEvent: vi.fn() }))
vi.mock('../../utils/authValidation.js', () => ({
  validateHelperPath: (p: string) => p,
}))

import { getMcpHeadersFromHelper } from './headersHelper.js'

describe('getMcpHeadersFromHelper', () => {
  it('returns null when no headersHelper is configured', async () => {
    const result = await getMcpHeadersFromHelper('test-server', {
      type: 'sse',
      url: 'https://example.com',
    } as any)
    expect(result).toBeNull()
  })

  // SEC-006: Verify that only minimal env vars are passed to the helper subprocess
  it('passes only PATH, HOME, and MCP context vars to helper (no process.env leak)', async () => {
    mockExecFileNoThrow.mockResolvedValueOnce({
      code: 0,
      stdout: '{"Authorization": "Bearer token123"}',
      stderr: '',
    })

    await getMcpHeadersFromHelper('test-server', {
      type: 'sse',
      url: 'https://example.com/mcp',
      headersHelper: '/usr/bin/my-helper',
    } as any)

    expect(mockExecFileNoThrow).toHaveBeenCalledTimes(1)
    const callArgs = mockExecFileNoThrow.mock.calls[0]

    // First arg: helper path
    expect(callArgs[0]).toBe('/usr/bin/my-helper')

    // Second arg: empty args array
    expect(callArgs[1]).toEqual([])

    // Third arg: options including env
    const options = callArgs[2]
    expect(options.shell).toBe(false)

    // SEC-006 critical assertion: env must contain ONLY these keys
    const envKeys = Object.keys(options.env).sort()
    expect(envKeys).toEqual([
      'CLAUDE_CODE_MCP_SERVER_NAME',
      'CLAUDE_CODE_MCP_SERVER_URL',
      'HOME',
      'PATH',
    ])

    // Verify no ANTHROPIC_API_KEY or other secrets
    expect(options.env).not.toHaveProperty('ANTHROPIC_API_KEY')
    expect(options.env).not.toHaveProperty('AWS_SECRET_ACCESS_KEY')
    expect(options.env).not.toHaveProperty('GITHUB_TOKEN')

    // Verify specific values
    expect(options.env.CLAUDE_CODE_MCP_SERVER_NAME).toBe('test-server')
    expect(options.env.CLAUDE_CODE_MCP_SERVER_URL).toBe('https://example.com/mcp')
  })

  it('returns parsed headers on success', async () => {
    mockExecFileNoThrow.mockResolvedValueOnce({
      code: 0,
      stdout: '{"Authorization": "Bearer abc"}',
      stderr: '',
    })

    const result = await getMcpHeadersFromHelper('test-server', {
      type: 'sse',
      url: 'https://example.com',
      headersHelper: '/usr/bin/helper',
    } as any)

    expect(result).toEqual({ Authorization: 'Bearer abc' })
  })

  it('returns null when helper exits non-zero', async () => {
    mockExecFileNoThrow.mockResolvedValueOnce({
      code: 1,
      stdout: '',
      stderr: 'error',
    })

    const result = await getMcpHeadersFromHelper('test-server', {
      type: 'sse',
      url: 'https://example.com',
      headersHelper: '/usr/bin/helper',
    } as any)

    expect(result).toBeNull()
  })
})
