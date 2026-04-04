import { feature } from 'bun:bundle'
import type { BetaUsage as Usage } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type {
  ContentBlock,
  ContentBlockParam,
  TextBlockParam,
  ToolResultBlockParam,
  ToolUseBlock,
  ToolUseBlockParam,
} from '@anthropic-ai/sdk/resources/index.mjs'
import { randomUUID, type UUID } from 'crypto'
import last from 'lodash-es/last.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import { NO_CONTENT_MESSAGE } from '../constants/messages.js'
import {
  checkStatsigFeatureGate_CACHED_MAY_BE_STALE,
} from '../services/analytics/growthbook.js'
import {
  getImageTooLargeErrorMessage,
  getPdfInvalidErrorMessage,
  getPdfPasswordProtectedErrorMessage,
  getPdfTooLargeErrorMessage,
  getRequestTooLargeErrorMessage,
} from '../services/api/errors.js'
import type { AnyObject } from '../Tool.js'
import type {
  AssistantMessage,
  AttachmentMessage,
  Message,
  NormalizedAssistantMessage,
  NormalizedMessage,
  NormalizedUserMessage,
  PartialCompactDirection,
  ProgressMessage,
  RequestStartEvent,
  StopHookInfo,
  StreamEvent,
  SystemAgentsKilledMessage,
  SystemAPIErrorMessage,
  SystemApiMetricsMessage,
  SystemAwaySummaryMessage,
  SystemBridgeStatusMessage,
  SystemCompactBoundaryMessage,
  SystemInformationalMessage,
  SystemLocalCommandMessage,
  SystemMemorySavedMessage,
  SystemMessage,
  SystemMessageLevel,
  SystemMicrocompactBoundaryMessage,
  SystemPermissionRetryMessage,
  SystemScheduledTaskFireMessage,
  SystemStopHookSummaryMessage,
  SystemTurnDurationMessage,
  TombstoneMessage,
  ToolUseSummaryMessage,
  UserMessage,
} from '../types/message.js'
// isAdvisorBlock moved to messageUtilities.ts
import {
  isToolResultMessage,
  mergeAdjacentUserMessages,
  mergeAssistantMessages,
  mergeUserContentBlocks,
  mergeUserMessages,
  mergeUserMessagesAndToolResults,
} from './messageMerging.js'
import {
  ensureNonEmptyAssistantContent,
  filterOrphanedThinkingOnlyMessages,
  filterTrailingThinkingFromLastAssistant,
  filterUnresolvedToolUses,
  filterWhitespaceOnlyAssistantMessages,
  stripSignatureBlocks,
} from './messageFiltering.js'
import { isAgentSwarmsEnabled } from './agentSwarmsEnabled.js'
import { count } from './array.js'
import {
  type HookAttachment,
} from './attachments.js'
import { formatNumber, formatTokens } from './format.js'
import { jsonStringify } from './slowOperations.js'

// Hook attachments type moved to messageUtilities.ts

import type { APIError } from '@anthropic-ai/sdk'
import type {
  BetaContentBlock,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import { getStrictToolResultPairing } from '../state/sessionConfig.js'
import type { SpinnerMode } from '../components/Spinner.js'
import {
  COMMAND_MESSAGE_TAG,
  LOCAL_COMMAND_CAVEAT_TAG,
  LOCAL_COMMAND_STDOUT_TAG,
} from '../constants/xml.js'
import {
  findToolByName,
  type Tool,
  type Tools,
  toolMatchesName,
} from '../Tool.js'
import type { PermissionMode } from '../types/permissions.js'
import { normalizeToolInput, normalizeToolInputForAPI } from './api.js'
import { logAntError, logForDebugging } from './debug.js'
// stripIdeContextTags moved to messageUtilities.ts
import { validateImagesForAPI } from './imageValidation.js'
import { safeParseJSON } from './json.js'
import { logError } from './log.js'
import { normalizeLegacyToolName } from './permissions/permissionRuleParser.js'
// escapeRegExp moved to messageUtilities.ts

// Lazy import to avoid circular dependency (teammateMailbox -> teammate -> ... -> messages)
function getTeammateMailbox(): typeof import('./teammateMailbox.js') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./teammateMailbox.js')
}

import {
  isToolReferenceBlock,
  isToolSearchEnabledOptimistic,
} from './toolSearch.js'

// Re-export all message constants for backwards compatibility
export {
  AUTO_MODE_REJECTION_PREFIX,
  AUTO_REJECT_MESSAGE,
  CANCEL_MESSAGE,
  DENIAL_WORKAROUND_GUIDANCE,
  DONT_ASK_REJECT_MESSAGE,
  INTERRUPT_MESSAGE,
  INTERRUPT_MESSAGE_FOR_TOOL_USE,
  MEMORY_CORRECTION_HINT,
  NO_RESPONSE_REQUESTED,
  PLAN_REJECTION_PREFIX,
  REJECT_MESSAGE,
  REJECT_MESSAGE_WITH_REASON_PREFIX,
  SUBAGENT_REJECT_MESSAGE,
  SUBAGENT_REJECT_MESSAGE_WITH_REASON_PREFIX,
  SYNTHETIC_MESSAGES,
  SYNTHETIC_MODEL,
  SYNTHETIC_TOOL_RESULT_PLACEHOLDER,
  TOOL_REFERENCE_TURN_BOUNDARY,
} from './messageConstants.js'

// Re-export all message creation functions for backwards compatibility
export {
  createAssistantAPIErrorMessage,
  createAssistantMessage,
  createModelSwitchBreadcrumbs,
  createProgressMessage,
  createSyntheticUserCaveatMessage,
  createToolResultStopMessage,
  createUserInterruptionMessage,
  createUserMessage,
  formatCommandInputTags,
  prepareUserContent,
} from './messageCreation.js'

// Re-export all message normalization functions for backwards compatibility
export {
  contentHasToolReference,
  deriveUUID,
  ensureSystemReminderWrap,
  isEmptyMessageText,
  normalizeContentFromAPI,
  normalizeMessages,
  reorderAttachmentsForAPI,
  relocateToolReferenceSiblings,
  sanitizeErrorToolResultContent,
  smooshSystemReminderSiblings,
  stripCallerFieldFromAssistantMessage,
  stripPromptXMLTags,
  stripToolReferenceBlocksFromUserMessage,
  stripUnavailableToolReferencesFromUserMessage,
  wrapInSystemReminder,
  wrapMessagesInSystemReminder,
} from './messageNormalization.js'

