import { describe, it, expect } from 'vitest'
import {
  escapeRegExp,
  capitalize,
  plural,
  firstLineOf,
  countCharInString,
  normalizeFullWidthDigits,
} from './stringUtils.js'

describe('escapeRegExp', () => {
  it('escapes special regex characters', () => {
    expect(escapeRegExp('hello.world')).toBe('hello\\.world')
    expect(escapeRegExp('foo*bar')).toBe('foo\\*bar')
    expect(escapeRegExp('a+b')).toBe('a\\+b')
    expect(escapeRegExp('(test)')).toBe('\\(test\\)')
    expect(escapeRegExp('[brackets]')).toBe('\\[brackets\\]')
    expect(escapeRegExp('{braces}')).toBe('\\{braces\\}')
    expect(escapeRegExp('a|b')).toBe('a\\|b')
    expect(escapeRegExp('end$')).toBe('end\\$')
    expect(escapeRegExp('^start')).toBe('\\^start')
    expect(escapeRegExp('back\\slash')).toBe('back\\\\slash')
    expect(escapeRegExp('question?')).toBe('question\\?')
  })

  it('returns plain strings unchanged', () => {
    expect(escapeRegExp('hello')).toBe('hello')
    expect(escapeRegExp('')).toBe('')
  })

  it('works correctly when used in RegExp', () => {
    const special = 'file.name (1).txt'
    const escaped = escapeRegExp(special)
    const regex = new RegExp(escaped)
    expect(regex.test(special)).toBe(true)
    expect(regex.test('filexname (1)xtxt')).toBe(false)
  })
})

describe('capitalize', () => {
  it('uppercases the first character', () => {
    expect(capitalize('hello')).toBe('Hello')
    expect(capitalize('fooBar')).toBe('FooBar')
  })

  it('does not lowercase remaining characters', () => {
    expect(capitalize('hELLO')).toBe('HELLO')
  })

  it('handles single character strings', () => {
    expect(capitalize('a')).toBe('A')
  })

  it('handles empty string', () => {
    expect(capitalize('')).toBe('')
  })
})

describe('plural', () => {
  it('returns singular for count of 1', () => {
    expect(plural(1, 'file')).toBe('file')
  })

  it('returns plural for count != 1', () => {
    expect(plural(0, 'file')).toBe('files')
    expect(plural(2, 'file')).toBe('files')
    expect(plural(100, 'file')).toBe('files')
  })

  it('uses custom plural form when provided', () => {
    expect(plural(2, 'entry', 'entries')).toBe('entries')
    expect(plural(1, 'entry', 'entries')).toBe('entry')
  })
})

describe('firstLineOf', () => {
  it('returns the first line of a multi-line string', () => {
    expect(firstLineOf('first\nsecond\nthird')).toBe('first')
  })

  it('returns the full string if no newline', () => {
    expect(firstLineOf('single line')).toBe('single line')
  })

  it('handles empty string', () => {
    expect(firstLineOf('')).toBe('')
  })

  it('handles string starting with newline', () => {
    expect(firstLineOf('\nsecond')).toBe('')
  })
})

describe('countCharInString', () => {
  it('counts occurrences of a character', () => {
    expect(countCharInString('hello world', 'l')).toBe(3)
    expect(countCharInString('hello world', 'o')).toBe(2)
    expect(countCharInString('hello world', ' ')).toBe(1)
  })

  it('returns 0 when character not found', () => {
    expect(countCharInString('hello', 'z')).toBe(0)
  })

  it('handles empty string', () => {
    expect(countCharInString('', 'a')).toBe(0)
  })

  it('counts from a start position', () => {
    expect(countCharInString('aabaa', 'a', 2)).toBe(2)
  })
})

describe('normalizeFullWidthDigits', () => {
  it('converts full-width digits to half-width', () => {
    expect(normalizeFullWidthDigits('０１２３４５６７８９')).toBe('0123456789')
  })

  it('leaves half-width digits unchanged', () => {
    expect(normalizeFullWidthDigits('0123456789')).toBe('0123456789')
  })

  it('handles mixed content', () => {
    expect(normalizeFullWidthDigits('テスト１２３test')).toBe('テスト123test')
  })

  it('handles empty string', () => {
    expect(normalizeFullWidthDigits('')).toBe('')
  })
})
