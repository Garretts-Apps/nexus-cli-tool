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
 *
 * Design: single-line header with inline badge; metric rows share a
 * consistent label/value/annotation pattern. Raw timing row is suppressed
 * when there is no data, avoiding empty clutter.
 */

import figures from 'figures'
import * as React from 'react'
import { useState } from 'react'
import { Box, Text, useInterval } from '../ink.js'
import { getTotalAPIDuration, getTotalDuration } from '../cost-tracker.js'

// ─── types & classification ──────────────────────────────────────────────────

type OverheadLevel = 'none' | 'low' | 'high'
type ThroughputLevel = 'good' | 'moderate' | 'slow'

/** Compute abstraction-layer overhead as a fraction (0–1+). */
function computeOverheadFraction(): number {
  const total = getTotalDuration()
  const api = getTotalAPIDuration()
  if (total <= 0 || api <= 0) return 0
  return Math.max(0, (total - api) / api)
}

function classifyOverhead(fraction: number): OverheadLevel {
  if (fraction < 0.005) return 'none'
  if (fraction <= 0.1) return 'low'
  return 'high'
}

function classifyThroughput(msgsPerSec: number): ThroughputLevel {
  if (msgsPerSec >= 5) return 'good'
  if (msgsPerSec >= 1) return 'moderate'
  return 'slow'
}

// ─── metadata maps ────────────────────────────────────────────────────────────

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

const OVERHEAD_ANNOTATION: Record<OverheadLevel, string> = {
  none: 'no overhead detected',
  low: 'monitoring overhead (acceptable)',
  high: 'high overhead — check OTel exporters',
}

const THROUGHPUT_COLOR: Record<ThroughputLevel, 'success' | 'warning' | 'error'> = {
  good: 'success',
  moderate: 'warning',
  slow: 'error',
}

const THROUGHPUT_ANNOTATION: Record<ThroughputLevel, string | null> = {
  good: null,
  moderate: 'below target (5 msgs/sec)',
  slow: 'stream may be congested',
}

// ─── sub-components ───────────────────────────────────────────────────────────

/**
 * A metric row: icon · label · value (bold, colored) · optional annotation.
 * Keeps label/value aligned across rows via consistent gap.
 */
function MetricRow({
  icon,
  iconColor,
  label,
  value,
  valueColor,
  annotation,
}: {
  icon: string
  iconColor: 'success' | 'warning' | 'error'
  label: string
  value: string
  valueColor: 'success' | 'warning' | 'error' | undefined
  annotation?: string | null
}): React.ReactNode {
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={iconColor}>{icon}</Text>
      <Text dimColor>{label}</Text>
      <Text color={valueColor} bold>
        {value}
      </Text>
      {annotation != null && (
        <Text dimColor>— {annotation}</Text>
      )}
    </Box>
  )
}

/** Compact timing pair rendered side-by-side. */
function TimingRow({
  totalMs,
  apiMs,
}: {
  totalMs: number
  apiMs: number
}): React.ReactNode {
  return (
    <Box flexDirection="row" gap={3} paddingLeft={2}>
      <Box flexDirection="row" gap={1}>
        <Text dimColor>wall</Text>
        <Text>{(totalMs / 1000).toFixed(2)} s</Text>
      </Box>
      <Box flexDirection="row" gap={1}>
        <Text dimColor>api</Text>
        <Text>{(apiMs / 1000).toFixed(2)} s</Text>
      </Box>
    </Box>
  )
}

// ─── component ────────────────────────────────────────────────────────────────

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

  const overheadLevel = classifyOverhead(overheadFraction)
  const overheadColor = OVERHEAD_COLOR[overheadLevel]
  const overheadIcon = OVERHEAD_ICON[overheadLevel]
  const overheadValueStr =
    overheadLevel === 'none' ? '~0 %' : `${(overheadFraction * 100).toFixed(1)} %`

  const hasStream = streamMsgsPerSec !== undefined
  const throughputLevel = hasStream ? classifyThroughput(streamMsgsPerSec!) : 'good'
  const throughputColor = hasStream ? THROUGHPUT_COLOR[throughputLevel] : undefined
  const throughputValueStr = hasStream ? `${streamMsgsPerSec!.toFixed(1)} msgs/sec` : '—'
  const throughputAnnotation = hasStream
    ? THROUGHPUT_ANNOTATION[throughputLevel]
    : 'no active stream'

  const totalMs = getTotalDuration()
  const apiMs = getTotalAPIDuration()
  const hasTimingData = totalMs > 0

  return (
    <Box flexDirection="column" gap={0}>
      {/* ── Section label ── */}
      <Text bold>Performance</Text>

      {/* ── Overhead row ── */}
      <MetricRow
        icon={overheadIcon}
        iconColor={overheadColor}
        label="abstraction overhead"
        value={overheadValueStr}
        valueColor={overheadColor}
        annotation={OVERHEAD_ANNOTATION[overheadLevel]}
      />

      {/* ── Throughput row ── */}
      <MetricRow
        icon={hasStream ? figures.arrowRight : figures.circle}
        iconColor={hasStream ? (throughputColor ?? 'success') : 'success'}
        label="stream throughput"
        value={throughputValueStr}
        valueColor={throughputColor}
        annotation={throughputAnnotation}
      />

      {/* ── Raw timing (only when cost-tracker has data) ── */}
      {hasTimingData && <TimingRow totalMs={totalMs} apiMs={apiMs} />}
    </Box>
  )
}