// Re-export all message utility functions for backwards compatibility (Phase 9)
export {
  buildClassifierUnavailableMessage,
  buildMessageLookups,
  buildSubagentLookups,
  buildYoloRejectionMessage,
  countToolCalls,
  deriveShortMessageId,
  EMPTY_LOOKUPS,
  EMPTY_STRING_SET,
  extractTag,
  findLastCompactBoundaryIndex,
  getAssistantMessageText,
  getLastAssistantMessage,
  getMessagesAfterCompactBoundary,
  getProgressMessagesFromLookup,
  getSiblingToolUseIDsFromLookup,
  getSiblingToolUseIDs,
  getToolResultIDs,
  getToolUseID,
  getToolUseIDs,
  getUserMessageText,
  hasSuccessfulToolCall,
  hasToolCallsInLastAssistantTurn,
  hasUnresolvedHooks,
  hasUnresolvedHooksFromLookup,
  isClassifierDenial,
  isCompactBoundaryMessage,
  isHookAttachmentMessage,
  isNotEmptyMessage,
  isSyntheticMessage,
  isThinkingMessage,
  isToolUseRequestMessage,
  isToolUseResultMessage,
  type MessageLookups,
  resetMessageLookupsCache,
  shouldShowUserMessage,
  stripAdvisorBlocks,
  textForResubmit,
  withMemoryCorrectionHint,
  wrapCommandText,
} from './messageUtilities.js'

// Import normalization functions used within this module
import {
  contentHasToolReference,
  deriveUUID,
  ensureSystemReminderWrap,
  normalizeContentFromAPI,
  normalizeMessages,
  reorderAttachmentsForAPI,
  relocateToolReferenceSiblings,
  sanitizeErrorToolResultContent,
  smooshSystemReminderSiblings,
  stripToolReferenceBlocksFromUserMessage,
  stripUnavailableToolReferencesFromUserMessage,
  wrapInSystemReminder,
  wrapMessagesInSystemReminder,
} from './messageNormalization.js'

// Import creation functions used within this module
import { createUserMessage } from './messageCreation.js'

// Import constants used within this module
import {
  AUTO_MODE_REJECTION_PREFIX,
  CANCEL_MESSAGE,
  DENIAL_WORKAROUND_GUIDANCE,
  INTERRUPT_MESSAGE,
  INTERRUPT_MESSAGE_FOR_TOOL_USE,
  MEMORY_CORRECTION_HINT,
  SYNTHETIC_MESSAGES,
  SYNTHETIC_MODEL,
  SYNTHETIC_TOOL_RESULT_PLACEHOLDER,
  TOOL_REFERENCE_TURN_BOUNDARY,
} from './messageConstants.js'

// Import utility functions used within this module (extracted in Phase 9)
import {
  deriveShortMessageId,
  getToolUseID,
  isHookAttachmentMessage,
  isToolUseRequestMessage,
} from './messageUtilities.js'

// withMemoryCorrectionHint, deriveShortMessageId, isClassifierDenial,
// buildYoloRejectionMessage, buildClassifierUnavailableMessage, isSyntheticMessage
// moved to messageUtilities.ts (re-exported above)

function isSyntheticApiErrorMessage(
  message: Message,
): message is AssistantMessage & { isApiErrorMessage: true } {
  return (
    message.type === 'assistant' &&
    message.isApiErrorMessage === true &&
    message.message.model === SYNTHETIC_MODEL
  )
}

// getLastAssistantMessage, hasToolCallsInLastAssistantTurn, extractTag,
// isNotEmptyMessage, isToolUseRequestMessage, isToolUseResultMessage
// moved to messageUtilities.ts (re-exported above)

// Re-order, to move result messages to be after their tool use messages
export function reorderMessagesInUI(
  messages: (
    | NormalizedUserMessage
    | NormalizedAssistantMessage
    | AttachmentMessage
    | SystemMessage
  )[],
  syntheticStreamingToolUseMessages: NormalizedAssistantMessage[],
): (
  | NormalizedUserMessage
  | NormalizedAssistantMessage
  | AttachmentMessage
  | SystemMessage
)[] {
  // Maps tool use ID to its related messages
  const toolUseGroups = new Map<
    string,
    {
      toolUse: ToolUseRequestMessage | null
      preHooks: AttachmentMessage[]
      toolResult: NormalizedUserMessage | null
      postHooks: AttachmentMessage[]
    }
  >()

  // First pass: group messages by tool use ID
  for (const message of messages) {
    // Handle tool use messages
    if (isToolUseRequestMessage(message)) {
      const toolUseID = message.message.content[0]?.id
      if (toolUseID) {
        if (!toolUseGroups.has(toolUseID)) {
          toolUseGroups.set(toolUseID, {
            toolUse: null,
            preHooks: [],
            toolResult: null,
            postHooks: [],
          })
        }
        toolUseGroups.get(toolUseID)!.toolUse = message
      }
      continue
    }

    // Handle pre-tool-use hooks
    if (
      isHookAttachmentMessage(message) &&
      message.attachment.hookEvent === 'PreToolUse'
    ) {
      const toolUseID = message.attachment.toolUseID
      if (!toolUseGroups.has(toolUseID)) {
        toolUseGroups.set(toolUseID, {
          toolUse: null,
          preHooks: [],
          toolResult: null,
          postHooks: [],
        })
      }
      toolUseGroups.get(toolUseID)!.preHooks.push(message)
      continue
    }

    // Handle tool results
    if (
      message.type === 'user' &&
      message.message.content[0]?.type === 'tool_result'
    ) {
      const toolUseID = message.message.content[0].tool_use_id
      if (!toolUseGroups.has(toolUseID)) {
        toolUseGroups.set(toolUseID, {
          toolUse: null,
          preHooks: [],
          toolResult: null,
          postHooks: [],
        })
      }
      toolUseGroups.get(toolUseID)!.toolResult = message
      continue
    }

    // Handle post-tool-use hooks
    if (
      isHookAttachmentMessage(message) &&
      message.attachment.hookEvent === 'PostToolUse'
    ) {
      const toolUseID = message.attachment.toolUseID
      if (!toolUseGroups.has(toolUseID)) {
        toolUseGroups.set(toolUseID, {
          toolUse: null,
          preHooks: [],
          toolResult: null,
          postHooks: [],
        })
      }
      toolUseGroups.get(toolUseID)!.postHooks.push(message)
      continue
    }
  }

  // Second pass: reconstruct the message list in the correct order
  const result: (
    | NormalizedUserMessage
    | NormalizedAssistantMessage
    | AttachmentMessage
    | SystemMessage
  )[] = []
  const processedToolUses = new Set<string>()

  for (const message of messages) {
    // Check if this is a tool use
    if (isToolUseRequestMessage(message)) {
      const toolUseID = message.message.content[0]?.id
      if (toolUseID && !processedToolUses.has(toolUseID)) {
        processedToolUses.add(toolUseID)
        const group = toolUseGroups.get(toolUseID)
        if (group && group.toolUse) {
          // Output in order: tool use, pre hooks, tool result, post hooks
          result.push(group.toolUse)
          result.push(...group.preHooks)
          if (group.toolResult) {
            result.push(group.toolResult)
          }
          result.push(...group.postHooks)
        }
      }
      continue
    }

    // Check if this message is part of a tool use group
    if (
      isHookAttachmentMessage(message) &&
      (message.attachment.hookEvent === 'PreToolUse' ||
        message.attachment.hookEvent === 'PostToolUse')
    ) {
      // Skip - already handled in tool use groups
      continue
    }

    if (
      message.type === 'user' &&
      message.message.content[0]?.type === 'tool_result'
    ) {
      // Skip - already handled in tool use groups
      continue
    }

    // Handle api error messages (only keep the last one)
    if (message.type === 'system' && message.subtype === 'api_error') {
      const last = result.at(-1)
      if (last?.type === 'system' && last.subtype === 'api_error') {
        result[result.length - 1] = message
      } else {
        result.push(message)
      }
      continue
    }

    // Add standalone messages
    result.push(message)
  }

  // Add synthetic streaming tool use messages
  for (const message of syntheticStreamingToolUseMessages) {
    result.push(message)
  }

  // Filter to keep only the last api error message
  const last = result.at(-1)
  return result.filter(
    _ => _.type !== 'system' || _.subtype !== 'api_error' || _ === last,
  )
}


