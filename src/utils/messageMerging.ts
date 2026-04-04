import { feature } from 'bun:bundle'
import type {
  ContentBlockParam,
  TextBlockParam,
  ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/index.mjs'
import last from 'lodash-es/last.js'
import { checkStatsigFeatureGate_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook.js'
import type {
  AssistantMessage,
  Message,
  UserMessage,
} from '../types/message.js'
import { isToolReferenceBlock } from './toolSearch.js'

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * In the content[] list on a UserMessage, tool_result blocks must come first
 * to avoid "tool result must follow tool use" API errors.
 */
function hoistToolResults(content: ContentBlockParam[]): ContentBlockParam[] {
  const toolResults: ContentBlockParam[] = []
  const otherBlocks: ContentBlockParam[] = []

  for (const block of content) {
    if (block.type === 'tool_result') {
      toolResults.push(block)
    } else {
      otherBlocks.push(block)
    }
  }

  return [...toolResults, ...otherBlocks]
}

function normalizeUserTextContent(
  a: string | ContentBlockParam[],
): ContentBlockParam[] {
  if (typeof a === 'string') {
    return [{ type: 'text', text: a }]
  }
  return a
}

/**
 * Concatenate two content block arrays, appending `\n` to a's last text block
 * when the seam is text-text. The API concatenates adjacent text blocks in a
 * user message without a separator, so two queued prompts `"2 + 2"` +
 * `"3 + 3"` would otherwise reach the model as `"2 + 23 + 3"`.
 *
 * Blocks stay separate; the `\n` goes on a's side so no block's startsWith
 * changes — smooshSystemReminderSiblings classifies via
 * `startsWith('<system-reminder>')`, and prepending to b would break that
 * when b is an SR-wrapped attachment.
 */
function joinTextAtSeam(
  a: ContentBlockParam[],
  b: ContentBlockParam[],
): ContentBlockParam[] {
  const lastA = a.at(-1)
  const firstB = b[0]
  if (lastA?.type === 'text' && firstB?.type === 'text') {
    return [...a.slice(0, -1), { ...lastA, text: lastA.text + '\n' }, ...b]
  }
  return [...a, ...b]
}

type ToolResultContentItem = Extract<
  ToolResultBlockParam['content'],
  readonly unknown[]
>[number]

// ---------------------------------------------------------------------------
// Exported functions (used outside this module)
// ---------------------------------------------------------------------------

export function isToolResultMessage(msg: Message): boolean {
  if (msg.type !== 'user') {
    return false
  }
  const content = msg.message.content
  if (typeof content === 'string') return false
  return content.some(block => block.type === 'tool_result')
}

export function mergeUserMessagesAndToolResults(
  a: UserMessage,
  b: UserMessage,
): UserMessage {
  const lastContent = normalizeUserTextContent(a.message.content)
  const currentContent = normalizeUserTextContent(b.message.content)
  return {
    ...a,
    message: {
      ...a.message,
      content: hoistToolResults(
        mergeUserContentBlocks(lastContent, currentContent),
      ),
    },
  }
}

export function mergeAssistantMessages(
  a: AssistantMessage,
  b: AssistantMessage,
): AssistantMessage {
  return {
    ...a,
    message: {
      ...a.message,
      content: [...a.message.content, ...b.message.content],
    },
  }
}

export function mergeUserMessages(a: UserMessage, b: UserMessage): UserMessage {
  const lastContent = normalizeUserTextContent(a.message.content)
  const currentContent = normalizeUserTextContent(b.message.content)
  if (feature('HISTORY_SNIP')) {
    // A merged message is only meta if ALL merged messages are meta. If any
    // operand is real user content, the result must not be flagged isMeta
    // (so [id:] tags get injected and it's treated as user-visible content).
    // Gated behind the full runtime check because changing isMeta semantics
    // affects downstream callers (e.g., VCR fixture hashing in SDK harness
    // tests), so this must only fire when snip is actually enabled — not
    // for all ants.
    const { isSnipRuntimeEnabled } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../services/compact/snipCompact.js') as typeof import('../services/compact/snipCompact.js')
    if (isSnipRuntimeEnabled()) {
      return {
        ...a,
        isMeta: a.isMeta && b.isMeta ? (true as const) : undefined,
        uuid: a.isMeta ? b.uuid : a.uuid,
        message: {
          ...a.message,
          content: hoistToolResults(
            joinTextAtSeam(lastContent, currentContent),
          ),
        },
      }
    }
  }
  return {
    ...a,
    // Preserve the non-meta message's uuid so [id:] tags (derived from uuid)
    // stay stable across API calls (meta messages like system context get fresh uuids each call)
    uuid: a.isMeta ? b.uuid : a.uuid,
    message: {
      ...a.message,
      content: hoistToolResults(joinTextAtSeam(lastContent, currentContent)),
    },
  }
}

export function mergeAdjacentUserMessages(
  msgs: (UserMessage | AssistantMessage)[],
): (UserMessage | AssistantMessage)[] {
  const out: (UserMessage | AssistantMessage)[] = []
  for (const m of msgs) {
    const prev = out.at(-1)
    if (m.type === 'user' && prev?.type === 'user') {
      out[out.length - 1] = mergeUserMessages(prev, m) // lvalue — can't use .at()
    } else {
      out.push(m)
    }
  }
  return out
}

/**
 * Fold content blocks into a tool_result's content. Returns the updated
 * tool_result, or `null` if smoosh is impossible (tool_reference constraint).
 *
 * Valid block types inside tool_result.content per SDK: text, image,
 * search_result, document. All of these smoosh. tool_reference (beta) cannot
 * mix with other types — server ValueError — so we bail with null.
 *
 * - string/undefined content + all-text blocks → string (preserve legacy shape)
 * - array content with tool_reference → null
 * - otherwise → array, with adjacent text merged (notebook.ts idiom)
 */
export function smooshIntoToolResult(
  tr: ToolResultBlockParam,
  blocks: ContentBlockParam[],
): ToolResultBlockParam | null {
  if (blocks.length === 0) return tr

  const existing = tr.content
  if (Array.isArray(existing) && existing.some(isToolReferenceBlock)) {
    return null
  }

  // API constraint: is_error tool_results must contain only text blocks.
  // Queued-command siblings can carry images (pasted screenshot) — smooshing
  // those into an error result produces a transcript that 400s on every
  // subsequent call and can't be recovered by /fork. The image isn't lost:
  // it arrives as a proper user turn anyway.
  if (tr.is_error) {
    blocks = blocks.filter(b => b.type === 'text')
    if (blocks.length === 0) return tr
  }

  const allText = blocks.every(b => b.type === 'text')

  // Preserve string shape when existing was string/undefined and all incoming
  // blocks are text — this is the common case (hook reminders into Bash/Read
  // results) and matches the legacy smoosh output shape.
  if (allText && (existing === undefined || typeof existing === 'string')) {
    const joined = [
      (existing ?? '').trim(),
      ...blocks.map(b => (b as TextBlockParam).text.trim()),
    ]
      .filter(Boolean)
      .join('\n\n')
    return { ...tr, content: joined }
  }

  // General case: normalize to array, concat, merge adjacent text
  const base: ToolResultContentItem[] =
    existing === undefined
      ? []
      : typeof existing === 'string'
        ? existing.trim()
          ? [{ type: 'text', text: existing.trim() }]
          : []
        : [...existing]

  const merged: ToolResultContentItem[] = []
  for (const b of [...base, ...blocks]) {
    if (b.type === 'text') {
      const t = b.text.trim()
      if (!t) continue
      const prev = merged.at(-1)
      if (prev?.type === 'text') {
        merged[merged.length - 1] = { ...prev, text: `${prev.text}\n\n${t}` } // lvalue
      } else {
        merged.push({ type: 'text', text: t })
      }
    } else {
      // image / search_result / document — pass through
      merged.push(b as ToolResultContentItem)
    }
  }

  return { ...tr, content: merged }
}

export function mergeUserContentBlocks(
  a: ContentBlockParam[],
  b: ContentBlockParam[],
): ContentBlockParam[] {
  // See https://anthropic.slack.com/archives/C06FE2FP0Q2/p1747586370117479 and
  // https://anthropic.slack.com/archives/C0AHK9P0129/p1773159663856279:
  // any sibling after tool_result renders as </function_results>\n\nHuman:<...>
  // on the wire. Repeated mid-conversation, this teaches capy to emit Human: at
  // a bare tail → 3-token empty end_turn. A/B (sai-20260310-161901) validated:
  // smoosh into tool_result.content → 92% → 0%.
  const lastBlock = last(a)
  if (lastBlock?.type !== 'tool_result') {
    return [...a, ...b]
  }

  if (!checkStatsigFeatureGate_CACHED_MAY_BE_STALE('tengu_chair_sermon')) {
    // Legacy (ungated) smoosh: only string-content tool_result + all-text
    // siblings → joined string. Matches pre-universal-smoosh behavior on main.
    // The precondition guarantees smooshIntoToolResult hits its string path
    // (no tool_reference bail, string output shape preserved).
    if (
      typeof lastBlock.content === 'string' &&
      b.every(x => x.type === 'text')
    ) {
      const copy = a.slice()
      copy[copy.length - 1] = smooshIntoToolResult(lastBlock, b)!
      return copy
    }
    return [...a, ...b]
  }

  // Universal smoosh (gated): fold all non-tool_result block types (text,
  // image, document, search_result) into tool_result.content. tool_result
  // blocks stay as siblings (hoisted later by hoistToolResults).
  const toSmoosh = b.filter(x => x.type !== 'tool_result')
  const toolResults = b.filter(x => x.type === 'tool_result')
  if (toSmoosh.length === 0) {
    return [...a, ...b]
  }

  const smooshed = smooshIntoToolResult(lastBlock, toSmoosh)
  if (smooshed === null) {
    // tool_reference constraint — fall back to siblings
    return [...a, ...b]
  }

  return [...a.slice(0, -1), smooshed, ...toolResults]
}
