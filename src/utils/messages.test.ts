import { describe, it, expect, vi } from 'vitest'

// Mock the heavy dependencies that messages.ts imports
// We only test pure functions that don't depend on these
vi.mock('bun:bundle', () => ({
  feature: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk/resources/beta/messages/messages.mjs', () => ({}))
vi.mock('@anthropic-ai/sdk/resources/index.mjs', () => ({}))
vi.mock('lodash-es/isObject.js', () => ({ default: (v: unknown) => typeof v === 'object' && v !== null }))
vi.mock('lodash-es/last.js', () => ({ default: (arr: unknown[]) => arr[arr.length - 1] }))
vi.mock('src/services/analytics/index.js', () => ({
  logEvent: vi.fn(),
}))
vi.mock('src/services/analytics/metadata.js', () => ({
  sanitizeToolNameForAnalytics: vi.fn(),
}))
vi.mock('src/services/analytics/growthbook.js', () => ({
  checkStatsigFeatureGate_CACHED_MAY_BE_STALE: vi.fn(),
  getFeatureValue_CACHED_MAY_BE_STALE: vi.fn(() => false),
}))
vi.mock('../buddy/prompt.js', () => ({
  companionIntroText: '',
}))
vi.mock('../constants/messages.js', () => ({
  NO_CONTENT_MESSAGE: '(no content)',
}))
vi.mock('../constants/outputStyles.js', () => ({
  OUTPUT_STYLE_CONFIG: {},
}))
vi.mock('../memdir/paths.js', () => ({
  isAutoMemoryEnabled: vi.fn(() => false),
}))
vi.mock('../services/api/errors.js', () => ({
  getImageTooLargeErrorMessage: vi.fn(),
  getPdfInvalidErrorMessage: vi.fn(),
  getPdfPasswordProtectedErrorMessage: vi.fn(),
  getPdfTooLargeErrorMessage: vi.fn(),
  getRequestTooLargeErrorMessage: vi.fn(),
}))
vi.mock('../types/connectorText.js', () => ({
  isConnectorTextBlock: vi.fn(() => false),
}))
vi.mock('src/entrypoints/agentSdkTypes.js', () => ({}))
vi.mock('src/tools/AgentTool/built-in/exploreAgent.js', () => ({
  EXPLORE_AGENT: {},
}))
vi.mock('src/tools/AgentTool/built-in/planAgent.js', () => ({
  PLAN_AGENT: {},
}))
vi.mock('src/tools/AgentTool/builtInAgents.js', () => ({
  areExplorePlanAgentsEnabled: vi.fn(() => false),
}))
vi.mock('src/tools/AgentTool/constants.js', () => ({
  AGENT_TOOL_NAME: 'Agent',
}))
vi.mock('src/tools/AskUserQuestionTool/prompt.js', () => ({
  ASK_USER_QUESTION_TOOL_NAME: 'AskUserQuestion',
}))
vi.mock('src/tools/BashTool/BashTool.js', () => ({
  BashTool: { name: 'Bash' },
}))
vi.mock('src/tools/ExitPlanModeTool/ExitPlanModeV2Tool.js', () => ({
  ExitPlanModeV2Tool: { name: 'ExitPlanMode' },
}))
vi.mock('src/tools/FileEditTool/FileEditTool.js', () => ({
  FileEditTool: { name: 'FileEdit' },
}))
vi.mock('src/tools/FileReadTool/prompt.js', () => ({
  FILE_READ_TOOL_NAME: 'FileRead',
  MAX_LINES_TO_READ: 2000,
}))
vi.mock('src/tools/FileWriteTool/FileWriteTool.js', () => ({
  FileWriteTool: { name: 'FileWrite' },
}))
vi.mock('src/tools/GlobTool/prompt.js', () => ({
  GLOB_TOOL_NAME: 'Glob',
}))
vi.mock('src/tools/GrepTool/prompt.js', () => ({
  GREP_TOOL_NAME: 'Grep',
}))
vi.mock('src/tools/FileReadTool/FileReadTool.js', () => ({
  FileReadTool: { name: 'FileRead' },
}))
vi.mock('src/tools/SendMessageTool/constants.js', () => ({
  SEND_MESSAGE_TOOL_NAME: 'SendMessage',
}))
vi.mock('src/tools/TaskCreateTool/constants.js', () => ({
  TASK_CREATE_TOOL_NAME: 'TaskCreate',
}))
vi.mock('src/tools/TaskOutputTool/constants.js', () => ({
  TASK_OUTPUT_TOOL_NAME: 'TaskOutput',
}))
vi.mock('src/tools/TaskUpdateTool/constants.js', () => ({
  TASK_UPDATE_TOOL_NAME: 'TaskUpdate',
}))
vi.mock('../bootstrap/state.js', () => ({
  getStrictToolResultPairing: vi.fn(() => false),
}))
vi.mock('../components/Spinner.js', () => ({}))
vi.mock('../constants/xml.js', () => ({
  COMMAND_ARGS_TAG: 'command-args',
  COMMAND_MESSAGE_TAG: 'command-message',
  COMMAND_NAME_TAG: 'command-name',
  LOCAL_COMMAND_CAVEAT_TAG: 'local-command-caveat',
  LOCAL_COMMAND_STDOUT_TAG: 'local-command-stdout',
}))
vi.mock('../services/diagnosticTracking.js', () => ({
  DiagnosticTrackingService: { getInstance: vi.fn() },
}))
vi.mock('../Tool.js', () => ({
  findToolByName: vi.fn(),
  toolMatchesName: vi.fn(),
}))
vi.mock('./advisor.js', () => ({
  isAdvisorBlock: vi.fn(() => false),
}))
vi.mock('./agentSwarmsEnabled.js', () => ({
  isAgentSwarmsEnabled: vi.fn(() => false),
}))
vi.mock('./array.js', () => ({
  count: vi.fn(),
}))
vi.mock('./attachments.js', () => ({
  memoryHeader: '',
}))
vi.mock('./bash/shellQuote.js', () => ({
  quote: vi.fn((s: string) => `'${s}'`),
}))
vi.mock('./format.js', () => ({
  formatNumber: vi.fn((n: number) => String(n)),
  formatTokens: vi.fn((n: number) => String(n)),
  formatFileSize: vi.fn((n: number) => String(n)),
}))
vi.mock('./planModeV2.js', () => ({
  getPewterLedgerVariant: vi.fn(),
  getPlanModeV2AgentCount: vi.fn(() => 0),
  getPlanModeV2ExploreAgentCount: vi.fn(() => 0),
  isPlanModeInterviewPhaseEnabled: vi.fn(() => false),
}))
vi.mock('./slowOperations.js', () => ({
  jsonStringify: vi.fn(JSON.stringify),
}))
vi.mock('./api.js', () => ({
  normalizeToolInput: vi.fn(),
  normalizeToolInputForAPI: vi.fn(),
}))
vi.mock('./config.js', () => ({
  getCurrentProjectConfig: vi.fn(() => ({})),
}))
vi.mock('./debug.js', () => ({
  logAntError: vi.fn(),
  logForDebugging: vi.fn(),
}))
vi.mock('./displayTags.js', () => ({
  stripIdeContextTags: vi.fn((s: string) => s),
}))
vi.mock('./embeddedTools.js', () => ({
  hasEmbeddedSearchTools: vi.fn(() => false),
}))
vi.mock('./imageValidation.js', () => ({
  validateImagesForAPI: vi.fn(),
}))
vi.mock('./json.js', () => ({
  safeParseJSON: vi.fn(),
}))
vi.mock('./log.js', () => ({
  logError: vi.fn(),
  logMCPDebug: vi.fn(),
}))
vi.mock('./permissions/permissionRuleParser.js', () => ({
  normalizeLegacyToolName: vi.fn((n: string) => n),
}))
vi.mock('./tasks.js', () => ({
  isTodoV2Enabled: vi.fn(() => false),
}))
vi.mock('./teammateMailbox.js', () => ({}))
vi.mock('./toolSearch.js', () => ({
  isToolReferenceBlock: vi.fn(() => false),
  isToolSearchEnabledOptimistic: vi.fn(() => false),
}))
vi.mock('src/types/utils.js', () => ({}))

// Now import the functions under test
import {
  deriveShortMessageId,
  extractTag,
  isEmptyMessageText,
  stripPromptXMLTags,
  wrapInSystemReminder,
  isClassifierDenial,
  AUTO_REJECT_MESSAGE,
  DONT_ASK_REJECT_MESSAGE,
} from './messages.js'

describe('deriveShortMessageId', () => {
  it('returns a 6-character string', () => {
    const id = deriveShortMessageId('550e8400-e29b-41d4-a716-446655440000')
    expect(id).toHaveLength(6)
  })

  it('is deterministic', () => {
    const uuid = '12345678-1234-1234-1234-123456789012'
    expect(deriveShortMessageId(uuid)).toBe(deriveShortMessageId(uuid))
  })

  it('produces different IDs for different UUIDs', () => {
    const id1 = deriveShortMessageId('00000000-0000-0000-0000-000000000001')
    const id2 = deriveShortMessageId('00000000-0000-0000-0000-000000000002')
    expect(id1).not.toBe(id2)
  })
})

describe('extractTag', () => {
  it('extracts content from simple tags', () => {
    expect(extractTag('<foo>bar</foo>', 'foo')).toBe('bar')
  })

  it('extracts content from tags with attributes', () => {
    expect(extractTag('<div class="test">content</div>', 'div')).toBe('content')
  })

  it('returns null when tag not found', () => {
    expect(extractTag('<foo>bar</foo>', 'baz')).toBe(null)
  })

  it('returns null for empty html', () => {
    expect(extractTag('', 'foo')).toBe(null)
    expect(extractTag('   ', 'foo')).toBe(null)
  })

  it('returns null for empty tag name', () => {
    expect(extractTag('<foo>bar</foo>', '')).toBe(null)
    expect(extractTag('<foo>bar</foo>', '   ')).toBe(null)
  })

  it('handles multiline content', () => {
    const html = '<pre>\nline1\nline2\n</pre>'
    expect(extractTag(html, 'pre')).toBe('\nline1\nline2\n')
  })
})

describe('isEmptyMessageText', () => {
  it('returns true for empty string', () => {
    expect(isEmptyMessageText('')).toBe(true)
  })

  it('returns true for whitespace-only string', () => {
    expect(isEmptyMessageText('   ')).toBe(true)
  })

  it('returns true for NO_CONTENT_MESSAGE', () => {
    expect(isEmptyMessageText('(no content)')).toBe(true)
  })

  it('returns false for actual content', () => {
    expect(isEmptyMessageText('hello')).toBe(false)
  })

  it('returns true when content is only stripped XML tags', () => {
    expect(isEmptyMessageText('<context>some analysis</context>')).toBe(true)
  })
})

describe('stripPromptXMLTags', () => {
  it('strips context tags', () => {
    expect(stripPromptXMLTags('<context>analysis</context> remaining')).toBe('remaining')
  })

  it('strips commit_analysis tags', () => {
    expect(stripPromptXMLTags('<commit_analysis>data</commit_analysis> text')).toBe('text')
  })

  it('strips function_analysis tags', () => {
    expect(stripPromptXMLTags('<function_analysis>data</function_analysis> text')).toBe('text')
  })

  it('strips pr_analysis tags', () => {
    expect(stripPromptXMLTags('<pr_analysis>data</pr_analysis> text')).toBe('text')
  })

  it('leaves non-matching tags alone', () => {
    expect(stripPromptXMLTags('<div>content</div>')).toBe('<div>content</div>')
  })

  it('handles empty string', () => {
    expect(stripPromptXMLTags('')).toBe('')
  })
})

describe('wrapInSystemReminder', () => {
  it('wraps content in system-reminder tags', () => {
    expect(wrapInSystemReminder('hello')).toBe(
      '<system-reminder>\nhello\n</system-reminder>',
    )
  })
})

describe('isClassifierDenial', () => {
  it('returns true for classifier denial messages', () => {
    expect(
      isClassifierDenial('Permission for this action has been denied. Reason: unsafe'),
    ).toBe(true)
  })

  it('returns false for other messages', () => {
    expect(isClassifierDenial('some other message')).toBe(false)
  })
})

describe('AUTO_REJECT_MESSAGE', () => {
  it('includes the tool name', () => {
    const msg = AUTO_REJECT_MESSAGE('BashTool')
    expect(msg).toContain('BashTool')
    expect(msg).toContain('denied')
  })
})

describe('DONT_ASK_REJECT_MESSAGE', () => {
  it('includes the tool name and dont ask mode', () => {
    const msg = DONT_ASK_REJECT_MESSAGE('FileWrite')
    expect(msg).toContain('FileWrite')
    expect(msg).toContain("don't ask mode")
  })
})