// hasUnresolvedHooks, getToolResultIDs, getSiblingToolUseIDs
// moved to messageUtilities.ts (re-exported above)

// MessageLookups type moved to messageUtilities.ts (re-exported above)

// IncrementalLookupCache, _lookupCache, resetMessageLookupsCache
// moved to messageUtilities.ts (re-exported above)

// _processNewMessages moved to messageUtilities.ts

// _processNewNormalizedMessages, _recomputeOrphans, _fullRebuild,
// buildMessageLookups, EMPTY_LOOKUPS, EMPTY_STRING_SET, buildSubagentLookups,
// getSiblingToolUseIDsFromLookup, getProgressMessagesFromLookup,
// hasUnresolvedHooksFromLookup, getToolUseIDs
// moved to messageUtilities.ts (re-exported above)

/**
 * Reorders messages so that attachments bubble up until they hit either:
 * - A tool call result (user message with tool_result content)
 * - Any assistant message
 */
// reorderAttachmentsForAPI is now in messageNormalization.ts (re-exported above)

export function isSystemLocalCommandMessage(
  message: Message,
): message is SystemLocalCommandMessage {
  return message.type === 'system' && message.subtype === 'local_command'
}

// stripUnavailableToolReferencesFromUserMessage, appendMessageTagToUserMessage,
// stripToolReferenceBlocksFromUserMessage, stripCallerFieldFromAssistantMessage,
// and contentHasToolReference are now in messageNormalization.ts (re-exported above).

/**
 * Appends a [id:...] message ID tag to the last text block of a user message.
 * Only mutates the API-bound copy, not the stored message.
 * This lets Claude reference message IDs when calling the snip tool.
 * Private helper — not extracted to avoid coupling deriveShortMessageId into messageNormalization.
 */
function appendMessageTagToUserMessage(message: UserMessage): UserMessage {
  if (message.isMeta) {
    return message
  }

  const tag = `\n[id:${deriveShortMessageId(message.uuid)}]`

  const content = message.message.content

  // Handle string content (most common for simple text input)
  if (typeof content === 'string') {
    return {
      ...message,
      message: {
        ...message.message,
        content: content + tag,
      },
    }
  }

  if (!Array.isArray(content) || content.length === 0) {
    return message
  }

  // Find the last text block
  let lastTextIdx = -1
  for (let i = content.length - 1; i >= 0; i--) {
    if (content[i]!.type === 'text') {
      lastTextIdx = i
      break
    }
  }
  if (lastTextIdx === -1) {
    return message
  }

  const newContent = [...content]
  const textBlock = newContent[lastTextIdx] as TextBlockParam
  newContent[lastTextIdx] = {
    ...textBlock,
    text: textBlock.text + tag,
  }

  return {
    ...message,
    message: {
      ...message.message,
      content: newContent as typeof content,
    },
  }
}

// ensureSystemReminderWrap, smooshSystemReminderSiblings, sanitizeErrorToolResultContent,
// and relocateToolReferenceSiblings are now in messageNormalization.ts (re-exported above).

