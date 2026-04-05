// Tier 2 session configuration state: model, client, settings, token,
// API-provider, SDK, and channel/remote config fields.
// Extracted from src/bootstrap/state.ts (ARCH-002 Phase 4).

import type { ModelUsage } from 'src/entrypoints/agentSdkTypes.js'
import type { ModelSetting } from 'src/utils/model/model.js'
import type { ModelStrings } from 'src/utils/model/modelStrings.js'
import type { SettingSource } from 'src/utils/settings/constants.js'
// Defined here (canonical location) to avoid circular dependency with
// src/bootstrap/state.ts which re-exports sessionConfig symbols.
// state.ts re-exports ChannelEntry for backward compatibility.
export type ChannelEntry =
  | { kind: 'plugin'; name: string; marketplace: string; dev?: boolean }
  | { kind: 'server'; name: string; dev?: boolean }

// ── Model Config ──

let modelUsage: { [modelName: string]: ModelUsage } = {}
let mainLoopModelOverride: ModelSetting | undefined = undefined
let initialMainLoopModel: ModelSetting = null
let modelStrings: ModelStrings | null = null

export function getModelUsage(): { [modelName: string]: ModelUsage } {
  return modelUsage
}

export function setModelUsage(usage: { [modelName: string]: ModelUsage }): void {
  modelUsage = usage
}

export function addModelUsageEntry(model: string, usage: ModelUsage): void {
  modelUsage[model] = usage
}

export function getUsageForModel(model: string): ModelUsage | undefined {
  return modelUsage[model]
}

export function getMainLoopModelOverride(): ModelSetting | undefined {
  return mainLoopModelOverride
}

export function setMainLoopModelOverride(
  model: ModelSetting | undefined,
): void {
  mainLoopModelOverride = model
}

export function getInitialMainLoopModel(): ModelSetting {
  return initialMainLoopModel
}

export function setInitialMainLoopModel(model: ModelSetting): void {
  initialMainLoopModel = model
}

// You shouldn't use this directly. See src/utils/model/modelStrings.ts::getModelStrings()
export function getModelStrings(): ModelStrings | null {
  return modelStrings
}

// You shouldn't use this directly. See src/utils/model/modelStrings.ts
export function setModelStrings(ms: ModelStrings): void {
  modelStrings = ms
}

// Test utility function to reset model strings for re-initialization.
// Separate from setModelStrings because we only want to accept 'null' in tests.
export function resetModelStringsForTestingOnly() {
  modelStrings = null
}

// ── Client/Session Config ──

let clientType = 'cli'
let sessionSource: string | undefined = undefined
let questionPreviewFormat: 'markdown' | 'html' | undefined = undefined

export function getClientType(): string {
  return clientType
}

export function setClientType(type: string): void {
  clientType = type
}

export function getSessionSource(): string | undefined {
  return sessionSource
}

export function setSessionSource(source: string): void {
  sessionSource = source
}

export function getQuestionPreviewFormat(): 'markdown' | 'html' | undefined {
  return questionPreviewFormat
}

export function setQuestionPreviewFormat(format: 'markdown' | 'html'): void {
  questionPreviewFormat = format
}

// ── Settings Config ──

let flagSettingsPath: string | undefined = undefined
let flagSettingsInline: Record<string, unknown> | null = null
let allowedSettingSources: SettingSource[] = [
  'userSettings',
  'projectSettings',
  'localSettings',
  'flagSettings',
  'policySettings',
]

export function getFlagSettingsPath(): string | undefined {
  return flagSettingsPath
}

export function setFlagSettingsPath(path: string | undefined): void {
  flagSettingsPath = path
}

export function getFlagSettingsInline(): Record<string, unknown> | null {
  return flagSettingsInline
}

export function setFlagSettingsInline(
  settings: Record<string, unknown> | null,
): void {
  flagSettingsInline = settings
}

export function getAllowedSettingSources(): SettingSource[] {
  return allowedSettingSources
}

export function setAllowedSettingSources(sources: SettingSource[]): void {
  allowedSettingSources = sources
}

// ── Token/Credential Config ──

let sessionIngressToken: string | null | undefined = undefined
let oauthTokenFromFd: string | null | undefined = undefined
let apiKeyFromFd: string | null | undefined = undefined

export function getSessionIngressToken(): string | null | undefined {
  return sessionIngressToken
}

export function setSessionIngressToken(token: string | null): void {
  sessionIngressToken = token
}

export function getOauthTokenFromFd(): string | null | undefined {
  return oauthTokenFromFd
}

export function setOauthTokenFromFd(token: string | null): void {
  oauthTokenFromFd = token
}

export function getApiKeyFromFd(): string | null | undefined {
  return apiKeyFromFd
}

export function setApiKeyFromFd(key: string | null): void {
  apiKeyFromFd = key
}

// ── API Provider Config ──

