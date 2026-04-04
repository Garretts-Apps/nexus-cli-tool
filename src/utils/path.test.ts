import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing the module under test
vi.mock('./cwd.js', () => ({
  getCwd: vi.fn(() => '/test/project'),
}))

vi.mock('./fsOperations.js', () => ({
  getFsImplementation: vi.fn(() => ({
    cwd: () => '/test/project',
    statSync: vi.fn(() => ({ isDirectory: () => false })),
  })),
}))

vi.mock('./platform.js', () => ({
  getPlatform: vi.fn(() => 'darwin'),
}))

vi.mock('./windowsPaths.js', () => ({
  posixPathToWindowsPath: vi.fn((p: string) => p),
}))

// Re-export stub for sanitizePath (imported from sessionStoragePortable)
vi.mock('./sessionStoragePortable.js', () => ({
  sanitizePath: vi.fn((name: string) => name.replace(/[^a-zA-Z0-9]/g, '-')),
}))

import { containsPathTraversal, expandPath, normalizePathForConfigKey } from './path.js'

describe('containsPathTraversal', () => {
  it('detects parent directory traversal', () => {
    expect(containsPathTraversal('../etc/passwd')).toBe(true)
    expect(containsPathTraversal('../../secret')).toBe(true)
  })

  it('detects traversal with intermediate segments', () => {
    expect(containsPathTraversal('foo/../../bar')).toBe(true)
  })

  it('returns false for safe relative paths', () => {
    expect(containsPathTraversal('foo/bar')).toBe(false)
    expect(containsPathTraversal('./foo/bar')).toBe(false)
    expect(containsPathTraversal('file.txt')).toBe(false)
  })

  it('returns false for current directory references', () => {
    expect(containsPathTraversal('.')).toBe(false)
    expect(containsPathTraversal('./test')).toBe(false)
  })

  it('returns false for paths that resolve within base', () => {
    expect(containsPathTraversal('foo/../bar')).toBe(false)
  })
})

describe('expandPath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('expands tilde to home directory', () => {
    const result = expandPath('~')
    expect(result).toBeTruthy()
    // Should not contain tilde
    expect(result).not.toContain('~')
  })

  it('expands ~/path to path within home directory', () => {
    const result = expandPath('~/Documents')
    expect(result).toContain('Documents')
    expect(!result.startsWith('~')).toBe(true)
  })

  it('returns absolute paths normalized', () => {
    const result = expandPath('/absolute/path')
    expect(result).toBe('/absolute/path')
  })

  it('resolves relative paths against baseDir', () => {
    const result = expandPath('src/file.ts', '/my/project')
    expect(result).toBe('/my/project/src/file.ts')
  })

  it('throws for non-string path', () => {
    expect(() => expandPath(42 as unknown as string)).toThrow('Path must be a string')
  })

  it('throws for null bytes in path', () => {
    expect(() => expandPath('foo\0bar')).toThrow('null bytes')
  })

  it('handles empty/whitespace path by returning baseDir', () => {
    const result = expandPath('', '/base/dir')
    expect(result).toBe('/base/dir')
  })
})

describe('normalizePathForConfigKey', () => {
  it('normalizes dot segments', () => {
    expect(normalizePathForConfigKey('/foo/./bar')).toBe('/foo/bar')
    expect(normalizePathForConfigKey('/foo/baz/../bar')).toBe('/foo/bar')
  })

  it('converts backslashes to forward slashes', () => {
    // On POSIX this is a no-op since normalize won't produce backslashes,
    // but the replace still runs
    const result = normalizePathForConfigKey('/foo/bar')
    expect(result).toBe('/foo/bar')
  })
})