export function normalizeMessagesForAPI(
  messages: Message[],
  tools: Tools = [],
): (UserMessage | AssistantMessage)[] {
  // Build set of available tool names for filtering unavailable tool references
  const availableToolNames = new Set(tools.map(t => t.name))

  // First, reorder attachments to bubble up until they hit a tool result or assistant message
  // Then strip virtual messages — they're display-only (e.g. REPL inner tool
  // calls) and must never reach the API.
  const reorderedMessages = reorderAttachmentsForAPI(messages).filter(
    m => !((m.type === 'user' || m.type === 'assistant') && m.isVirtual),
  )

  // Build a map from error text → which block types to strip from the preceding user message.
  const errorToBlockTypes: Record<string, Set<string>> = {
    [getPdfTooLargeErrorMessage()]: new Set(['document']),
    [getPdfPasswordProtectedErrorMessage()]: new Set(['document']),
    [getPdfInvalidErrorMessage()]: new Set(['document']),
    [getImageTooLargeErrorMessage()]: new Set(['image']),
    [getRequestTooLargeErrorMessage()]: new Set(['document', 'image']),
  }

  // Walk the reordered messages to build a targeted strip map:
  // userMessageUUID → set of block types to strip from that message.
  const stripTargets = new Map<string, Set<string>>()
  for (let i = 0; i < reorderedMessages.length; i++) {
    const msg = reorderedMessages[i]!
    if (!isSyntheticApiErrorMessage(msg)) {
      continue
    }
    // Determine which error this is
    const errorText =
      Array.isArray(msg.message.content) &&
      msg.message.content[0]?.type === 'text'
        ? msg.message.content[0].text
        : undefined
    if (!errorText) {
      continue
    }
    const blockTypesToStrip = errorToBlockTypes[errorText]
    if (!blockTypesToStrip) {
      continue
    }
    // Walk backward to find the nearest preceding isMeta user message
    for (let j = i - 1; j >= 0; j--) {
      const candidate = reorderedMessages[j]!
      if (candidate.type === 'user' && candidate.isMeta) {
        const existing = stripTargets.get(candidate.uuid)
        if (existing) {
          for (const t of blockTypesToStrip) {
            existing.add(t)
          }
        } else {
          stripTargets.set(candidate.uuid, new Set(blockTypesToStrip))
        }
        break
      }
      // Skip over other synthetic error messages or non-meta messages
      if (isSyntheticApiErrorMessage(candidate)) {
        continue
      }
      // Stop if we hit an assistant message or non-meta user message
      break
    }
  }

  const result: (UserMessage | AssistantMessage)[] = []
  reorderedMessages
    .filter(
      (
        _,
      ): _ is
        | UserMessage
        | AssistantMessage
        | AttachmentMessage
        | SystemLocalCommandMessage => {
        if (
          _.type === 'progress' ||
          (_.type === 'system' && !isSystemLocalCommandMessage(_)) ||
          isSyntheticApiErrorMessage(_)
        ) {
          return false
        }
        return true
      },
    )
    .forEach(message => {
      switch (message.type) {
        case 'system': {
          // local_command system messages need to be included as user messages
          // so the model can reference previous command output in later turns
          const userMsg = createUserMessage({
            content: message.content,
            uuid: message.uuid,
            timestamp: message.timestamp,
          })
          const lastMessage = last(result)
          if (lastMessage?.type === 'user') {
            result[result.length - 1] = mergeUserMessages(lastMessage, userMsg)
            return
          }
          result.push(userMsg)
          return
        }
        case 'user': {
          // Merge consecutive user messages because Bedrock doesn't support
          // multiple user messages in a row; 1P API does and merges them
          // into a single user turn

          // When tool search is NOT enabled, strip all tool_reference blocks from
          // tool_result content, as these are only valid with the tool search beta.
          // When tool search IS enabled, strip only tool_reference blocks for
          // tools that no longer exist (e.g., MCP server was disconnected).
          let normalizedMessage = message
          if (!isToolSearchEnabledOptimistic()) {
            normalizedMessage = stripToolReferenceBlocksFromUserMessage(message)
          } else {
            normalizedMessage = stripUnavailableToolReferencesFromUserMessage(
              message,
              availableToolNames,
            )
          }

          // Strip document/image blocks from the specific meta user message that
          // preceded a PDF/image/request-too-large error, to prevent re-sending
          // the problematic content on every subsequent API call.
          const typesToStrip = stripTargets.get(normalizedMessage.uuid)
          if (typesToStrip && normalizedMessage.isMeta) {
            const content = normalizedMessage.message.content
            if (Array.isArray(content)) {
              const filtered = content.filter(
                block => !typesToStrip.has(block.type),
              )
              if (filtered.length === 0) {
                // All content blocks were stripped; skip this message entirely
                return
              }
              if (filtered.length < content.length) {
                normalizedMessage = {
                  ...normalizedMessage,
                  message: {
                    ...normalizedMessage.message,
                    content: filtered,
                  },
                }
              }
            }
          }

          // Server renders tool_reference expansion as <functions>...</functions>
          // (same tags as the system prompt's tool block). When this is at the
          // prompt tail, capybara models sample the stop sequence at ~10% (A/B:
          // 21/200 vs 0/200 on v3-prod). A sibling text block inserts a clean
          // "\n\nHuman: ..." turn boundary. Injected here (API-prep) rather than
          // stored in the message so it never renders in the REPL, and is
          // auto-skipped when strip* above removes all tool_reference content.
          // Must be a sibling, NOT inside tool_result.content — mixing text with
          // tool_reference inside the block is a server ValueError.
          // Idempotent: query.ts calls this per-tool-result; the output flows
          // back through here via claude.ts on the next API request. The first
          // pass's sibling gets a \n[id:xxx] suffix from appendMessageTag below,
          // so startsWith matches both bare and tagged forms.
          //
          // Gated OFF when tengu_toolref_defer_j8m is active — that gate
          // enables relocateToolReferenceSiblings in post-processing below,
          // which moves existing siblings to a later non-ref message instead
          // of adding one here. This injection is itself one of the patterns
          // that gets relocated, so skipping it saves a scan. When gate is
          // off, this is the fallback (same as pre-#21049 main).
          if (
            !checkStatsigFeatureGate_CACHED_MAY_BE_STALE(
              'tengu_toolref_defer_j8m',
            )
          ) {
            const contentAfterStrip = normalizedMessage.message.content
            if (
              Array.isArray(contentAfterStrip) &&
              !contentAfterStrip.some(
                b =>
                  b.type === 'text' &&
                  b.text.startsWith(TOOL_REFERENCE_TURN_BOUNDARY),
              ) &&
              contentHasToolReference(contentAfterStrip)
            ) {
              normalizedMessage = {
                ...normalizedMessage,
                message: {
                  ...normalizedMessage.message,
                  content: [
                    ...contentAfterStrip,
                    { type: 'text', text: TOOL_REFERENCE_TURN_BOUNDARY },
                  ],
                },
              }
            }
          }

          // If the last message is also a user message, merge them
          const lastMessage = last(result)
          if (lastMessage?.type === 'user') {
            result[result.length - 1] = mergeUserMessages(
              lastMessage,
              normalizedMessage,
            )
            return
          }

          // Otherwise, add the message normally
          result.push(normalizedMessage)
          return
        }
        case 'assistant': {
          // Normalize tool inputs for API (strip fields like plan from ExitPlanModeV2)
          // When tool search is NOT enabled, we must strip tool_search-specific fields
          // like 'caller' from tool_use blocks, as these are only valid with the
          // tool search beta header
          const toolSearchEnabled = isToolSearchEnabledOptimistic()
          const normalizedMessage: AssistantMessage = {
            ...message,
            message: {
              ...message.message,
              content: message.message.content.map(block => {
                if (block.type === 'tool_use') {
                  const tool = tools.find(t => toolMatchesName(t, block.name))
                  const normalizedInput = tool
                    ? normalizeToolInputForAPI(
                        tool,
                        block.input as Record<string, unknown>,
                      )
                    : block.input
                  const canonicalName = tool?.name ?? block.name

                  // When tool search is enabled, preserve all fields including 'caller'
                  if (toolSearchEnabled) {
                    return {
                      ...block,
                      name: canonicalName,
                      input: normalizedInput,
                    }
                  }

                  // When tool search is NOT enabled, explicitly construct tool_use
                  // block with only standard API fields to avoid sending fields like
                  // 'caller' that may be stored in sessions from tool search runs
                  return {
                    type: 'tool_use' as const,
                    id: block.id,
                    name: canonicalName,
                    input: normalizedInput,
                  }
                }
                return block
              }),
            },
          }

          // Find a previous assistant message with the same message ID and merge.
          // Walk backwards, skipping tool results and different-ID assistants,
          // since concurrent agents (teammates) can interleave streaming content
          // blocks from multiple API responses with different message IDs.
          for (let i = result.length - 1; i >= 0; i--) {
            const msg = result[i]!

            if (msg.type !== 'assistant' && !isToolResultMessage(msg)) {
              break
            }

            if (msg.type === 'assistant') {
              if (msg.message.id === normalizedMessage.message.id) {
                result[i] = mergeAssistantMessages(msg, normalizedMessage)
                return
              }
              continue
            }
          }

          result.push(normalizedMessage)
          return
        }
        case 'attachment': {
          const rawAttachmentMessage = normalizeAttachmentForAPI(
            message.attachment,
          )
          const attachmentMessage = checkStatsigFeatureGate_CACHED_MAY_BE_STALE(
            'tengu_chair_sermon',
          )
            ? rawAttachmentMessage.map(ensureSystemReminderWrap)
            : rawAttachmentMessage

          // If the last message is also a user message, merge them
          const lastMessage = last(result)
          if (lastMessage?.type === 'user') {
            result[result.length - 1] = attachmentMessage.reduce(
              (p, c) => mergeUserMessagesAndToolResults(p, c),
              lastMessage,
            )
            return
          }

          result.push(...attachmentMessage)
          return
        }
      }
    })

  // Relocate text siblings off tool_reference messages — prevents the
  // anomalous two-consecutive-human-turns pattern that teaches the model
  // to emit the stop sequence after tool results. See #21049.
  // Runs after merge (siblings are in place) and before ID tagging (so
  // tags reflect final positions). When gate is OFF, this is a noop and
  // the TOOL_REFERENCE_TURN_BOUNDARY injection above serves as fallback.
  const relocated = checkStatsigFeatureGate_CACHED_MAY_BE_STALE(
    'tengu_toolref_defer_j8m',
  )
    ? relocateToolReferenceSiblings(result)
    : result

  // Filter orphaned thinking-only assistant messages (likely introduced by
  // compaction slicing away intervening messages between a failed streaming
  // response and its retry). Without this, consecutive assistant messages with
  // mismatched thinking block signatures cause API 400 errors.
  const withFilteredOrphans = filterOrphanedThinkingOnlyMessages(relocated)

  // Order matters: strip trailing thinking first, THEN filter whitespace-only
  // messages. The reverse order has a bug: a message like [text("\n\n"), thinking("...")]
  // survives the whitespace filter (has a non-text block), then thinking stripping
  // removes the thinking block, leaving [text("\n\n")] — which the API rejects.
  //
  // These multi-pass normalizations are inherently fragile — each pass can create
  // conditions a prior pass was meant to handle. Consider unifying into a single
  // pass that cleans content, then validates in one shot.
  const withFilteredThinking =
    filterTrailingThinkingFromLastAssistant(withFilteredOrphans)
  const withFilteredWhitespace =
    filterWhitespaceOnlyAssistantMessages(withFilteredThinking)
  const withNonEmpty = ensureNonEmptyAssistantContent(withFilteredWhitespace)

  // filterOrphanedThinkingOnlyMessages doesn't merge adjacent users (whitespace
  // filter does, but only when IT fires). Merge here so smoosh can fold the
  // SR-text sibling that hoistToolResults produces. The smoosh itself folds
  // <system-reminder>-prefixed text siblings into the adjacent tool_result.
  // Gated together: the merge exists solely to feed the smoosh; running it
  // ungated changes VCR fixture hashes for @-mention scenarios (adjacent
  // [prompt, attachment] users) without any benefit when the smoosh is off.
  const smooshed = checkStatsigFeatureGate_CACHED_MAY_BE_STALE(
    'tengu_chair_sermon',
  )
    ? smooshSystemReminderSiblings(mergeAdjacentUserMessages(withNonEmpty))
    : withNonEmpty

  // Unconditional — catches transcripts persisted before smooshIntoToolResult
  // learned to filter on is_error. Without this a resumed session with an
  // image-in-error tool_result 400s forever.
  const sanitized = sanitizeErrorToolResultContent(smooshed)

  // Append message ID tags for snip tool visibility (after all merging,
  // so tags always match the surviving message's messageId field).
  // Skip in test mode — tags change message content hashes, breaking
  // VCR fixture lookup. Gate must match SnipTool.isEnabled() — don't
  // inject [id:] tags when the tool isn't available (confuses the model
  // and wastes tokens on every non-meta user message for every ant).
  if (feature('HISTORY_SNIP') && process.env.NODE_ENV !== 'test') {
    const { isSnipRuntimeEnabled } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../services/compact/snipCompact.js') as typeof import('../services/compact/snipCompact.js')
    if (isSnipRuntimeEnabled()) {
      for (let i = 0; i < sanitized.length; i++) {
        if (sanitized[i]!.type === 'user') {
          sanitized[i] = appendMessageTagToUserMessage(
            sanitized[i] as UserMessage,
          )
        }
      }
    }
  }

  // Validate all images are within API size limits before sending
  validateImagesForAPI(sanitized)

  return sanitized
}

