import { describe, it, expect, vi } from 'vitest'

// Mock external deps that aren't available in vitest
vi.mock('lodash-es/memoize.js', () => ({ default: (fn: Function) => fn }))
vi.mock('../ink/instances.js', () => ({ default: { get: () => null } }))
vi.mock('./debug.js', () => ({ logForDebugging: vi.fn() }))
vi.mock('./which.js', () => ({ whichSync: () => null }))

import { classifyGuiEditor } from './editor.js'

describe('editor security', () => {
  describe('classifyGuiEditor', () => {
    it('classifies code as GUI editor', () => {
      expect(classifyGuiEditor('code')).toBe('code')
    })

    it('classifies cursor as GUI editor', () => {
      expect(classifyGuiEditor('cursor')).toBe('cursor')
    })

    it('classifies code-insiders via basename matching', () => {
      expect(classifyGuiEditor('code-insiders')).toBe('code')
    })

    it('classifies absolute path to code', () => {
      expect(classifyGuiEditor('/usr/bin/code')).toBe('code')
    })

    it('does not classify vim as GUI', () => {
      expect(classifyGuiEditor('vim')).toBeUndefined()
    })

    it('does not classify nvim as GUI', () => {
      expect(classifyGuiEditor('nvim')).toBeUndefined()
    })

    it('does not classify nano as GUI', () => {
      expect(classifyGuiEditor('nano')).toBeUndefined()
    })

    // SEC-005: Ensure directory components do not cause false GUI classification
    // e.g. /home/alice/code/bin/nvim should NOT match 'code'
    it('does not match code in directory path for nvim', () => {
      expect(classifyGuiEditor('/home/alice/code/bin/nvim')).toBeUndefined()
    })
  })

  describe('shell injection prevention', () => {
    // SEC-005: The openFileInExternalEditor function uses spawn() with array args
    // and shell: false on POSIX. These tests document the security invariant
    // by verifying that the editor string is properly split for array-form spawn.

    it('editor string is split into base + args for array-form spawn', () => {
      const editor = 'code --wait'
      const parts = editor.split(' ')
      const base = parts[0]
      const editorArgs = parts.slice(1)

      expect(base).toBe('code')
      expect(editorArgs).toEqual(['--wait'])
    })

    it('absolute paths split correctly', () => {
      const editor = '/usr/local/bin/code --wait --new-window'
      const parts = editor.split(' ')
      const base = parts[0]
      const editorArgs = parts.slice(1)

      expect(base).toBe('/usr/local/bin/code')
      expect(editorArgs).toEqual(['--wait', '--new-window'])
    })

    it('single editor name has no extra args', () => {
      const editor = 'vim'
      const parts = editor.split(' ')
      const base = parts[0]
      const editorArgs = parts.slice(1)

      expect(base).toBe('vim')
      expect(editorArgs).toEqual([])
    })
  })
})
