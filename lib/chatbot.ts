import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from './chatbot-knowledge'

// Website chatbot: one Claude call per visitor message, answering only from the
// approved knowledge in chatbot-knowledge.ts. The system prompt is sent as a
// cached prefix so repeated turns mostly pay cache-read rates.

export const CHAT_MODEL = 'claude-opus-5-5'
export const MAX_USER_CHARS = 1000
// Per conversation (user + assistant rows). Keeps runaway sessions bounded.
export const MAX_SESSION_MESSAGES = 40
// How much history is replayed to the model each turn.
export const MAX_HISTORY_MESSAGES = 20

export const UNAVAILABLE_REPLY =
  "I'm sorry — I'm not able to answer right now. Please call (201) 225-1101 or use the Request Consultation button and the team will help you."

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  if (!client) client = new Anthropic()
  return client
}

export function isConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

export interface ReplyResult {
  text: string
  model: string
  stopReason: string | null
  inputTokens: number
  cacheReadTokens: number
  outputTokens: number
  latencyMs: number
}

export async function generateReply(
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<ReplyResult> {
  const t0 = Date.now()
  const response = await getClient().beta.messages.create({
    model: CHAT_MODEL,
    max_tokens: 1024,
    // Chat at low effort: fast, cheap, and the task is retrieval from a fixed
    // document, not reasoning. Thinking stays adaptive (it can't be disabled).
    output_config: { effort: 'low' },
    // Opt into server-side fallback so a safety-classifier decline on the main
    // model is retried on a fallback model inside the same request.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: history,
  })

  const latencyMs = Date.now() - t0
  const usage = response.usage
  const base = {
    model: response.model,
    stopReason: response.stop_reason,
    inputTokens: usage.input_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    outputTokens: usage.output_tokens,
    latencyMs,
  }

  // Check stop_reason before reading content: a refusal has no usable text.
  if (response.stop_reason === 'refusal') {
    return { ...base, text: UNAVAILABLE_REPLY }
  }

  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  return { ...base, text: text || UNAVAILABLE_REPLY }
}