// normalizeContentFromAPI, isEmptyMessageText, and stripPromptXMLTags are now
// in messageNormalization.ts (re-exported above).

// getToolUseID moved to messageUtilities.ts (re-exported above)

// filterUnresolvedToolUses is in messageFiltering.ts (imported above)

// getAssistantMessageText, getUserMessageText, textForResubmit
// moved to messageUtilities.ts (re-exported above)


// Re-export streaming types and handler from messageStream.ts (extracted in Phase 8)
export {
  handleMessageFromStream,
  type StreamingThinking,
  type StreamingToolUse,
} from './messageStream.js'

// Re-export attachment/content functions from messageAttachments.ts (extracted in Phase 7)
export {
  extractTextContent,
  getContentText,
  normalizeAttachmentForAPI,
  PLAN_PHASE4_CONTROL,
} from './messageAttachments.js'

export function createSystemMessage(
  content: string,
  level: SystemMessageLevel,
  toolUseID?: string,
  preventContinuation?: boolean,
): SystemInformationalMessage {
  return {
    type: 'system',
    subtype: 'informational',
    content,
    isMeta: false,
    timestamp: new Date().toISOString(),
    uuid: randomUUID(),
    toolUseID,
    level,
    ...(preventContinuation && { preventContinuation }),
  }
}

