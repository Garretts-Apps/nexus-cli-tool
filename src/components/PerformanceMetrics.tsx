/**
 * PerformanceMetrics - LLM abstraction layer overhead and stream throughput.
 *
 * Overhead color coding:
 *   green  = 0 %       (no overhead — direct SDK path or noop telemetry)
 *   yellow = 1–10 %    (acceptable monitoring overhead)
 *   red    = > 10 %    (significant overhead — investigate)
 *
 * Throughput color coding:
 *   green  = ≥ 5 msgs/sec
 *   yellow = 1–5 msgs/sec
 *   red    = < 1 msg/sec
 */

import figures from 'figures'
import * as React from 'react'
import { useState } from 'react'
import { Box, Text, useInterval } from '../ink.js'
import { getTotalAPIDuration, getTotalDuration } from '../cost-tracker.js'

/** Compute abstraction-layer overhead as a fraction (0–1+). */
function computeOverheadFraction(): number {
  const total = getTotalDuration()
  const api = getTotalAPIDuration()
  if (total <= 0 || api <= 0) return 0
  // Overhead = (wall-clock - pure API time) / API time
  const overhead = (total - api) / api
  return Math.max(0, overhead)
}

type OverheadLevel = 'none' | 'low' | 'high'

function classifyOverhead(fraction: number): OverheadLevel {
  if (fraction < 0.005) return 'none' // < 0.5 % — noise floor
  if (fraction <= 0.1) return 'low'
  return 'high'
}

const OVERHEAD_COLOR: Record<OverheadLevel, 'success' | 'warning' | 'error'> = {
  none: 'success',
  low: 'warning',
  high: 'error',
}

const OVERHEAD_ICON: Record<OverheadLevel, string> = {
  none: figures.tick,
  low: figures.warning,
  high: figures.cross,
}

type ThroughputLevel = 'good' | 'moderate' | 'slow'

function classifyThroughput(msgsPerSec: number): ThroughputLevel {
  if (msgsPerSec >= 5) return 'good'
  if (msgsPerSec >= 1) return 'moderate'
  return 'slow'
}

const THROUGHPUT_COLOR: Record<ThroughputLevel, 'success' | 'warning' | 'error'> = {
  good: 'success',
  moderate: 'warning',
  slow: 'error',
}

type Props = {
  /**
   * Current stream messages/sec, if available from the parent.
   * When undefined the component shows "—" (no active stream).
   */
  streamMsgsPerSec?: number
  /** Poll interval in ms. @default 2000 */
  pollInterval?: number | null
}

export function PerformanceMetrics({
  streamMsgsPerSec,
  pollInterval = 2000,
}: Props): React.ReactNode {
  const [overheadFraction, setOverheadFraction] = useState<number>(computeOverheadFraction)

  useInterval(() => {
    setOverheadFraction(computeOverheadFraction())
  }, pollInterval)

  const overheadPct = (overheadFraction * 100).toFixed(1)
  const overheadLevel = classifyOverhead(overheadFraction)
  const overheadColor = OVERHEAD_COLOR[overheadLevel]
  const overheadIcon = OVERHEAD_ICON[overheadLevel]

  const hasStream = streamMsgsPerSec !== undefined
  const throughputLevel = hasStream ? classifyThroughput(streamMsgsPerSec!) : 'good'
  const throughputColor = hasStream ? THROUGHPUT_COLOR[throughputLevel] : undefined

  return (
    <Box flexDirection="column" gap={0}>
      {/* Header */}
      <Text bold>Performance</Text>

      {/* Overhead row */}
      <Box flexDirection="row" gap={1}>
        <Text dimColor>LLM abstraction overhead:</Text>
        <Text color={overheadColor}>
          {overheadIcon}{' '}
        </Text>
        <Text color={overheadColor} bold>
          {overheadLevel === 'none' ? '~0 %' : `${overheadPct} %`}
        </Text>
        {overheadLevel === 'none' && (
          <Text dimColor>  no overhead detected</Text>
        )}
        {overheadLevel === 'low' && (
          <Text dimColor>  monitoring overhead (acceptable)</Text>
        )}
        {overheadLevel === 'high' && (
          <Text dimColor>  high overhead — check OTel exporters</Text>
        )}
      </Box>

      {/* Throughput row */}
      <Box flexDirection="row" gap={1}>
        <Text dimColor>Stream throughput:</Text>
        {hasStream ? (
          <>
            <Text color={throughputColor} bold>
              {streamMsgsPerSec!.toFixed(1)} msgs/sec
            </Text>
            {throughputLevel === 'slow' && (
              <Text dimColor>  stream may be congested</Text>
            )}
          </>
        ) : (
          <Text dimColor>— no active stream</Text>
        )}
      </Box>

      {/* Raw timing row — only show when there is cost-tracker data */}
      {getTotalDuration() > 0 && (
        <Box flexDirection="row" gap={2} paddingTop={0}>
          <Box flexDirection="row" gap={1}>
            <Text dimColor>Wall time:</Text>
            <Text>{(getTotalDuration() / 1000).toFixed(2)} s</Text>
          </Box>
          <Box flexDirection="row" gap={1}>
            <Text dimColor>API time:</Text>
            <Text>{(getTotalAPIDuration() / 1000).toFixed(2)} s</Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}
