/**
 * ProviderErrorDisplay - friendly UX for unsupported / stub LLM providers.
 *
 * When a user selects Bedrock, Vertex, or Foundry — which are not yet
 * implemented — this component surfaces a clear, actionable message instead
 * of a raw JavaScript Error stack.
 *
 * Usage:
 *   <ProviderErrorDisplay provider="bedrock" />
 *   <ProviderErrorDisplay provider="vertex" fallbackProvider="anthropic" />
 */

import figures from 'figures'
import * as React from 'react'
import { Box, Text } from '../ink.js'

export type UnsupportedProvider = 'bedrock' | 'vertex' | 'foundry'
export type SupportedProvider = 'anthropic'

/** Providers that are stubs / not-yet-implemented. */
const STUB_PROVIDERS = new Set<string>(['bedrock', 'vertex', 'foundry'])

export function isUnsupportedProvider(provider: string): provider is UnsupportedProvider {
  return STUB_PROVIDERS.has(provider)
}

type ProviderMeta = {
  displayName: string
  docsUrl: string
  eta: string
}

const PROVIDER_META: Record<UnsupportedProvider, ProviderMeta> = {
  bedrock: {
    displayName: 'AWS Bedrock',
    docsUrl: 'https://github.com/nexus-cli/nexus/blob/main/PROVIDERS.md#bedrock',
    eta: 'in progress',
  },
  vertex: {
    displayName: 'Google Vertex AI',
    docsUrl: 'https://github.com/nexus-cli/nexus/blob/main/PROVIDERS.md#vertex',
    eta: 'planned',
  },
  foundry: {
    displayName: 'Azure AI Foundry',
    docsUrl: 'https://github.com/nexus-cli/nexus/blob/main/PROVIDERS.md#foundry',
    eta: 'planned',
  },
}

const FALLBACK_META: Record<SupportedProvider, string> = {
  anthropic: 'Anthropic API (claude.ai)',
}

type Props = {
  /** The provider that was selected but is not yet implemented. */
  provider: UnsupportedProvider | string
  /**
   * The provider Nexus will use as a fallback.
   * If not set, no fallback line is shown.
   * @default 'anthropic'
   */
  fallbackProvider?: SupportedProvider
  /** Whether to show the docs link hint. @default true */
  showDocsHint?: boolean
}

export function ProviderErrorDisplay({
  provider,
  fallbackProvider = 'anthropic',
  showDocsHint = true,
}: Props): React.ReactNode {
  const meta = isUnsupportedProvider(provider) ? PROVIDER_META[provider] : null
  const displayName = meta?.displayName ?? provider
  const docsUrl = meta?.docsUrl
  const eta = meta?.eta ?? 'unknown'
  const fallbackLabel = FALLBACK_META[fallbackProvider]

  return (
    <Box flexDirection="column" gap={0}>
      {/* Error badge */}
      <Box flexDirection="row" gap={1}>
        <Text color="warning">{figures.warning}</Text>
        <Text bold>Provider not yet implemented</Text>
      </Box>

      {/* Main message */}
      <Box paddingLeft={2} flexDirection="column" gap={0}>
        <Box flexDirection="row" gap={1}>
          <Text dimColor>Selected:</Text>
          <Text bold color="warning">
            {displayName}
          </Text>
          <Text dimColor>— status: {eta}</Text>
        </Box>

        {/* Fallback notice */}
        <Box flexDirection="row" gap={1}>
          <Text color="success">{figures.arrowRight}</Text>
          <Text>
            Using{' '}
            <Text bold>{fallbackLabel}</Text>
            {' '}instead
          </Text>
        </Box>

        {/* Docs hint */}
        {showDocsHint && docsUrl && (
          <Box paddingTop={1}>
            <Text dimColor>
              Implementation status:{' '}
              <Text dimColor underline>
                {docsUrl}
              </Text>
            </Text>
          </Box>
        )}

        {/* Contribute hint */}
        {showDocsHint && (
          <Box>
            <Text dimColor>
              See{' '}
              <Text bold dimColor={false}>
                PROVIDERS.md
              </Text>
              {' '}for adapter implementation guidance.
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}

/**
 * Utility: given any provider string, return a ProviderErrorDisplay if the
 * provider is unsupported, otherwise return null.
 *
 * @example
 *   {maybeProviderError('bedrock')}
 */
export function maybeProviderError(
  provider: string,
  fallbackProvider: SupportedProvider = 'anthropic',
): React.ReactNode {
  if (!isUnsupportedProvider(provider)) return null
  return (
    <ProviderErrorDisplay
      provider={provider}
      fallbackProvider={fallbackProvider}
    />
  )
}
