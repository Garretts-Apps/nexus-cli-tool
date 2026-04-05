/**
 * Message normalization / transformation functions.
 *
 * Extracted from messages.ts to reduce module size and isolate
 * message normalization logic from message-building and lookup utilities.
 */

import type {
  ContentBlockParam,
  TextBlockParam,
  ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/index.mjs'
import type {
  BetaMessage,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import isObject from 'lodash-es/isObject.js'
import type { AgentId } from 'src/types/ids.js'
import {
  logEvent,
} from 'src/services/analytics/index.js'
import { sanitizeToolNameForAnalytics } from 'src/services/analytics/metadata.js'
import { NO_CONTENT_MESSAGE } from '../constants/messages.js'
import type {
  AssistantMessage,
  AttachmentMessage,
  Message,
  NormalizedAssistantMessage,
  NormalizedMessage,
  NormalizedUserMessage,
  UserMessage,
} from '../types/message.js'
import type { UUID } from 'crypto'
import { normalizeToolInput } from './api.js'
import { logForDebugging } from './debug.js'
import { safeParseJSON } from './json.js'
import { logError } from './log.js'
import { normalizeLegacyToolName } from './permissions/permissionRuleParser.js'
import { isToolReferenceBlock } from './toolSearch.js'
import { findToolByName, type Tools } from '../Tool.js'
import { createUserMessage } from './messageCreation.js'
import { smooshIntoToolResult } from './messageMerging.js'

// ---------------------------------------------------------------------------
// UUID derivation
// ---------------------------------------------------------------------------

export function deriveUUID(parentUUID: UUID, index: number): UUID {
  const hex = index.toString(16).padStart(12, '0')
  return `${parentUUID.slice(0, 24)}${hex}` as UUID
}

// ---------------------------------------------------------------------------
// normalizeMessages
// ---------------------------------------------------------------------------

// Split messages, so each content block gets its own message
export function normalizeMessages(
  messages: AssistantMessage[],
): NormalizedAssistantMessage[]
export function normalizeMessages(
  messages: UserMessage[],
): NormalizedUserMessage[]
export function normalizeMessages(
  messages: (AssistantMessage | UserMessage)[],
): (NormalizedAssistantMessage | NormalizedUserMessage)[]
export function normalizeMessages(messages: Message[]): NormalizedMessage[]
export function normalizeMessages(messages: Message[]): NormalizedMessage[] {
  // isNewChain tracks whether we need to generate new UUIDs for messages when normalizing.
  // When a message has multiple content blocks, we split it into multiple messages,
  // each with a single content block. When this happens, we need to generate new UUIDs
  // for all subsequent messages to maintain proper ordering and prevent duplicate UUIDs.
  // This flag is set to true once we encounter a message with multiple content blocks,
  // and remains true for all subsequent messages in the normalization process.
  let isNewChain = false
  return messages.flatMap(message => {
    switch (message.type) {
      case 'assistant': {
        isNewChain = isNewChain || message.message.content.length > 1
        return message.message.content.map((_, index) => {
          const uuid = isNewChain
            ? deriveUUID(message.uuid, index)
            : message.uuid
          return {
            type: 'assistant' as const,
            timestamp: message.timestamp,
            message: {
              ...message.message,
              content: [_],
              context_management: message.message.context_management ?? null,
            },
            isMeta: message.isMeta,
            isVirtual: message.isVirtual,
            requestId: message.requestId,
            uuid,
            error: message.error,
            isApiErrorMessage: message.isApiErrorMessage,
            advisorModel: message.advisorModel,
          } as NormalizedAssistantMessage
        })
      }
      case 'attachment':
        return [message]
      case 'progress':
        return [message]
      case 'system':
        return [message]
      case 'user': {
        if (typeof message.message.content === 'string') {
          const uuid = isNewChain ? deriveUUID(message.uuid, 0) : message.uuid
          return [
            {
              ...message,
              uuid,
              message: {
                ...message.message,
                content: [{ type: 'text', text: message.message.content }],
              },
            } as NormalizedMessage,
          ]
        }
        isNewChain = isNewChain || message.message.content.length > 1
        let imageIndex = 0
        return message.message.content.map((_, index) => {
          const isImage = _.type === 'image'
          // For image content blocks, extract just the ID for this image
          const imageId =
            isImage && message.imagePasteIds
              ? message.imagePasteIds[imageIndex]
              : undefined
          if (isImage) imageIndex++
          return {
            ...createUserMessage({
              content: [_],
              toolUseResult: message.toolUseResult,
              mcpMeta: message.mcpMeta,
              isMeta: message.isMeta,
              isVisibleInTranscriptOnly: message.isVisibleInTranscriptOnly,
              isVirtual: message.isVirtual,
              timestamp: message.timestamp,
              imagePasteIds: imageId !== undefined ? [imageId] : undefined,
              origin: message.origin,
            }),
            uuid: isNewChain ? deriveUUID(message.uuid, index) : message.uuid,
          } as NormalizedMessage
        })
      }
    }
  })
}

// ---------------------------------------------------------------------------
// reorderAttachmentsForAPI
// ---------------------------------------------------------------------------

export function reorderAttachmentsForAPI(messages: Message[]): Message[] {
  // We build `result` backwards (push) and reverse once at the end — O(N).
  // Using unshift inside the loop would be O(N²).
  const result: Message[] = []
  // Attachments are pushed as we encounter them scanning bottom-up, so
  // this buffer holds them in reverse order (relative to the input array).
  const pendingAttachments: AttachmentMessage[] = []

  // Scan from the bottom up
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!

    if (message.type === 'attachment') {
      // Collect attachment to bubble up
      pendingAttachments.push(message)
    } else {
      // Check if this is a stopping point
      const isStoppingPoint =
        message.type === 'assistant' ||
        (message.type === 'user' &&
          Array.isArray(message.message.content) &&
          message.message.content[0]?.type === 'tool_result')

      if (isStoppingPoint && pendingAttachments.length > 0) {
        // Hit a stopping point — attachments stop here (go after the stopping point).
        // pendingAttachments is already reversed; after the final result.reverse()
        // they will appear in original order right after `message`.
        for (let j = 0; j < pendingAttachments.length; j++) {
          result.push(pendingAttachments[j]!)
        }
        result.push(message)
        pendingAttachments.length = 0
      } else {
        // Regular message
        result.push(message)
      }
    }
  }

  // Any remaining attachments bubble all the way to the top.
  for (let j = 0; j < pendingAttachments.length; j++) {
    result.push(pendingAttachments[j]!)
  }

  result.reverse()
  return result
}

// ---------------------------------------------------------------------------
// Tool reference stripping helpers
// ---------------------------------------------------------------------------

/**
 * Does the content array have a tool_result block whose inner content
 * contains tool_reference (ToolSearch loaded tools)?
 */
export function contentHasToolReference(
  content: ReadonlyArray<ContentBlockParam>,
): boolean {
  return content.some(
    block =>
      block.type === 'tool_result' &&
      Array.isArray(block.content) &&
      block.content.some(isToolReferenceBlock),
  )
}

/**
 * Strips tool_reference blocks from tool_result content in a user message.
 * tool_reference blocks are only valid when the tool search beta is enabled.
 * When tool search is disabled, we need to remove these blocks to avoid API errors.
 */
export function stripToolReferenceBlocksFromUserMessage(
  message: UserMessage,
): UserMessage {
  const content = message.message.content
  if (!Array.isArray(content)) {
    return message
  }

  const hasToolReference = content.some(
    block =>
      block.type === 'tool_result' &&
      Array.isArray(block.content) &&
      block.content.some(isToolReferenceBlock),
  )

  if (!hasToolReference) {
    return message
  }

  return {
    ...message,
    message: {
      ...message.message,
      content: content.map(block => {
        if (block.type !== 'tool_result' || !Array.isArray(block.content)) {
          return block
        }

        // Filter out tool_reference blocks from tool_result content
        const filteredContent = block.content.filter(
          c => !isToolReferenceBlock(c),
        )

        // If all content was tool_reference blocks, replace with a placeholder
        if (filteredContent.length === 0) {
          return {
            ...block,
            content: [
              {
                type: 'text' as const,
                text: '[Tool references removed - tool search not enabled]',
              },
            ],
          }
        }

        return {
          ...block,
          content: filteredContent,
        }
      }),
    },
  }
}

/**
 * Strips tool_reference blocks for tools that no longer exist from tool_result content.
 * This handles the case where a session was saved with MCP tools that are no longer
 * available (e.g., MCP server was disconnected, renamed, or removed).
 * Without this filtering, the API rejects with "Tool reference not found in available tools".
 */
export function stripUnavailableToolReferencesFromUserMessage(
  message: UserMessage,
  availableToolNames: Set<string>,
): UserMessage {
  const content = message.message.content
  if (!Array.isArray(content)) {
    return message
  }

  // Check if any tool_reference blocks point to unavailable tools
  const hasUnavailableReference = content.some(
    block =>
      block.type === 'tool_result' &&
      Array.isArray(block.content) &&
      block.content.some(c => {
        if (!isToolReferenceBlock(c)) return false
        const toolName = (c as { tool_name?: string }).tool_name
        return (
          toolName && !availableToolNames.has(normalizeLegacyToolName(toolName))
        )
      }),
  )

  if (!hasUnavailableReference) {
    return message
  }

  return {
    ...message,
    message: {
      ...message.message,
      content: content.map(block => {
        if (block.type !== 'tool_result' || !Array.isArray(block.content)) {
          return block
        }

        // Filter out tool_reference blocks for unavailable tools
        const filteredContent = block.content.filter(c => {
          if (!isToolReferenceBlock(c)) return true
          const rawToolName = (c as { tool_name?: string }).tool_name
          if (!rawToolName) return true
          const toolName = normalizeLegacyToolName(rawToolName)
          const isAvailable = availableToolNames.has(toolName)
          if (!isAvailable) {
            logForDebugging(
              `Filtering out tool_reference for unavailable tool: ${toolName}`,
              { level: 'warn' },
            )
          }
          return isAvailable
        })

        // If all content was filtered out, replace with a placeholder
        if (filteredContent.length === 0) {
          return {
            ...block,
            content: [
              {
                type: 'text' as const,
                text: '[Tool references removed - tools no longer available]',
              },
            ],
          }
        }

        return {
          ...block,
          content: filteredContent,
        }
      }),
    },
  }
}

// ---------------------------------------------------------------------------
// stripCallerFieldFromAssistantMessage
// ---------------------------------------------------------------------------

/**
 * Strips the 'caller' field from tool_use blocks in an assistant message.
 * The 'caller' field is only valid when the tool search beta is enabled.
 * When tool search is disabled, we need to remove this field to avoid API errors.
 *
 * NOTE: This function only strips the 'caller' field - it does NOT normalize
 * tool inputs (that's done by normalizeToolInputForAPI in normalizeMessagesForAPI).
 * This is intentional: this helper is used for model-specific post-processing
 * AFTER normalizeMessagesForAPI has already run, so inputs are already normalized.
 */
export function stripCallerFieldFromAssistantMessage(
  message: AssistantMessage,
): AssistantMessage {
  const hasCallerField = message.message.content.some(
    block =>
      block.type === 'tool_use' && 'caller' in block && block.caller !== null,
  )

  if (!hasCallerField) {
    return message
  }

  return {
    ...message,
    message: {
      ...message.message,
      content: message.message.content.map(block => {
        if (block.type !== 'tool_use') {
          return block
        }
        // Explicitly construct with only standard API fields
        return {
          type: 'tool_use' as const,
          id: block.id,
          name: block.name,
          input: block.input,
        }
      }),
    },
  }
}

// ---------------------------------------------------------------------------
// System reminder wrapping
// ---------------------------------------------------------------------------

export function wrapInSystemReminder(content: string): string {
  return `<system-reminder>\n${content}\n</system-reminder>`
}

export function wrapMessagesInSystemReminder(
  messages: UserMessage[],
): UserMessage[] {
  return messages.map(msg => {
    if (typeof msg.message.content === 'string') {
      return {
        ...msg,
        message: {
          ...msg.message,
          content: wrapInSystemReminder(msg.message.content),
        },
      }
    } else if (Array.isArray(msg.message.content)) {
      // For array content, wrap text blocks in system-reminder
      const wrappedContent = msg.message.content.map(block => {
        if (block.type === 'text') {
          return {
            ...block,
            text: wrapInSystemReminder(block.text),
          }
        }
        return block
      })
      return {
        ...msg,
        message: {
          ...msg.message,
          content: wrappedContent,
        },
      }
    }
    return msg
  })
}

// ---------------------------------------------------------------------------
// ensureSystemReminderWrap
// ---------------------------------------------------------------------------

/**
 * Ensure all text content in attachment-origin messages carries the
 * <system-reminder> wrapper. This makes the prefix a reliable discriminator
 * for the post-pass smoosh (smooshSystemReminderSiblings) — no need for every
 * normalizeAttachmentForAPI case to remember to wrap.
 *
 * Idempotent: already-wrapped text is unchanged.
 */
export function ensureSystemReminderWrap(msg: UserMessage): UserMessage {
  const content = msg.message.content
  if (typeof content === 'string') {
    if (content.startsWith('<system-reminder>')) return msg
    return {
      ...msg,
      message: { ...msg.message, content: wrapInSystemReminder(content) },
    }
  }
  let changed = false
  const newContent = content.map(b => {
    if (b.type === 'text' && !b.text.startsWith('<system-reminder>')) {
      changed = true
      return { ...b, text: wrapInSystemReminder(b.text) }
    }
    return b
  })
  return changed
    ? { ...msg, message: { ...msg.message, content: newContent } }
    : msg
}

// ---------------------------------------------------------------------------
// smooshSystemReminderSiblings
// ---------------------------------------------------------------------------

/**
 * Final pass: smoosh any `<system-reminder>`-prefixed text siblings into the
 * last tool_result of the same user message. Catches siblings from:
 * - PreToolUse hook additionalContext (Gap F: attachment between assistant and
 *   tool_result → standalone push → mergeUserMessages → hoist → sibling)
 * - relocateToolReferenceSiblings output (Gap E)
 * - any attachment-origin text that escaped merge-time smoosh
 *
 * Non-system-reminder text (real user input, TOOL_REFERENCE_TURN_BOUNDARY,
 * context-collapse `<collapsed>` summaries) stays untouched — a Human: boundary
 * before actual user input is semantically correct.
 *
 * Idempotent. Pure function of shape.
 */
export function smooshSystemReminderSiblings(
  messages: (UserMessage | AssistantMessage)[],
): (UserMessage | AssistantMessage)[] {
  return messages.map(msg => {
    if (msg.type !== 'user') return msg
    const content = msg.message.content
    if (!Array.isArray(content)) return msg

    const hasToolResult = content.some(b => b.type === 'tool_result')
    if (!hasToolResult) return msg

    const srText: TextBlockParam[] = []
    const kept: ContentBlockParam[] = []
    for (const b of content) {
      if (b.type === 'text' && b.text.startsWith('<system-reminder>')) {
        srText.push(b)
      } else {
        kept.push(b)
      }
    }
    if (srText.length === 0) return msg

    // Smoosh into the LAST tool_result (positionally adjacent in rendered prompt)
    const lastTrIdx = kept.findLastIndex(b => b.type === 'tool_result')
    const lastTr = kept[lastTrIdx] as ToolResultBlockParam
    const smooshed = smooshIntoToolResult(lastTr, srText)
    if (smooshed === null) return msg // tool_ref constraint — leave alone

    const newContent = [
      ...kept.slice(0, lastTrIdx),
      smooshed,
      ...kept.slice(lastTrIdx + 1),
    ]
    return {
      ...msg,
      message: { ...msg.message, content: newContent },
    }
  })
}

// ---------------------------------------------------------------------------
// sanitizeErrorToolResultContent
// ---------------------------------------------------------------------------

/**
 * Strip non-text blocks from is_error tool_results — the API rejects the
 * combination with "all content must be type text if is_error is true".
 *
 * Read-side guard for transcripts persisted before smooshIntoToolResult
 * learned to filter on is_error. Without this a resumed session with one
 * of these 400s on every call and can't be recovered by /fork. Adjacent
 * text left behind by a stripped image is re-merged.
 */
export function sanitizeErrorToolResultContent(
  messages: (UserMessage | AssistantMessage)[],
): (UserMessage | AssistantMessage)[] {
  return messages.map(msg => {
    if (msg.type !== 'user') return msg
    const content = msg.message.content
    if (!Array.isArray(content)) return msg

    let changed = false
    const newContent = content.map(b => {
      if (b.type !== 'tool_result' || !b.is_error) return b
      const trContent = b.content
      if (!Array.isArray(trContent)) return b
      if (trContent.every(c => c.type === 'text')) return b
      changed = true
      // PERF-002: Merge filter+map into single pass. Collect text blocks in one iteration.
      const texts: string[] = []
      for (const c of trContent) {
        if (c.type === 'text') {
          texts.push(c.text)
        }
      }
      const textOnly: TextBlockParam[] =
        texts.length > 0 ? [{ type: 'text', text: texts.join('\n\n') }] : []
      return { ...b, content: textOnly }
    })
    if (!changed) return msg
    return { ...msg, message: { ...msg.message, content: newContent } }
  })
}

// ---------------------------------------------------------------------------
// relocateToolReferenceSiblings
// ---------------------------------------------------------------------------

/**
 * Move text-block siblings off user messages that contain tool_reference.
 *
 * When a tool_result contains tool_reference, the server expands it to a
 * functions block. Any text siblings appended to that same user message
 * (auto-memory, skill reminders, etc.) create a second human-turn segment
 * right after the functions-close tag — an anomalous pattern the model
 * imprints on. At a later tool-results tail, the model completes the
 * pattern and emits the stop sequence. See #21049 for mechanism and
 * five-arm dose-response.
 *
 * The fix: find the next user message with tool_result content but NO
 * tool_reference, and move the text siblings there. Pure transformation —
 * no state, no side effects. The target message's existing siblings (if any)
 * are preserved; moved blocks append.
 *
 * If no valid target exists (tool_reference message is at/near the tail),
 * siblings stay in place. That's safe: a tail ending in a human turn (with
 * siblings) gets an Assistant: cue before generation; only a tail ending
 * in bare tool output (no siblings) lacks the cue.
 *
 * Idempotent: after moving, the source has no text siblings; second pass
 * finds nothing to move.
 */
export function relocateToolReferenceSiblings(
  messages: (UserMessage | AssistantMessage)[],
): (UserMessage | AssistantMessage)[] {
  const result = [...messages]

  for (let i = 0; i < result.length; i++) {
    const msg = result[i]!
    if (msg.type !== 'user') continue
    const content = msg.message.content
    if (!Array.isArray(content)) continue
    if (!contentHasToolReference(content)) continue

    const textSiblings = content.filter(b => b.type === 'text')
    if (textSiblings.length === 0) continue

    // Find the next user message with tool_result but no tool_reference.
    // Skip tool_reference-containing targets — moving there would just
    // recreate the problem one position later.
    let targetIdx = -1
    for (let j = i + 1; j < result.length; j++) {
      const cand = result[j]!
      if (cand.type !== 'user') continue
      const cc = cand.message.content
      if (!Array.isArray(cc)) continue
      if (!cc.some(b => b.type === 'tool_result')) continue
      if (contentHasToolReference(cc)) continue
      targetIdx = j
      break
    }

    if (targetIdx === -1) continue // No valid target; leave in place.

    // Strip text from source, append to target.
    result[i] = {
      ...msg,
      message: {
        ...msg.message,
        content: content.filter(b => b.type !== 'text'),
      },
    }
    const target = result[targetIdx] as UserMessage
    result[targetIdx] = {
      ...target,
      message: {
        ...target.message,
        content: [
          ...(target.message.content as ContentBlockParam[]),
          ...textSiblings,
        ],
      },
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// normalizeContentFromAPI
// ---------------------------------------------------------------------------

// Sometimes the API returns empty messages (eg. "\n\n"). We need to filter these out,
// otherwise they will give an API error when we send them to the API next time we call query().
export function normalizeContentFromAPI(
  contentBlocks: BetaMessage['content'],
  tools: Tools,
  agentId?: AgentId,
): BetaMessage['content'] {
  if (!contentBlocks) {
    return []
  }
  return contentBlocks.map(contentBlock => {
    switch (contentBlock.type) {
      case 'tool_use': {
        if (
          typeof contentBlock.input !== 'string' &&
          !isObject(contentBlock.input)
        ) {
          // we stream tool use inputs as strings, but when we fall back, they're objects
          throw new Error('Tool use input must be a string or object')
        }

        // With fine-grained streaming on, we are getting a stringied JSON back from the API.
        // The API has strange behaviour, where it returns nested stringified JSONs, and so
        // we need to recursively parse these. If the top-level value returned from the API is
        // an empty string, this should become an empty object (nested values should be empty string).
        // TODO: This needs patching as recursive fields can still be stringified
        let normalizedInput: unknown
        if (typeof contentBlock.input === 'string') {
          const parsed = safeParseJSON(contentBlock.input)
          if (parsed === null && contentBlock.input.length > 0) {
            // TET/FC-v3 diagnostic: the streamed tool input JSON failed to
            // parse. We fall back to {} which means downstream validation
            // sees empty input. The raw prefix goes to debug log only — no
            // PII-tagged proto column exists for it yet.
            logEvent('tengu_tool_input_json_parse_fail', {
              toolName: sanitizeToolNameForAnalytics(contentBlock.name),
              inputLen: contentBlock.input.length,
            })
            if (process.env.INTERNAL_BUILD === '1') {
              logForDebugging(
                `tool input JSON parse fail: ${contentBlock.input.slice(0, 200)}`,
                { level: 'warn' },
              )
            }
          }
          normalizedInput = parsed ?? {}
        } else {
          normalizedInput = contentBlock.input
        }

        // Then apply tool-specific corrections
        if (typeof normalizedInput === 'object' && normalizedInput !== null) {
          const tool = findToolByName(tools, contentBlock.name)
          if (tool) {
            try {
              normalizedInput = normalizeToolInput(
                tool,
                normalizedInput as { [key: string]: unknown },
                agentId,
              )
            } catch (error) {
              logError(new Error('Error normalizing tool input: ' + error))
              // Keep the original input if normalization fails
            }
          }
        }

        return {
          ...contentBlock,
          input: normalizedInput,
        }
      }
      case 'text':
        if (contentBlock.text.trim().length === 0) {
          logEvent('tengu_model_whitespace_response', {
            length: contentBlock.text.length,
          })
        }
        // Return the block as-is to preserve exact content for prompt caching.
        // Empty text blocks are handled at the display layer and must not be
        // altered here.
        return contentBlock
      case 'code_execution_tool_result':
      case 'mcp_tool_use':
      case 'mcp_tool_result':
      case 'container_upload':
        // Beta-specific content blocks - pass through as-is
        return contentBlock
      case 'server_tool_use':
        if (typeof contentBlock.input === 'string') {
          return {
            ...contentBlock,
            input: (safeParseJSON(contentBlock.input) ?? {}) as {
              [key: string]: unknown
            },
          }
        }
        return contentBlock
      default:
        return contentBlock
    }
  })
}

// ---------------------------------------------------------------------------
// Text content helpers
// ---------------------------------------------------------------------------

export function isEmptyMessageText(text: string): boolean {
  return (
    stripPromptXMLTags(text).trim() === '' || text.trim() === NO_CONTENT_MESSAGE
  )
}

const STRIPPED_TAGS_RE =
  /<(commit_analysis|context|function_analysis|pr_analysis)>.*?<\/\1>\n?/gs

export function stripPromptXMLTags(content: string): string {
  return content.replace(STRIPPED_TAGS_RE, '').trim()
}
