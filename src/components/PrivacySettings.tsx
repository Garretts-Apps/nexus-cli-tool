/**
 * PrivacySettings - displays active privacy level and data flow status.
 *
 * Privacy levels (mapped from environment / settings):
 *   no-telemetry      — nothing leaves the process
 *   essential-traffic — only API calls; no analytics or telemetry
 *   default           — standard operation (analytics + telemetry enabled)
 *
 * Color coding:
 *   green  = no-telemetry (most private)
 *   yellow = essential-traffic
 *   default/dim = standard
 */

import figures from 'figures'
import * as React from 'react'
import { Box, Text } from '../ink.js'
import { isTelemetryEnabled } from '../utils/telemetry/index.js'

export type PrivacyLevel = 'no-telemetry' | 'essential-traffic' | 'default'

type DataFlow = {
  label: string
  enabled: boolean
  description: string
}

function detectPrivacyLevel(): PrivacyLevel {
  // TELEMETRY_MODE=noop disables all telemetry data flows
  if (!isTelemetryEnabled()) return 'no-telemetry'
  // DISABLE_TELEMETRY / ANTHROPIC_DISABLE_TELEMETRY flags
  if (
    process.env.DISABLE_TELEMETRY === '1' ||
    process.env.ANTHROPIC_DISABLE_TELEMETRY === '1'
  ) {
    return 'no-telemetry'
  }
  // No analytics env var
  if (process.env.DISABLE_ANALYTICS === '1') return 'essential-traffic'
  return 'default'
}

function buildDataFlows(level: PrivacyLevel): DataFlow[] {
  const isNoop = level === 'no-telemetry'
  const isEssential = level === 'essential-traffic'

  return [
    {
      label: 'API requests',
      enabled: true,
      description: 'LLM API calls (always required)',
    },
    {
      label: 'OTel metrics',
      enabled: !isNoop,
      description: 'OpenTelemetry counters and spans',
    },
    {
      label: 'Usage analytics',
      enabled: !isNoop && !isEssential,
      description: 'Session-level usage statistics',
    },
    {
      label: 'Error telemetry',
      enabled: !isNoop && !isEssential,
      description: 'Sentry / error event reporting',
    },
    {
      label: 'Feature flags',
      enabled: !isNoop,
      description: 'GrowthBook feature-flag polling',
    },
  ]
}

type Props = {
  /** Override detected privacy level for display purposes. */
  privacyLevel?: PrivacyLevel
  /** Show the per-flow breakdown table. @default true */
  showFlows?: boolean
}

const LEVEL_COLOR: Record<PrivacyLevel, 'success' | 'warning' | undefined> = {
  'no-telemetry': 'success',
  'essential-traffic': 'warning',
  default: undefined,
}

const LEVEL_LABEL: Record<PrivacyLevel, string> = {
  'no-telemetry': 'no-telemetry',
  'essential-traffic': 'essential-traffic',
  default: 'default',
}

const LEVEL_ICON: Record<PrivacyLevel, string> = {
  'no-telemetry': figures.tick,
  'essential-traffic': figures.warning,
  default: figures.info,
}

const LEVEL_DESCRIPTION: Record<PrivacyLevel, string> = {
  'no-telemetry': 'All telemetry and analytics disabled — maximum privacy',
  'essential-traffic': 'API calls only — analytics and error reporting disabled',
  default: 'Standard operation — analytics and telemetry enabled',
}

export function PrivacySettings({
  privacyLevel,
  showFlows = true,
}: Props): React.ReactNode {
  const level = privacyLevel ?? detectPrivacyLevel()
  const flows = buildDataFlows(level)
  const levelColor = LEVEL_COLOR[level]
  const icon = LEVEL_ICON[level]

  return (
    <Box flexDirection="column" gap={0}>
      {/* Header */}
      <Box flexDirection="row" gap={1}>
        <Text bold>Privacy</Text>
        <Text dimColor>|</Text>
        <Text color={levelColor}>{icon} </Text>
        <Text color={levelColor} bold>
          {LEVEL_LABEL[level]}
        </Text>
      </Box>

      {/* Description */}
      <Text dimColor>{LEVEL_DESCRIPTION[level]}</Text>

      {/* Data flow table */}
      {showFlows && (
        <Box flexDirection="column" paddingTop={1}>
          {flows.map((flow, i) => (
            <Box key={i} flexDirection="row" gap={1}>
              {flow.enabled ? (
                <Text color="success">{figures.tick}</Text>
              ) : (
                <Text color="error">{figures.cross}</Text>
              )}
              <Text bold={false} wrap="truncate-end">
                {flow.label}
              </Text>
              <Text dimColor>— {flow.description}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Quick-toggle hint */}
      <Box paddingTop={1}>
        <Text dimColor>
          Set{' '}
          <Text bold dimColor={false}>
            TELEMETRY_MODE=noop
          </Text>{' '}
          for zero-overhead mode or{' '}
          <Text bold dimColor={false}>
            DISABLE_ANALYTICS=1
          </Text>{' '}
          for essential-traffic.
        </Text>
      </Box>
    </Box>
  )
}