export function createPermissionRetryMessage(
  commands: string[],
): SystemPermissionRetryMessage {
  return {
    type: 'system',
    subtype: 'permission_retry',
    content: `Allowed ${commands.join(', ')}`,
    commands,
    level: 'info',
    isMeta: false,
    timestamp: new Date().toISOString(),
    uuid: randomUUID(),
  }
}

export function createBridgeStatusMessage(
  url: string,
  upgradeNudge?: string,
): SystemBridgeStatusMessage {
  return {
    type: 'system',
    subtype: 'bridge_status',
    content: `/remote-control is active. Code in CLI or at ${url}`,
    url,
    upgradeNudge,
    isMeta: false,
    timestamp: new Date().toISOString(),
    uuid: randomUUID(),
  }
}

export function createScheduledTaskFireMessage(
  content: string,
): SystemScheduledTaskFireMessage {
  return {
    type: 'system',
    subtype: 'scheduled_task_fire',
    content,
    isMeta: false,
    timestamp: new Date().toISOString(),
    uuid: randomUUID(),
  }
}

export function createStopHookSummaryMessage(
  hookCount: number,
  hookInfos: StopHookInfo[],
  hookErrors: string[],
  preventedContinuation: boolean,
  stopReason: string | undefined,
  hasOutput: boolean,
  level: SystemMessageLevel,
  toolUseID?: string,
  hookLabel?: string,
  totalDurationMs?: number,
): SystemStopHookSummaryMessage {
  return {
    type: 'system',
    subtype: 'stop_hook_summary',
    hookCount,
    hookInfos,
    hookErrors,
    preventedContinuation,
    stopReason,
    hasOutput,
    level,
    timestamp: new Date().toISOString(),
    uuid: randomUUID(),
    toolUseID,
    hookLabel,
    totalDurationMs,
  }
}

export function createTurnDurationMessage(
  durationMs: number,
  budget?: { tokens: number; limit: number; nudges: number },
  messageCount?: number,
): SystemTurnDurationMessage {
  return {
    type: 'system',
    subtype: 'turn_duration',
    durationMs,
    budgetTokens: budget?.tokens,
    budgetLimit: budget?.limit,
    budgetNudges: budget?.nudges,
    messageCount,
    timestamp: new Date().toISOString(),
    uuid: randomUUID(),
    isMeta: false,
  }
}

export function createAwaySummaryMessage(
  content: string,
): SystemAwaySummaryMessage {
  return {
    type: 'system',
    subtype: 'away_summary',
    content,
    timestamp: new Date().toISOString(),
    uuid: randomUUID(),
    isMeta: false,
  }
}

export function createMemorySavedMessage(
  writtenPaths: string[],
): SystemMemorySavedMessage {
  return {
    type: 'system',
    subtype: 'memory_saved',
    writtenPaths,
    timestamp: new Date().toISOString(),
    uuid: randomUUID(),
    isMeta: false,
  }
}

export function createAgentsKilledMessage(): SystemAgentsKilledMessage {
  return {
    type: 'system',
    subtype: 'agents_killed',
    timestamp: new Date().toISOString(),
    uuid: randomUUID(),
    isMeta: false,
  }
}

export function createApiMetricsMessage(metrics: {
  ttftMs: number
  otps: number
  isP50?: boolean
  hookDurationMs?: number
  turnDurationMs?: number
  toolDurationMs?: number
  classifierDurationMs?: number
  toolCount?: number
  hookCount?: number
  classifierCount?: number
  configWriteCount?: number
}): SystemApiMetricsMessage {
  return {
    type: 'system',
    subtype: 'api_metrics',
    ttftMs: metrics.ttftMs,
    otps: metrics.otps,
    isP50: metrics.isP50,
    hookDurationMs: metrics.hookDurationMs,
    turnDurationMs: metrics.turnDurationMs,
    toolDurationMs: metrics.toolDurationMs,
    classifierDurationMs: metrics.classifierDurationMs,
    toolCount: metrics.toolCount,
    hookCount: metrics.hookCount,
    classifierCount: metrics.classifierCount,
    configWriteCount: metrics.configWriteCount,
    timestamp: new Date().toISOString(),
    uuid: randomUUID(),
    isMeta: false,
  }
}

export function createCommandInputMessage(
  content: string,
): SystemLocalCommandMessage {
  return {
    type: 'system',
    subtype: 'local_command',
    content,
    level: 'info',
    timestamp: new Date().toISOString(),
    uuid: randomUUID(),
    isMeta: false,
  }
}

export function createCompactBoundaryMessage(
  trigger: 'manual' | 'auto',
  preTokens: number,
  lastPreCompactMessageUuid?: UUID,
  userContext?: string,
  messagesSummarized?: number,
): SystemCompactBoundaryMessage {
  return {
    type: 'system',
    subtype: 'compact_boundary',
    content: `Conversation compacted`,
    isMeta: false,
    timestamp: new Date().toISOString(),
    uuid: randomUUID(),
    level: 'info',
    compactMetadata: {
      trigger,
      preTokens,
      userContext,
      messagesSummarized,
    },
    ...(lastPreCompactMessageUuid && {
      logicalParentUuid: lastPreCompactMessageUuid,
    }),
  }
}

export function createMicrocompactBoundaryMessage(
  trigger: 'auto',
  preTokens: number,
  tokensSaved: number,
  compactedToolIds: string[],
  clearedAttachmentUUIDs: string[],
): SystemMicrocompactBoundaryMessage {
  logForDebugging(
    `[microcompact] saved ~${formatTokens(tokensSaved)} tokens (cleared ${compactedToolIds.length} tool results)`,
  )
  return {
    type: 'system',
    subtype: 'microcompact_boundary',
    content: 'Context microcompacted',
    isMeta: false,
    timestamp: new Date().toISOString(),
    uuid: randomUUID(),
    level: 'info',
    microcompactMetadata: {
      trigger,
      preTokens,
      tokensSaved,
      compactedToolIds,
      clearedAttachmentUUIDs,
    },
  }
}

