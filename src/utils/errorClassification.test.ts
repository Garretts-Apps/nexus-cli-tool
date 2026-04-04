import { describe, it, expect, vi } from 'vitest'
import {
  isExpectedError,
  getErrorMessage,
  tryOrLog,
  trySyncOrLog,
} from './errorClassification.js'

describe('getErrorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(getErrorMessage(new Error('test error'))).toBe('test error')
  })

  it('returns string errors as-is', () => {
    expect(getErrorMessage('string error')).toBe('string error')
  })

  it('extracts message from plain object with message property', () => {
    expect(getErrorMessage({ message: 'obj error' })).toBe('obj error')
  })

  it('stringifies non-standard error types', () => {
    expect(getErrorMessage(42)).toBe('42')
    expect(getErrorMessage(null)).toBe('null')
    expect(getErrorMessage(undefined)).toBe('undefined')
    expect(getErrorMessage(true)).toBe('true')
  })
})

describe('isExpectedError', () => {
  it('returns true for falsy errors', () => {
    expect(isExpectedError(null)).toBe(true)
    expect(isExpectedError(undefined)).toBe(true)
    expect(isExpectedError(0)).toBe(true)
    expect(isExpectedError('')).toBe(true)
  })

  it.each([
    ['ENOENT errors', new Error('ENOENT: no such file')],
    ['EACCES errors', new Error('EACCES: permission denied')],
    ['EEXIST errors', new Error('EEXIST: file already exists')],
    ['cancelled errors', new Error('Operation cancelled')],
    ['abort errors', new Error('Request aborted')],
  ])('returns true for %s', (_, err) => {
    expect(isExpectedError(err)).toBe(true)
  })

  it('returns true for timeout errors', () => {
    expect(isExpectedError(new Error('Connection timeout'))).toBe(true)
    expect(isExpectedError('Request Timeout')).toBe(true)
  })

  it('returns true for network errors', () => {
    expect(isExpectedError(new Error('network error'))).toBe(true)
    expect(isExpectedError(new Error('connection disconnected'))).toBe(true)
    expect(isExpectedError(new Error('socket closed'))).toBe(true)
  })

  it('returns false for unexpected errors', () => {
    expect(isExpectedError(new Error('TypeError: cannot read property'))).toBe(false)
    expect(isExpectedError(new Error('RangeError: out of bounds'))).toBe(false)
    expect(isExpectedError(new Error('Something went wrong'))).toBe(false)
  })
})

describe('tryOrLog', () => {
  it('returns the result of a successful operation', async () => {
    const result = await tryOrLog(async () => 'success', 'test')
    expect(result).toBe('success')
  })

  it('returns false when operation throws an unexpected error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

    const result = await tryOrLog(async () => {
      throw new Error('unexpected failure')
    }, 'test-context')

    expect(result).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(
      'Unexpected error in test-context: unexpected failure',
    )

    warnSpy.mockRestore()
    debugSpy.mockRestore()
  })

  it('returns false silently for expected errors', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await tryOrLog(async () => {
      throw new Error('ENOENT: no such file')
    }, 'test-context')

    expect(result).toBe(false)
    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })
})

describe('trySyncOrLog', () => {
  it('returns the result of a successful operation', () => {
    const result = trySyncOrLog(() => 42, 'test')
    expect(result).toBe(42)
  })

  it('returns false when operation throws an unexpected error', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

    const result = trySyncOrLog(() => {
      throw new Error('unexpected sync failure')
    }, 'sync-context')

    expect(result).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(
      'Unexpected error in sync-context: unexpected sync failure',
    )

    warnSpy.mockRestore()
    debugSpy.mockRestore()
  })

  it('returns false silently for expected errors', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = trySyncOrLog(() => {
      throw new Error('Operation cancelled by user')
    }, 'sync-context')

    expect(result).toBe(false)
    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })
})
