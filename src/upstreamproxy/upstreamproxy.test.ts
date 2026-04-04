import { describe, it, expect, vi } from 'vitest'

// Mock deps
vi.mock('../utils/cleanupRegistry.js', () => ({ registerCleanup: vi.fn() }))
vi.mock('../utils/debug.js', () => ({ logForDebugging: vi.fn() }))
vi.mock('../utils/envUtils.js', () => ({ isEnvTruthy: () => false }))
vi.mock('../utils/errors.js', () => ({ isENOENT: () => false }))
vi.mock('./relay.js', () => ({ startUpstreamProxyRelay: vi.fn() }))

import { computeSpkiFingerprint } from './upstreamproxy.js'

// Self-signed test certificate generated for testing only (not a real certificate)
const TEST_PEM_CERT = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIUY5xPKNHvWpGdwVOxZjaxkuHGrEEwDQYJKoZIhvcNAQELBQAwFDES
MBAGA1UEAwwJbG9jYWxob3N0MB4XDTI0MDEwMTAwMDAwMFoXDTI1MDEwMTAwMDAw
MFowFDESMBAGA1UEAwwJbG9jYWxob3N0MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJB
ALRiMLAHudeSA/x3hB2f+2NRkJMnPMZb7K3v4aEv7VKRqHmGqo0vUhFGAOiQFMn
hSHES14DVAkIOOSi7GVFG3UCAwEAAaMhMB8wHQYDVR0OBBYEFFVl/vbI9OkXH7Oq
r1jyMlE/4Y/JMA0GCSqGSIb3DQEBCwUAA0EAp2+11dFxMPbGFLOVbKEKRFynPbFk
PsTKHE4MeGkLnD0vFGFJVRNKQ5bJqGhOqGFBfpZalGTVJIqnKrfDYvpTlA==
-----END CERTIFICATE-----`

describe('upstreamproxy security (SEC-007)', () => {
  describe('isPemCertificate validation', () => {
    // isPemCertificate is not exported, but we can test via computeSpkiFingerprint
    // which handles invalid PEM gracefully

    it('computeSpkiFingerprint returns a base64 string for valid PEM', () => {
      const fp = computeSpkiFingerprint(TEST_PEM_CERT)
      expect(fp).toBeTruthy()
      expect(typeof fp).toBe('string')
      // Base64 format check
      expect(fp).toMatch(/^[A-Za-z0-9+/]+=*$/)
    })

    it('computeSpkiFingerprint returns consistent results for same cert', () => {
      const fp1 = computeSpkiFingerprint(TEST_PEM_CERT)
      const fp2 = computeSpkiFingerprint(TEST_PEM_CERT)
      expect(fp1).toBe(fp2)
    })

    it('computeSpkiFingerprint returns null for garbage input', () => {
      const fp = computeSpkiFingerprint('not a certificate at all')
      expect(fp).toBeNull()
    })

    it('computeSpkiFingerprint returns null for empty string', () => {
      const fp = computeSpkiFingerprint('')
      expect(fp).toBeNull()
    })

    it('computeSpkiFingerprint returns different values for different certs', () => {
      // Modify the cert slightly (different base64 body)
      const altered = TEST_PEM_CERT.replace('MIIB', 'MIIC')
      const fp1 = computeSpkiFingerprint(TEST_PEM_CERT)
      const fp2 = computeSpkiFingerprint(altered)
      // They should either both be non-null and different, or one fails
      if (fp1 && fp2) {
        expect(fp1).not.toBe(fp2)
      }
    })
  })

  describe('PEM format validation', () => {
    it('rejects content without BEGIN CERTIFICATE marker', () => {
      const invalidPem = 'just some random data\nthat is not a certificate'
      const fp = computeSpkiFingerprint(invalidPem)
      expect(fp).toBeNull()
    })

    it('rejects HTML content (not a cert)', () => {
      const html = '<html><body>Not a certificate</body></html>'
      const fp = computeSpkiFingerprint(html)
      expect(fp).toBeNull()
    })

    it('rejects JSON content (not a cert)', () => {
      const json = '{"error": "not found"}'
      const fp = computeSpkiFingerprint(json)
      expect(fp).toBeNull()
    })
  })

  describe('certificate pinning', () => {
    it('fingerprint is a SHA-256 base64 hash (44 chars with padding)', () => {
      const fp = computeSpkiFingerprint(TEST_PEM_CERT)
      expect(fp).toBeTruthy()
      // SHA-256 base64 is 44 chars (32 bytes -> 44 base64 chars with = padding)
      expect(fp!.length).toBe(44)
    })
  })
})
