/**
 * StreamStatus - real-time stream event counter with abort control.
 *
 * Shows:
 *   - Whether a stream is currently active (connected / idle)
 *   - Cumulative event count for the current stream
 *   - Whether the stream is backed by the abstraction layer or direct SDK
 *   - An inline [X] abort hint when the stream is live
 *
 * Color coding:
 *   green  = stream active and healthy
 *   yellow = stream active but slow / stalled
 *   dim    = idle (no active stream)
 */

import figures from 'figures'
import * as React from 'react'
import { useCallback, useState } from 'react'
import { Box, Text, useInterval } from '../ink.js'

export type StreamBackend = 'abstraction-layer' | 'direct-sdk' | 'unknown'

export type StreamState = {
  /** Is a stream currently open? */
  active: boolean
  /** Cumulative events received on the current stream. */
  eventCount: number
  /** Events received per second (rolling window). */
  eventsPerSec?: number
  /** Which backend is serving the stream. */
  backend: StreamBackend
  /** Abort handle — called when the user presses the abort shortcut. */
  onAbort?: () => void
}

type StalledLevel = 'none' | 'stalled'

function detectStalled(eventsPerSec?: number): StalledLevel {
  if (eventsPerSec === undefined) return 'none'
  return eventsPerSec < 0.5 ? 'stalled' : 'none'
}

const BACKEND_LABEL: Record<StreamBackend, string> = {
  'abstraction-layer': 'LLM abstraction layer',
  'direct-sdk': 'direct SDK',
  unknown: 'unknown backend',
}

type Props = {
  /**
   * Current stream state. When undefined the component shows an idle indicator.
   */
  streamState?: StreamState
  /**
   * Poll interval for internal ticker animation (ms).
   * @default 500
   */
  pollInterval?: number | null
  /**
   * Keyboard shortcut label shown next to the abort button.
   * @default 'Ctrl+C'
   */
  abortShortcut?: string
}

/** Rotating spinner frames for active stream indicator. */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function StreamStatus({
  streamState,
  pollInterval = 500,
  abortShortcut = 'Ctrl+C',
}: Props): React.ReactNode {
  const [frame, setFrame] = useState(0)

  useInterval(() => {
    setFrame(f => (f + 1) % SPINNER_FRAMES.length)
  }, streamState?.active ? pollInterval : null)

  const handleAbort = useCallback(() => {
    streamState?.onAbort?.()
  }, [streamState])

  // Idle state
  if (!streamState?.active) {
    return (
      <Box flexDirection="row" gap={1}>
        <Text dimColor>{figures.circle}</Text>
        <Text dimColor>Stream idle</Text>
      </Box>
    )
  }

  const { eventCount, eventsPerSec, backend } = streamState
  const stalledLevel = detectStalled(eventsPerSec)
  const isStalled = stalledLevel === 'stalled'
  const streamColor = isStalled ? 'warning' : 'success'
  const spinner = SPINNER_FRAMES[frame]

  return (
    <Box flexDirection="column" gap={0}>
      {/* Active stream header */}
      <Box flexDirection="row" gap={1}>
        <Text color={streamColor}>{spinner}</Text>
        <Text color={streamColor} bold>
          Stream active
        </Text>
        {isStalled && (
          <Text color="warning"> — stalled ({eventsPerSec?.toFixed(1) ?? '0'} ev/s)</Text>
        )}
      </Box>

      {/* Stats row */}
      <Box flexDirection="row" gap={2} paddingLeft={2}>
        {/* Event count */}
        <Box flexDirection="row" gap={1}>
          <Text dimColor>Events:</Text>
          <Text bold>{eventCount}</Text>
        </Box>

        {/* Throughput */}
        {eventsPerSec !== undefined && (
          <Box flexDirection="row" gap={1}>
            <Text dimColor>Rate:</Text>
            <Text color={streamColor}>{eventsPerSec.toFixed(1)}/s</Text>
          </Box>
        )}

        {/* Backend indicator */}
        <Box flexDirection="row" gap={1}>
          <Text dimColor>via</Text>
          <Text dimColor italic>
            {BACKEND_LABEL[backend]}
          </Text>
        </Box>
      </Box>

      {/* Abort control */}
      {streamState.onAbort && (
        <Box paddingLeft={2} paddingTop={0}>
          <Text dimColor>
            <Text bold dimColor={false} color="error">
              [X]
            </Text>
            {' '}Press{' '}
            <Text bold>{abortShortcut}</Text>
            {' '}to abort stream
          </Text>
        </Box>
      )}
    </Box>
  )
}

/**
 * Hook: creates and manages a StreamState object wired to an AbortController.
 *
 * @example
 *   const [streamState, startStream, endStream] = useStreamState()
 *   // pass streamState to <StreamStatus streamState={streamState} />
 */
export function useStreamState(): [
  StreamState,
  (backend?: StreamBackend) => AbortController,
  () => void,
  (delta: number) => void,
] {
  const [state, setState] = useState<StreamState>({
    active: false,
    eventCount: 0,
    backend: 'unknown',
  })

  const abortRef = React.useRef<AbortController | null>(null)

  const startStream = useCallback((backend: StreamBackend = 'unknown'): AbortController => {
    const controller = new AbortController()
    abortRef.current = controller
    setState({
      active: true,
      eventCount: 0,
      backend,
      onAbort: () => {
        controller.abort()
        setState(prev => ({ ...prev, active: false }))
      },
    })
    return controller
  }, [])

  const endStream = useCallback(() => {
    abortRef.current = null
    setState(prev => ({ ...prev, active: false, onAbort: undefined }))
  }, [])

  const addEvent = useCallback((delta: number = 1) => {
    setState(prev => ({
      ...prev,
      eventCount: prev.eventCount + delta,
    }))
  }, [])

  return [state, startStream, endStream, addEvent]
}