let apiProvider: 'claude' | 'gemini' | 'openai' = 'claude'
let apiProviderConfig: {
  apiKey: string | null
  endpoint: string | null
  model: string | null
} | null = null
let apiProviderConfigured = false

export function getApiProvider(): 'claude' | 'gemini' | 'openai' {
  return apiProvider
}

export function setApiProvider(provider: 'claude' | 'gemini' | 'openai'): void {
  apiProvider = provider
}

export function getApiProviderConfig(): {
  apiKey: string | null
  endpoint: string | null
  model: string | null
} | null {
  return apiProviderConfig
}

export function setApiProviderConfig(config: {
  apiKey: string | null
  endpoint: string | null
  model: string | null
} | null): void {
  apiProviderConfig = config
}

export function isApiProviderConfigured(): boolean {
  return apiProviderConfigured
}

export function setApiProviderConfigured(configured: boolean): void {
  apiProviderConfigured = configured
}

// ── SDK Config ──

let sdkAgentProgressSummariesEnabled = false
let assistantModeActive = false
let strictToolResultPairing = false
let userMsgOptIn = false
let sdkBetas: string[] | undefined = undefined

export function getSdkAgentProgressSummariesEnabled(): boolean {
  return sdkAgentProgressSummariesEnabled
}

export function setSdkAgentProgressSummariesEnabled(value: boolean): void {
  sdkAgentProgressSummariesEnabled = value
}

export function getAssistantModeActive(): boolean {
  return assistantModeActive
}

export function setAssistantModeActive(value: boolean): void {
  assistantModeActive = value
}

export function getStrictToolResultPairing(): boolean {
  return strictToolResultPairing
}

export function setStrictToolResultPairing(value: boolean): void {
  strictToolResultPairing = value
}

// Field name 'userMsgOptIn' avoids excluded-string substrings ('BriefTool',
// 'SendUserMessage' -- case-insensitive). All callers are inside feature()
// guards so these accessors don't need their own (matches getAssistantModeActive).
export function getUserMsgOptIn(): boolean {
  return userMsgOptIn
}

export function setUserMsgOptIn(value: boolean): void {
  userMsgOptIn = value
}

export function getSdkBetas(): string[] | undefined {
  return sdkBetas
}

export function setSdkBetas(betas: string[] | undefined): void {
  sdkBetas = betas
}

// ── Channel/Remote Config ──

let allowedChannels: ChannelEntry[] = []
let hasDevChannels = false
let sessionProjectDir: string | null = null
let mainThreadAgentType: string | undefined = undefined
let isRemoteMode = false
let directConnectServerUrl: string | undefined = undefined

export function getAllowedChannels(): ChannelEntry[] {
  return allowedChannels
}

export function setAllowedChannels(entries: ChannelEntry[]): void {
  allowedChannels = entries
}

export function getHasDevChannels(): boolean {
  return hasDevChannels
}

export function setHasDevChannels(value: boolean): void {
  hasDevChannels = value
}

export function getSessionProjectDir(): string | null {
  return sessionProjectDir
}

export function setSessionProjectDir(dir: string | null): void {
  sessionProjectDir = dir
}

export function getMainThreadAgentType(): string | undefined {
  return mainThreadAgentType
}

export function setMainThreadAgentType(agentType: string | undefined): void {
  mainThreadAgentType = agentType
}

export function getIsRemoteMode(): boolean {
  return isRemoteMode
}

export function setIsRemoteMode(value: boolean): void {
  isRemoteMode = value
}

export function getDirectConnectServerUrl(): string | undefined {
  return directConnectServerUrl
}

export function setDirectConnectServerUrl(url: string): void {
  directConnectServerUrl = url
}

// ── Reset ──

/** Reset to initial state (test helper). */
export function resetSessionConfigState(): void {
  // Model config
  modelUsage = {}
  mainLoopModelOverride = undefined
  initialMainLoopModel = null
  modelStrings = null
  // Client/session config
  clientType = 'cli'
  sessionSource = undefined
  questionPreviewFormat = undefined
  // Settings config
  flagSettingsPath = undefined
  flagSettingsInline = null
  allowedSettingSources = [
    'userSettings',
    'projectSettings',
    'localSettings',
    'flagSettings',
    'policySettings',
  ]
  // Token/credential config
  sessionIngressToken = undefined
  oauthTokenFromFd = undefined
  apiKeyFromFd = undefined
  // API provider config
  apiProvider = 'claude'
  apiProviderConfig = null
  apiProviderConfigured = false
  // SDK config
  sdkAgentProgressSummariesEnabled = false
  assistantModeActive = false
  strictToolResultPairing = false
  userMsgOptIn = false
  sdkBetas = undefined
  // Channel/remote config
  allowedChannels = []
  hasDevChannels = false
  sessionProjectDir = null
  mainThreadAgentType = undefined
  isRemoteMode = false
  directConnectServerUrl = undefined
}
