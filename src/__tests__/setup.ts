/**
 * Test Setup
 *
 * Global test configuration and shared mock implementations.
 * Import this file in test suites that need common mocks.
 */

import { vi } from 'vitest'

/**
 * Mock for getCwd() used by path utilities.
 * Override in individual tests via vi.mocked(getCwd).mockReturnValue(...)
 */
export function mockGetCwd(cwd: string = '/test/project') {
  vi.doMock('../utils/cwd.js', () => ({
    getCwd: vi.fn(() => cwd),
  }))
}

/**
 * Mock for platform detection.
 */
export function mockPlatform(platform: 'darwin' | 'linux' | 'windows' = 'darwin') {
  vi.doMock('../utils/platform.js', () => ({
    getPlatform: vi.fn(() => platform),
  }))
}

/**
 * Mock for filesystem operations used by path utilities.
 */
export function mockFsImplementation() {
  vi.doMock('../utils/fsOperations.js', () => ({
    getFsImplementation: vi.fn(() => ({
      cwd: () => '/test/project',
      statSync: vi.fn(() => ({ isDirectory: () => false })),
    })),
  }))
}
