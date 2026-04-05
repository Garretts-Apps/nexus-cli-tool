/**
 * TelemetryStatus - displays current telemetry mode and active counters.
 *
 * Color coding:
 *   green  = noop  (zero-overhead, fast path)
 *   yellow = otel  (full OpenTelemetry instrumentation, monitoring active)
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
  const modeColor = isNoop ? 'success' : 'warning'
  const modeIcon = isNoop ? figures.tick : figures.info
  const modeLabel = isNoop ? 'no-op' : 'otel'
  const modeDescription = isNoop
    ? 'Zero-overhead — no metrics collected'
    : 'OpenTelemetry — full instrumentation active'

  return (
    <Box flexDirection="column" gap={0}>
      {/* Header row */}
      <Box flexDirection="row" gap={1}>
        <Text bold>Telemetry</Text>
        <Text dimColor>|</Text>
        <Text color={modeColor}>
          {modeIcon}{' '}
        </Text>
        <Text color={modeColor} bold>
          TELEMETRY_MODE={modeLabel}
        </Text>
      </Box>

      {/* Description */}
      <Box paddingLeft={0}>
        <Text dimColor>{modeDescription}</Text>
      </Box>

      {/* Counters row — only meaningful when otel is active */}
      <Box flexDirection="row" gap={2} paddingTop={0}>
        <Box flexDirection="row" gap={1}>
          <Text dimColor>Meter:</Text>
          {meterReady ? (
            <Text color="success">ready</Text>
          ) : (
            <Text color={isNoop ? undefined : 'warning'} dimColor={isNoop}>
              {isNoop ? 'disabled' : 'initialising…'}
            </Text>
          )}
        </Box>

        <Box flexDirection="row" gap={1}>
          <Text dimColor>Counters:</Text>
          <Text color={counterCount > 0 ? 'success' : undefined} dimColor={counterCount === 0}>
            {counterCount}
          </Text>
          <Text dimColor>/ 8 active</Text>
        </Box>

        <Box flexDirection="row" gap={1}>
          <Text dimColor>Spans:</Text>
          <Text dimColor>{isNoop ? 'suppressed' : 'recording'}</Text>
        </Box>
      </Box>
    </Box>
  )
}
