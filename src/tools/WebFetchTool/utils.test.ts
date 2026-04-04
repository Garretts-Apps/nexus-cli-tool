import { describe, it, expect, vi } from 'vitest'

// Mock heavy external deps so vitest can load utils.ts in isolation
vi.mock('axios', () => ({ default: { get: vi.fn(), isAxiosError: vi.fn() }, isAxiosError: vi.fn() }))
vi.mock('lru-cache', () => ({
  LRUCache: class { get() {} set() {} has() {} clear() {} },
}))
vi.mock('../../services/analytics/index.js', () => ({ logEvent: vi.fn() }))
vi.mock('../../services/api/claude.js', () => ({ queryHaiku: vi.fn() }))
vi.mock('../../utils/errors.js', () => ({ AbortError: class extends Error {} }))
vi.mock('../../utils/http.js', () => ({ getWebFetchUserAgent: () => 'test' }))
vi.mock('../../utils/log.js', () => ({ logError: vi.fn() }))
vi.mock('../../utils/mcpOutputStorage.js', () => ({
  isBinaryContentType: () => false,
  persistBinaryContent: vi.fn(),
}))
vi.mock('../../utils/settings/settings.js', () => ({
  getSettings_DEPRECATED: () => ({}),
}))
vi.mock('../../utils/systemPromptType.js', () => ({ asSystemPrompt: () => '' }))
vi.mock('./preapproved.js', () => ({ isPreapprovedHost: () => false }))
vi.mock('./prompt.js', () => ({ makeSecondaryModelPrompt: () => '' }))
vi.mock('turndown', () => ({ default: class { turndown() { return '' } } }))

import { validateURL } from './utils.js'

describe('validateURL', () => {
  // --- Dynamic long-URL test (keep standalone) ---
  it('rejects URLs exceeding max length', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2000)
    expect(validateURL(longUrl)).toBe(false)
  })

  // --- Rejected URLs (false cases) ---
  it.each([
    'not-a-url',
    'https://user:pass@example.com',
    'https://localhost/admin',
    'https://evil.localhost/admin',
    'https://127.0.0.1/',
    'https://127.255.255.255/',
    'https://[::1]/',
    'https://169.254.169.254/latest/meta-data/',
    'https://169.254.1.1/',
    'https://10.0.0.1/',
    'https://10.255.255.255/',
    'https://172.16.0.1/',
    'https://172.31.255.255/',
    'https://192.168.0.1/',
    'https://192.168.255.255/',
    'https://0.0.0.0/',
    'https://[::]/',
    'https://[fc00::1]/',
    'https://[fd12:3456:789a::1]/',
    'https://[fe80::1]/',
    'https://[::ffff:127.0.0.1]/',
    'https://[::ffff:10.0.0.1]/',
    'https://[::ffff:192.168.1.1]/',
    'https://[::ffff:169.254.169.254]/',
    'https://[::ffff:172.16.0.1]/',
    'https://intranet/',
  ])('rejects %s', (url) => {
    expect(validateURL(url)).toBe(false)
  })

  // --- Accepted URLs (true cases) ---
  it.each([
    'https://example.com/page',
    'http://example.com/page',
    'https://172.15.0.1/',
    'https://172.32.0.1/',
    'https://www.google.com/',
    'https://facebook.com/',
    'https://fdroid.org/',
  ])('accepts %s', (url) => {
    expect(validateURL(url)).toBe(true)
  })
})