export function createSystemAPIErrorMessage(
  error: APIError,
  retryInMs: number,
  retryAttempt: number,
  maxRetries: number,
): SystemAPIErrorMessage {
  return {
    type: 'system',
    subtype: 'api_error',
    level: 'error',
    cause: error.cause instanceof Error ? error.cause : undefined,
    error,
    retryInMs,
    retryAttempt,
    maxRetries,
    timestamp: new Date().toISOString(),
    uuid: randomUUID(),
  }
}

// isCompactBoundaryMessage, findLastCompactBoundaryIndex, getMessagesAfterCompactBoundary,
// shouldShowUserMessage, isThinkingMessage, countToolCalls, hasSuccessfulToolCall
// moved to messageUtilities.ts (re-exported above)


/**
 * Creates a tool use summary message for SDK emission.
 * Tool use summaries provide human-readable progress updates after tool batches complete.
 */
export function createToolUseSummaryMessage(
  summary: string,
  precedingToolUseIds: string[],
): ToolUseSummaryMessage {
  return {
    type: 'tool_use_summary',
    summary,
    precedingToolUseIds,
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
  }
}

/**
 * Defensive validation: ensure tool_use/tool_result pairing is correct.
 *
 * Handles both directions:
 * - Forward: inserts synthetic error tool_result blocks for tool_use blocks missing results
 * - Reverse: strips orphaned tool_result blocks referencing non-existent tool_use blocks
 *
 * Logs when this activates to help identify the root cause.
 *
 * Strict mode: when getStrictToolResultPairing() is true (HFI opts in at
 * startup), any mismatch throws instead of repairing. For training-data
 * collection, a model response conditioned on synthetic placeholders is
 * tainted — fail the trajectory rather than waste labeler time on a turn
 * that will be rejected at submission anyway.
 */
