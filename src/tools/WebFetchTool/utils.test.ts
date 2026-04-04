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
  // --- Valid URLs that should pass ---
  it('accepts a valid HTTPS URL', () => {
    expect(validateURL('https://example.com/page')).toBe(true)
  })

  it('accepts a valid HTTP URL', () => {
    expect(validateURL('http://example.com/page')).toBe(true)
  })

  // --- Basic validation ---
  it('rejects URLs exceeding max length', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2000)
    expect(validateURL(longUrl)).toBe(false)
  })

  it('rejects invalid URL syntax', () => {
    expect(validateURL('not-a-url')).toBe(false)
  })

  it('rejects URLs with username/password', () => {
    expect(validateURL('https://user:pass@example.com')).toBe(false)
  })

  // --- SEC-003: SSRF prevention - Loopback ---
  it('blocks localhost', () => {
    expect(validateURL('https://localhost/admin')).toBe(false)
  })

  it('blocks subdomain of localhost', () => {
    expect(validateURL('https://evil.localhost/admin')).toBe(false)
  })

  it('blocks 127.0.0.1', () => {
    expect(validateURL('https://127.0.0.1/')).toBe(false)
  })

  it('blocks 127.x.x.x range', () => {
    expect(validateURL('https://127.255.255.255/')).toBe(false)
  })

  // --- SEC-003: SSRF prevention - IPv6 loopback ---
  it('blocks IPv6 loopback ::1', () => {
    expect(validateURL('https://[::1]/')).toBe(false)
  })

  // --- SEC-003: SSRF prevention - AWS IMDS ---
  it('blocks AWS IMDS 169.254.169.254', () => {
    expect(validateURL('https://169.254.169.254/latest/meta-data/')).toBe(false)
  })

  it('blocks entire 169.254.x.x link-local range', () => {
    expect(validateURL('https://169.254.1.1/')).toBe(false)
  })

  // --- SEC-003: SSRF prevention - RFC 1918 Class A (10.0.0.0/8) ---
  it('blocks 10.0.0.1', () => {
    expect(validateURL('https://10.0.0.1/')).toBe(false)
  })

  it('blocks 10.255.255.255', () => {
    expect(validateURL('https://10.255.255.255/')).toBe(false)
  })

  // --- SEC-003: SSRF prevention - RFC 1918 Class B (172.16.0.0/12) ---
  it('blocks 172.16.0.1', () => {
    expect(validateURL('https://172.16.0.1/')).toBe(false)
  })

  it('blocks 172.31.255.255', () => {
    expect(validateURL('https://172.31.255.255/')).toBe(false)
  })

  it('allows 172.15.0.1 (outside private range)', () => {
    expect(validateURL('https://172.15.0.1/')).toBe(true)
  })

  it('allows 172.32.0.1 (outside private range)', () => {
    expect(validateURL('https://172.32.0.1/')).toBe(true)
  })

  // --- SEC-003: SSRF prevention - RFC 1918 Class C (192.168.0.0/16) ---
  it('blocks 192.168.0.1', () => {
    expect(validateURL('https://192.168.0.1/')).toBe(false)
  })

  it('blocks 192.168.255.255', () => {
    expect(validateURL('https://192.168.255.255/')).toBe(false)
  })

  // --- SEC-003: SSRF prevention - Special addresses ---
  it('blocks 0.0.0.0', () => {
    expect(validateURL('https://0.0.0.0/')).toBe(false)
  })

  it('blocks IPv6 unspecified address ::', () => {
    expect(validateURL('https://[::]/')).toBe(false)
  })

  // --- SEC-003: SSRF prevention - IPv6 ULA (fc00::/7) ---
  it('blocks IPv6 ULA fc00::1', () => {
    expect(validateURL('https://[fc00::1]/')).toBe(false)
  })

  it('blocks IPv6 ULA fd12:3456:789a::1', () => {
    expect(validateURL('https://[fd12:3456:789a::1]/')).toBe(false)
  })

  // --- SEC-003: SSRF prevention - IPv6 link-local (fe80::/10) ---
  it('blocks IPv6 link-local fe80::1', () => {
    expect(validateURL('https://[fe80::1]/')).toBe(false)
  })

  // --- SEC-003: SSRF prevention - IPv4-mapped IPv6 ---
  it('blocks IPv4-mapped IPv6 ::ffff:127.0.0.1', () => {
    expect(validateURL('https://[::ffff:127.0.0.1]/')).toBe(false)
  })

  it('blocks IPv4-mapped IPv6 ::ffff:10.0.0.1', () => {
    expect(validateURL('https://[::ffff:10.0.0.1]/')).toBe(false)
  })

  it('blocks IPv4-mapped IPv6 ::ffff:192.168.1.1', () => {
    expect(validateURL('https://[::ffff:192.168.1.1]/')).toBe(false)
  })

  it('blocks IPv4-mapped IPv6 ::ffff:169.254.169.254', () => {
    expect(validateURL('https://[::ffff:169.254.169.254]/')).toBe(false)
  })

  it('blocks IPv4-mapped IPv6 ::ffff:172.16.0.1', () => {
    expect(validateURL('https://[::ffff:172.16.0.1]/')).toBe(false)
  })

  // --- Hostnames that should NOT be blocked ---
  it('allows regular domain names', () => {
    expect(validateURL('https://www.google.com/')).toBe(true)
  })

  it('allows domains starting with fc but not IPv6', () => {
    expect(validateURL('https://facebook.com/')).toBe(true)
  })

  it('allows domains starting with fd but not IPv6', () => {
    expect(validateURL('https://fdroid.org/')).toBe(true)
  })

  // --- Single-label hostnames ---
  it('blocks single-label hostnames (no dots)', () => {
    expect(validateURL('https://intranet/')).toBe(false)
  })
})
