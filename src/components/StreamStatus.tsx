/**
 * StreamStatus - real-time stream event counter with abort control.
 *
 * Shows:
 *   - Whether a stream is currently active (connected / idle)
 *   - Cumulative event count for the current stream
 *   - Whether the stream is backed by the abstraction layer or direct SDK
 *   - An inline abort hint when the stream is live
 *
 * Color coding:
 *   green  = stream active and healthy
 *   yellow = stream active but slow / stalled
 *   dim    = idle (no active stream)
 *
 * Design: idle state is a single compact line; active state expands to a
 * two-line layout — header with spinner + status badge, then a detail row
 * with event count, rate, and backend. Abort hint appears only when an
 * abort handler is wired up, keeping the idle state clean.
 */

import figures from 'figures'
import * as React from 'react'
import { useCallback, useState } from 'react'
import { Box, Text, useInterval } from '../ink.js'

// ─── types ───────────────────────────────────────────────────────────────────

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

type StalledLevel = 'healthy' | 'stalled'

// ─── constants ───────────────────────────────────────────────────────────────

/** Rotating braille spinner frames for the active stream indicator. */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const

const BACKEND_LABEL: Record<StreamBackend, string> = {
  'abstraction-layer': 'llm-layer',
  'direct-sdk': 'direct-sdk',
  unknown: 'unknown',
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function detectStalled(eventsPerSec?: number): StalledLevel {
  if (eventsPerSec === undefined) return 'healthy'
  return eventsPerSec < 0.5 ? 'stalled' : 'healthy'
}

// ─── sub-components ───────────────────────────────────────────────────────────

/** Idle indicator — a single dim line. */
function IdleIndicator(): React.ReactNode {
  return (
    <Box flexDirection="row" gap={1}>
      <Text dimColor>{figures.circle}</Text>
      <Text dimColor>stream idle</Text>
    </Box>
  )
}

/** Active stream header: spinner + status label + optional stall note. */
function ActiveHeader({
  spinner,
  streamColor,
  isStalled,
  eventsPerSec,
}: {
  spinner: string
  streamColor: 'success' | 'warning'
  isStalled: boolean
  eventsPerSec?: number
}): React.ReactNode {
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={streamColor}>{spinner}</Text>
      <Text color={streamColor} bold>
        stream active
      </Text>
      {isStalled && (
        <Text color="warning">
          — stalled ({eventsPerSec?.toFixed(1) ?? '0'} ev/s)
        </Text>
      )}
    </Box>
  )
}

/** Detail row: event count · rate · backend. */
function StreamDetailRow({
  eventCount,
  eventsPerSec,
  backend,
  streamColor,
}: {
  eventCount: number
  eventsPerSec?: number
  backend: StreamBackend
  streamColor: 'success' | 'warning'
}): React.ReactNode {
  return (
    <Box flexDirection="row" gap={3} paddingLeft={2}>
      <Box flexDirection="row" gap={1}>
        <Text dimColor>events</Text>
        <Text bold>{eventCount}</Text>
      </Box>

      {eventsPerSec !== undefined && (
        <Box flexDirection="row" gap={1}>
          <Text dimColor>rate</Text>
          <Text color={streamColor}>{eventsPerSec.toFixed(1)}/s</Text>
        </Box>
      )}

      <Box flexDirection="row" gap={1}>
        <Text dimColor>via</Text>
        <Text dimColor italic>
          {BACKEND_LABEL[backend]}
        </Text>
      </Box>
    </Box>
  )
}

/** Abort hint — only rendered when an onAbort handler is present. */
function AbortHint({ shortcut }: { shortcut: string }): React.ReactNode {
  return (
    <Box paddingLeft={2}>
      <Text dimColor>
        <Text bold color="error">[X]</Text>
        {' '}press <Text bold>{shortcut}</Text> to abort
      </Text>
    </Box>
  )
}

// ─── component ────────────────────────────────────────────────────────────────

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

export function StreamStatus({
  streamState,
  pollInterval = 500,
  abortShortcut = 'Ctrl+C',
}: Props): React.ReactNode {
  const [frame, setFrame] = useState(0)

  // Ticker only runs while the stream is active — avoids unnecessary renders
  // and prevents timer leaks when the component is kept mounted but idle.
  useInterval(() => {
    setFrame((f: number) => (f + 1) % SPINNER_FRAMES.length)
  }, streamState?.active ? pollInterval : null)

  const handleAbort = useCallback(() => {
    streamState?.onAbort?.()
  }, [streamState])

  // ── Idle state ──────────────────────────────────────────────────────────
  if (!streamState?.active) {
    return <IdleIndicator />
  }

  // ── Active state ─────────────────────────────────────────────────────────
  const { eventCount, eventsPerSec, backend, onAbort } = streamState
  const stalledLevel = detectStalled(eventsPerSec)
  const isStalled = stalledLevel === 'stalled'
  const streamColor: 'success' | 'warning' = isStalled ? 'warning' : 'success'
  const spinner = SPINNER_FRAMES[frame]!

  return (
    <Box flexDirection="column" gap={0}>
      <ActiveHeader
        spinner={spinner}
        streamColor={streamColor}
        isStalled={isStalled}
        eventsPerSec={eventsPerSec}
      />

      <StreamDetailRow
        eventCount={eventCount}
        eventsPerSec={eventsPerSec}
        backend={backend}
        streamColor={streamColor}
      />

      {onAbort != null && <AbortHint shortcut={abortShortcut} />}
    </Box>
  )
}

// ─── hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook: creates and manages a StreamState object wired to an AbortController.
 *
 * Returns a tuple of:
 *   [streamState, startStream, endStream, addEvent]
 *
 * @example
 *   const [streamState, startStream, endStream, addEvent] = useStreamState()
 *   // pass streamState to <StreamStatus streamState={streamState} />
 */
export function useStreamState(): [
  StreamState,
  (backend?: StreamBackend) => AbortController,
  () => void,
  (delta?: number) => void,
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
        setState((prev: StreamState) => ({ ...prev, active: false, onAbort: undefined }))
      },
    })
    return controller
  }, [])

  const endStream = useCallback(() => {
    abortRef.current = null
    setState((prev: StreamState) => ({ ...prev, active: false, onAbort: undefined }))
  }, [])

  const addEvent = useCallback((delta: number = 1) => {
    setState((prev: StreamState) => ({
      ...prev,
      eventCount: prev.eventCount + delta,
    }))
  }, [])

  return [state, startStream, endStream, addEvent]
}