export function ensureToolResultPairing(
  messages: (UserMessage | AssistantMessage)[],
): (UserMessage | AssistantMessage)[] {
  const result: (UserMessage | AssistantMessage)[] = []
  let repaired = false

  // Cross-message tool_use ID tracking. The per-message seenToolUseIds below
  // only caught duplicates within a single assistant's content array (the
  // normalizeMessagesForAPI-merged case). When two assistants with DIFFERENT
  // message.id carry the same tool_use ID — e.g. orphan handler re-pushed an
  // assistant already present in mutableMessages with a fresh message.id, or
  // normalizeMessagesForAPI's backward walk broke on an intervening user
  // message — the dup lived in separate result entries and the API rejected
  // with "tool_use ids must be unique", deadlocking the session (CC-1212).
  const allSeenToolUseIds = new Set<string>()

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!

    if (msg.type !== 'assistant') {
      // A user message with tool_result blocks but NO preceding assistant
      // message in the output has orphaned tool_results. The assistant
      // lookahead below only validates assistant→user adjacency; it never
      // sees user messages at index 0 or user messages preceded by another
      // user. This happens on resume when the transcript starts mid-turn
      // (e.g. messages[0] is a tool_result whose assistant pair was dropped
      // by earlier compaction — API rejects with "messages.0.content:
      // unexpected tool_use_id").
      if (
        msg.type === 'user' &&
        Array.isArray(msg.message.content) &&
        result.at(-1)?.type !== 'assistant'
      ) {
        const stripped = msg.message.content.filter(
          block =>
            !(
              typeof block === 'object' &&
              'type' in block &&
              block.type === 'tool_result'
            ),
        )
        if (stripped.length !== msg.message.content.length) {
          repaired = true
          // If stripping emptied the message and nothing has been pushed yet,
          // keep a placeholder so the payload still starts with a user
          // message (normalizeMessagesForAPI runs before us, so messages[1]
          // is an assistant — dropping messages[0] entirely would yield a
          // payload starting with assistant, a different 400).
          const content =
            stripped.length > 0
              ? stripped
              : result.length === 0
                ? [
                    {
                      type: 'text' as const,
                      text: '[Orphaned tool result removed due to conversation resume]',
                    },
                  ]
                : null
          if (content !== null) {
            result.push({
              ...msg,
              message: { ...msg.message, content },
            })
          }
          continue
        }
      }
      result.push(msg)
      continue
    }

    // Collect server-side tool result IDs (*_tool_result blocks have tool_use_id).
    const serverResultIds = new Set<string>()
    for (const c of msg.message.content) {
      if ('tool_use_id' in c && typeof c.tool_use_id === 'string') {
        serverResultIds.add(c.tool_use_id)
      }
    }

    // Dedupe tool_use blocks by ID. Checks against the cross-message
    // allSeenToolUseIds Set so a duplicate in a LATER assistant (different
    // message.id, not merged by normalizeMessagesForAPI) is also stripped.
    // The per-message seenToolUseIds tracks only THIS assistant's surviving
    // IDs — the orphan/missing-result detection below needs a per-message
    // view, not the cumulative one.
    //
    // Also strip orphaned server-side tool use blocks (server_tool_use,
    // mcp_tool_use) whose result blocks live in the SAME assistant message.
    // If the stream was interrupted before the result arrived, the use block
    // has no matching *_tool_result and the API rejects with e.g. "advisor
    // tool use without corresponding advisor_tool_result".
    const seenToolUseIds = new Set<string>()
    const finalContent = msg.message.content.filter(block => {
      if (block.type === 'tool_use') {
        if (allSeenToolUseIds.has(block.id)) {
          repaired = true
          return false
        }
        allSeenToolUseIds.add(block.id)
        seenToolUseIds.add(block.id)
      }
      if (
        (block.type === 'server_tool_use' || block.type === 'mcp_tool_use') &&
        !serverResultIds.has((block as { id: string }).id)
      ) {
        repaired = true
        return false
      }
      return true
    })

    const assistantContentChanged =
      finalContent.length !== msg.message.content.length

    // If stripping orphaned server tool uses empties the content array,
    // insert a placeholder so the API doesn't reject empty assistant content.
    if (finalContent.length === 0) {
      finalContent.push({
        type: 'text' as const,
        text: '[Tool use interrupted]',
        citations: [],
      })
    }

    const assistantMsg = assistantContentChanged
      ? {
          ...msg,
          message: { ...msg.message, content: finalContent },
        }
      : msg

    result.push(assistantMsg)

    // Collect tool_use IDs from this assistant message
    const toolUseIds = [...seenToolUseIds]

    // Check the next message for matching tool_results. Also track duplicate
    // tool_result blocks (same tool_use_id appearing twice) — for transcripts
    // corrupted before Fix 1 shipped, the orphan handler ran to completion
    // multiple times, producing [asst(X), user(tr_X), asst(X), user(tr_X)] which
    // normalizeMessagesForAPI merges to [asst([X,X]), user([tr_X,tr_X])]. The
    // tool_use dedup above strips the second X; without also stripping the
    // second tr_X, the API rejects with a duplicate-tool_result 400 and the
    // session stays stuck.
    const nextMsg = messages[i + 1]
    const existingToolResultIds = new Set<string>()
    let hasDuplicateToolResults = false

    if (nextMsg?.type === 'user') {
      const content = nextMsg.message.content
      if (Array.isArray(content)) {
        for (const block of content) {
          if (
            typeof block === 'object' &&
            'type' in block &&
            block.type === 'tool_result'
          ) {
            const trId = (block as ToolResultBlockParam).tool_use_id
            if (existingToolResultIds.has(trId)) {
              hasDuplicateToolResults = true
            }
            existingToolResultIds.add(trId)
          }
        }
      }
    }

    // Find missing tool_result IDs (forward direction: tool_use without tool_result)
    const toolUseIdSet = new Set(toolUseIds)
    const missingIds = toolUseIds.filter(id => !existingToolResultIds.has(id))

    // Find orphaned tool_result IDs (reverse direction: tool_result without tool_use)
    const orphanedIds = [...existingToolResultIds].filter(
      id => !toolUseIdSet.has(id),
    )

    if (
      missingIds.length === 0 &&
      orphanedIds.length === 0 &&
      !hasDuplicateToolResults
    ) {
      continue
    }

    repaired = true

    // Build synthetic error tool_result blocks for missing IDs
    const syntheticBlocks: ToolResultBlockParam[] = missingIds.map(id => ({
      type: 'tool_result' as const,
      tool_use_id: id,
      content: SYNTHETIC_TOOL_RESULT_PLACEHOLDER,
      is_error: true,
    }))

    if (nextMsg?.type === 'user') {
      // Next message is already a user message - patch it
      let content: (ContentBlockParam | ContentBlock)[] = Array.isArray(
        nextMsg.message.content,
      )
        ? nextMsg.message.content
        : [{ type: 'text' as const, text: nextMsg.message.content }]

      // Strip orphaned tool_results and dedupe duplicate tool_result IDs
      if (orphanedIds.length > 0 || hasDuplicateToolResults) {
        const orphanedSet = new Set(orphanedIds)
        const seenTrIds = new Set<string>()
        content = content.filter(block => {
          if (
            typeof block === 'object' &&
            'type' in block &&
            block.type === 'tool_result'
          ) {
            const trId = (block as ToolResultBlockParam).tool_use_id
            if (orphanedSet.has(trId)) return false
            if (seenTrIds.has(trId)) return false
            seenTrIds.add(trId)
          }
          return true
        })
      }

      const patchedContent = [...syntheticBlocks, ...content]

      // If content is now empty after stripping orphans, skip the user message
      if (patchedContent.length > 0) {
        const patchedNext: UserMessage = {
          ...nextMsg,
          message: {
            ...nextMsg.message,
            content: patchedContent,
          },
        }
        i++
        // Prepending synthetics to existing content can produce a
        // [tool_result, text] sibling the smoosh inside normalize never saw
        // (pairing runs after normalize). Re-smoosh just this one message.
        result.push(
          checkStatsigFeatureGate_CACHED_MAY_BE_STALE('tengu_chair_sermon')
            ? smooshSystemReminderSiblings([patchedNext])[0]!
            : patchedNext,
        )
      } else {
        // Content is empty after stripping orphaned tool_results. We still
        // need a user message here to maintain role alternation — otherwise
        // the assistant placeholder we just pushed would be immediately
        // followed by the NEXT assistant message, which the API rejects with
        // a role-alternation 400 (not the duplicate-id 400 we handle).
        i++
        result.push(
          createUserMessage({
            content: NO_CONTENT_MESSAGE,
            isMeta: true,
          }),
        )
      }
    } else {
      // No user message follows - insert a synthetic user message (only if missing IDs)
      if (syntheticBlocks.length > 0) {
        result.push(
          createUserMessage({
            content: syntheticBlocks,
            isMeta: true,
          }),
        )
      }
    }
  }

  if (repaired) {
    // Capture diagnostic info to help identify root cause
    const messageTypes = messages.map((m, idx) => {
      if (m.type === 'assistant') {
        // Merged filter+map into reduce to avoid intermediate array allocations
        const toolUses = m.message.content.reduce<string[]>((acc, b) => {
          if (b.type === 'tool_use')
            acc.push((b as ToolUseBlock | ToolUseBlockParam).id)
          return acc
        }, [])
        const serverToolUses = m.message.content.reduce<string[]>((acc, b) => {
          if (b.type === 'server_tool_use' || b.type === 'mcp_tool_use')
            acc.push((b as { id: string }).id)
          return acc
        }, [])
        const parts = [
          `id=${m.message.id}`,
          `tool_uses=[${toolUses.join(',')}]`,
        ]
        if (serverToolUses.length > 0) {
          parts.push(`server_tool_uses=[${serverToolUses.join(',')}]`)
        }
        return `[${idx}] assistant(${parts.join(', ')})`
      }
      if (m.type === 'user' && Array.isArray(m.message.content)) {
        // Merged filter+map into reduce to avoid intermediate array allocation
        const toolResults = m.message.content.reduce<string[]>((acc, b) => {
          if (typeof b === 'object' && 'type' in b && b.type === 'tool_result')
            acc.push((b as ToolResultBlockParam).tool_use_id)
          return acc
        }, [])
        if (toolResults.length > 0) {
          return `[${idx}] user(tool_results=[${toolResults.join(',')}])`
        }
      }
      return `[${idx}] ${m.type}`
    })

    if (getStrictToolResultPairing()) {
      throw new Error(
        `ensureToolResultPairing: tool_use/tool_result pairing mismatch detected (strict mode). ` +
          `Refusing to repair — would inject synthetic placeholders into model context. ` +
          `Message structure: ${messageTypes.join('; ')}. See inc-4977.`,
      )
    }

    logEvent('tengu_tool_result_pairing_repaired', {
      messageCount: messages.length,
      repairedMessageCount: result.length,
      messageTypes: messageTypes.join(
        '; ',
      ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    logError(
      new Error(
        `ensureToolResultPairing: repaired missing tool_result blocks (${messages.length} -> ${result.length} messages). Message structure: ${messageTypes.join('; ')}`,
      ),
    )
  }

  return result
}

// stripAdvisorBlocks, wrapCommandText
// moved to messageUtilities.ts (re-exported above)
