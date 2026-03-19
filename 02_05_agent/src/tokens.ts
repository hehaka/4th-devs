import type { Message } from './types.js'
import { isTextMessage, isFunctionCall, isFunctionCallOutput } from './types.js'

const CHARS_PER_TOKEN = 4
const SAFETY_MARGIN = 1.2
const RESERVE_FOR_RESPONSE = 16_384

let cumulativeEstimated = 0
let cumulativeActual = 0

/**
 * Raw chars/4 estimate — stable, no calibration applied.
 * Used for threshold checks where predictability matters.
 */
export const estimateTokensRaw = (text: string): number => {
  if (!text) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Calibrated estimate — adjusts based on actual API-reported usage.
 * Used for display/budget calculations.
 */
export const estimateTokens = (text: string): number => {
  const base = estimateTokensRaw(text)
  if (!base) return 0

  if (cumulativeActual > 500 && cumulativeEstimated > 0) {
    const ratio = cumulativeActual / cumulativeEstimated
    return Math.ceil(base * ratio)
  }

  return base
}

export const withSafetyMargin = (tokens: number): number =>
  Math.ceil(tokens * SAFETY_MARGIN)

export const estimateMessageTokens = (message: Message): number => {
  let tokens = 4

  if (isTextMessage(message)) {
    if (typeof message.content === 'string') {
      tokens += estimateTokens(message.content)
    }
    return tokens
  }

  if (isFunctionCall(message)) {
    tokens += estimateTokens(message.name)
    tokens += estimateTokens(message.arguments)
    tokens += 10
    return tokens
  }

  if (isFunctionCallOutput(message)) {
    tokens += estimateTokens(message.output)
    return tokens
  }

  return tokens
}

export const estimateMessagesTokens = (messages: Message[]): { raw: number; safe: number } => {
  const raw = messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)
  return { raw, safe: withSafetyMargin(raw) }
}

/**
 * Raw (uncalibrated) message token estimate for stable threshold comparisons.
 */
export const estimateMessagesTokensRaw = (messages: Message[]): number => {
  let total = 0
  for (const msg of messages) {
    total += 4
    if (isTextMessage(msg)) {
      if (typeof msg.content === 'string') total += estimateTokensRaw(msg.content)
    } else if (isFunctionCall(msg)) {
      total += estimateTokensRaw(msg.name) + estimateTokensRaw(msg.arguments) + 10
    } else if (isFunctionCallOutput(msg)) {
      total += estimateTokensRaw(msg.output)
    }
  }
  return total
}

export const recordActualUsage = (estimated: number, actual: number): void => {
  cumulativeEstimated += estimated
  cumulativeActual += actual
}

export const getCalibration = (): { ratio: number | null; samples: number } => {
  if (cumulativeActual < 100 || cumulativeEstimated === 0) {
    return { ratio: null, samples: cumulativeActual }
  }
  return { ratio: cumulativeActual / cumulativeEstimated, samples: cumulativeActual }
}

export const calculateBudget = (estimatedTokens: number, contextWindow: number) => {
  const available = contextWindow - RESERVE_FOR_RESPONSE
  return {
    estimatedTokens,
    contextWindow,
    available,
    utilization: estimatedTokens / contextWindow,
    isOverWarning: estimatedTokens > available * 0.75,
    isOverLimit: estimatedTokens > available * 0.9,
  }
}
