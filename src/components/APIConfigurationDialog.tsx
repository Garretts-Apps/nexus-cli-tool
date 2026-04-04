/**
 * API Configuration Dialog
 *
 * Allows users to configure which LLM provider to use and provide API credentials
 */
import React, { useState } from 'react'
import { Box, Text } from 'ink'
import { getAvailableProviders, type APIProvider } from '../services/api/multiApiAdapter.js'
import type { Root } from '../ink.js'

interface APIConfigurationDialogProps {
  onComplete: (config: {
    provider: APIProvider
    apiKey: string
    endpoint: string
    model: string
  }) => void
  onCancel: () => void
}

export const APIConfigurationDialog: React.FC<APIConfigurationDialogProps> = ({
  onComplete,
  onCancel,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [step, setStep] = useState<
    'provider' | 'apiKey' | 'endpoint' | 'model' | 'confirm'
  >('provider')
  const [apiKey, setApiKey] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [model, setModel] = useState('')
  const providers = getAvailableProviders()
  const selectedProvider = providers[selectedIndex]

  const handleNext = () => {
    if (step === 'provider') {
      // Set default values based on provider
      const defaults: Record<
        string,
        { endpoint: string; model: string }
      > = {
        claude: {
          endpoint: 'https://api.anthropic.com',
          model: 'claude-3-5-sonnet-20241022',
        },
        gemini: {
          endpoint:
            'https://generativelanguage.googleapis.com/v1beta/models',
          model: 'gemini-2.0-flash',
        },
        openai: {
          endpoint: 'https://api.openai.com/v1',
          model: 'gpt-4-turbo',
        },
      }
      const defaults_val =
        defaults[selectedProvider.id as keyof typeof defaults]
      setEndpoint(defaults_val.endpoint)
      setModel(defaults_val.model)
      setStep('apiKey')
    } else if (step === 'apiKey') {
      setStep('endpoint')
    } else if (step === 'endpoint') {
      setStep('model')
    } else if (step === 'model') {
      setStep('confirm')
    } else if (step === 'confirm') {
      onComplete({
        provider: selectedProvider.id,
        apiKey,
        endpoint,
        model,
      })
    }
  }

  const handleBack = () => {
    if (step === 'apiKey') {
      setStep('provider')
    } else if (step === 'endpoint') {
      setStep('apiKey')
    } else if (step === 'model') {
      setStep('endpoint')
    } else if (step === 'confirm') {
      setStep('model')
    }
  }

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      <Text bold>⚙️  API Provider Configuration</Text>
      <Text></Text>

      {step === 'provider' && (
        <>
          <Text>Select your LLM provider:</Text>
          <Text></Text>
          {providers.map((provider, index) => (
            <Box key={provider.id} marginLeft={2}>
              <Text>{index === selectedIndex ? '▶ ' : '  '}</Text>
              <Box flexDirection="column">
                <Text bold={index === selectedIndex} color={index === selectedIndex ? 'cyan' : undefined}>
                  {provider.name}
                </Text>
                <Text dimColor>{provider.description}</Text>
              </Box>
            </Box>
          ))}
          <Text></Text>
          <Box marginTop={1}>
            <Text>Use ↑↓ to select, Enter to confirm</Text>
          </Box>
        </>
      )}

      {step === 'apiKey' && (
        <>
          <Text>Enter your {selectedProvider.name} API Key:</Text>
          <Text></Text>
          <Box marginLeft={2}>
            <Text>▶ {apiKey ? '*'.repeat(apiKey.length) : '(empty)'}</Text>
          </Box>
          <Text dimColor fontSize="small">
            Paste your API key from {selectedProvider.name} console
          </Text>
        </>
      )}

      {step === 'endpoint' && (
        <>
          <Text>API Endpoint (press Enter to use default):</Text>
          <Text></Text>
          <Box marginLeft={2}>
            <Text>▶ {endpoint}</Text>
          </Box>
        </>
      )}

      {step === 'model' && (
        <>
          <Text>Model name (press Enter to use default):</Text>
          <Text></Text>
          <Box marginLeft={2}>
            <Text>▶ {model}</Text>
          </Box>
        </>
      )}

      {step === 'confirm' && (
        <>
          <Text>✓ Configuration Summary:</Text>
          <Text></Text>
          <Box marginLeft={2} flexDirection="column">
            <Text>Provider: {selectedProvider.name}</Text>
            <Text>Endpoint: {endpoint}</Text>
            <Text>Model: {model}</Text>
            <Text>API Key: {'*'.repeat(Math.min(apiKey.length, 10))}...</Text>
          </Box>
          <Text></Text>
          <Text color="green">Ready to save configuration</Text>
        </>
      )}

      <Text></Text>
      <Box marginTop={1}>
        {step !== 'provider' && (
          <Text color="gray" marginRight={2}>
            [←] Back
          </Text>
        )}
        {step !== 'confirm' ? (
          <Text color="cyan">[→] Next</Text>
        ) : (
          <>
            <Text color="cyan" marginRight={2}>
              [Enter] Save
            </Text>
            <Text color="gray">[Esc] Cancel</Text>
          </>
        )}
      </Box>
    </Box>
  )
}
