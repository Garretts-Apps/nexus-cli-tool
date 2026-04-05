/**
 * TelemetryStatus - displays current telemetry mode and active counters.
 *
 * Color coding:
 *   green  = noop  (zero-overhead, fast path)
 *   yellow = otel  (full OpenTelemetry instrumentation, monitoring active)
 *
 * Design: compact instrumentation panel with a clear mode badge, concise
 * description line, and a three-column detail row that only surfaces
 * meaningful data rather than filling space with zeros.
 */

import figures from 'figures'
import * as React from 'react'
import { useState } from 'react'
import { Box, Text, useInterval } from '../ink.js'
import { isTelemetryEnabled } from '../utils/telemetry/index.js'
import {
  getActiveTimeCounter,
  getCodeEditToolDecisionCounter,
  getCommitCounter,
  getCostCounter,
  getLocCounter,
  getMeter,
  getPrCounter,
  getSessionCounter,
  getTokenCounter,
} from '../state/telemetryProviders.js'

// ─── constants ──────────────────────────────────────────────────────────────

const TOTAL_COUNTERS = 8

// ─── helpers ────────────────────────────────────────────────────────────────

type TelemetryMode = 'otel' | 'noop'

function getCurrentMode(): TelemetryMode {
  return isTelemetryEnabled() ? 'otel' : 'noop'
}

/** Count how many counter instruments are currently initialized (non-null). */
function getActiveCounterCount(): number {
  const counters = [
    getSessionCounter(),
    getLocCounter(),
    getPrCounter(),
    getCommitCounter(),
    getCostCounter(),
    getTokenCounter(),
    getCodeEditToolDecisionCounter(),
    getActiveTimeCounter(),
  ]
  return counters.filter(c => c !== null).length
}

/** True when the OTel meter has been initialised. */
function isMeterReady(): boolean {
  return getMeter() !== null
}

// ─── sub-components ─────────────────────────────────────────────────────────

/** Pill-style badge: [ label ] rendered with surrounding brackets. */
function ModeBadge({
  label,
  color,
}: {
  label: string
  color: 'success' | 'warning'
}): React.ReactNode {
  return (
    <Box flexDirection="row" gap={0}>
      <Text dimColor>[</Text>
      <Text color={color} bold>
        {' '}{label}{' '}
      </Text>
      <Text dimColor>]</Text>
    </Box>
  )
}

/** A single key/value metric cell. */
function MetricCell({
  label,
  value,
  valueColor,
  dimValue = false,
}: {
  label: string
  value: string
  valueColor?: 'success' | 'warning' | 'error'
  dimValue?: boolean
}): React.ReactNode {
  return (
    <Box flexDirection="row" gap={1}>
      <Text dimColor>{label}</Text>
      <Text color={valueColor} dimColor={dimValue} bold={!!valueColor && !dimValue}>
        {value}
      </Text>
    </Box>
  )
}

// ─── component ──────────────────────────────────────────────────────────────

type Props = {
  /** Poll interval in ms. Set to null to disable live updates. @default 2000 */
  pollInterval?: number | null
}

export function TelemetryStatus({ pollInterval = 2000 }: Props): React.ReactNode {
  const [mode, setMode] = useState<TelemetryMode>(getCurrentMode)
  const [counterCount, setCounterCount] = useState<number>(getActiveCounterCount)
  const [meterReady, setMeterReady] = useState<boolean>(isMeterReady)

  useInterval(() => {
    setMode(getCurrentMode())
    setCounterCount(getActiveCounterCount())
    setMeterReady(isMeterReady())
  }, pollInterval)

  const isNoop = mode === 'noop'
  const modeColor: 'success' | 'warning' = isNoop ? 'success' : 'warning'
  const modeLabel = isNoop ? 'noop' : 'otel'
  const modeDescription = isNoop
    ? 'Zero-overhead — no metrics collected'
    : 'OpenTelemetry — full instrumentation active'

  // Meter cell
  const meterValue = meterReady ? 'ready' : isNoop ? 'disabled' : 'initialising…'
  const meterColor: 'success' | 'warning' | undefined = meterReady
    ? 'success'
    : isNoop
      ? undefined
      : 'warning'

  // Counters cell — show fractional count only when otel is active
  const countersValue = isNoop
    ? `${counterCount}/${TOTAL_COUNTERS}`
    : counterCount > 0
      ? `${counterCount}/${TOTAL_COUNTERS}`
      : `0/${TOTAL_COUNTERS}`
  const countersColor: 'success' | undefined =
    !isNoop && counterCount > 0 ? 'success' : undefined

  // Spans cell
  const spansValue = isNoop ? 'suppressed' : 'recording'

  return (
    <Box flexDirection="column" gap={0}>
      {/* ── Header row: label + mode badge + description ── */}
      <Box flexDirection="row" gap={1} alignItems="flex-start">
        <Text bold>Telemetry</Text>
        <ModeBadge label={modeLabel} color={modeColor} />
        <Text dimColor>{modeDescription}</Text>
      </Box>

      {/* ── Detail row: meter · counters · spans ── */}
      <Box flexDirection="row" gap={3} paddingLeft={0} paddingTop={0}>
        <MetricCell
          label="meter"
          value={meterValue}
          valueColor={meterColor}
          dimValue={!meterReady && isNoop}
        />
        <MetricCell
          label="counters"
          value={countersValue}
          valueColor={countersColor}
          dimValue={counterCount === 0}
        />
        <MetricCell
          label="spans"
          value={spansValue}
          dimValue
        />
      </Box>
    </Box>
  )
}
