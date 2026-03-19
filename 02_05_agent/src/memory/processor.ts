/**
 * Memory processor — orchestrates the observer/reflector cycle.
 *
 * Based on Mastra's Observational Memory system.
 * https://mastra.ai/blog/observational-memory
 *
 * Context window layout:
 * ┌──────────────────────────────────────────────────────┐
 * │  Observations (system prompt)  │  Unobserved tail    │
 * │  Compressed history            │  Raw recent messages │
 * └──────────────────────────────────────────────────────┘
 */

import type OpenAI from 'openai'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import type { Message, Session } from '../types.js'
import { isFunctionCallOutput } from '../types.js'
import { estimateTokens, estimateMessagesTokensRaw, estimateMessageTokens } from '../tokens.js'
import { runObserver } from './observer.js'
import { runReflector } from './reflector.js'
import { resolveModelForProvider } from '../config.js'

const WORKSPACE = join(process.cwd(), 'workspace')
const MEMORY_DIR = join(WORKSPACE, 'memory')

export interface MemoryConfig {
  observationThresholdTokens: number
  reflectionThresholdTokens: number
  reflectionTargetTokens: number
  observerModel: string
  reflectorModel: string
}

// Thresholds are intentionally low so the observer/reflector cycle
// triggers within a short demo conversation. In production you'd
// raise these significantly (e.g. 4000 / 2000 / 1200).
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  observationThresholdTokens: 400,
  reflectionThresholdTokens: 400,
  reflectionTargetTokens: 200,
  observerModel: 'gpt-4.1-mini',
  reflectorModel: 'gpt-4.1-mini',
}

export interface ProcessedContext {
  systemPrompt: string
  messages: Message[]
}

const CONTINUATION_HINT = [
  '<system-reminder>',
  'Conversation history was compressed into memory observations.',
  'Continue naturally. Do not mention memory mechanics.',
  '</system-reminder>',
].join('\n')

// ============================================================================
// File persistence
// ============================================================================

let observerLogCounter = 0
let reflectorLogCounter = 0

const pad = (n: number): string => String(n).padStart(3, '0')

const persistObserverLog = async (
  sessionId: string,
  observations: string,
  tokens: number,
  messagesObserved: number,
  generation: number,
  sealedRange: [number, number],
): Promise<void> => {
  observerLogCounter += 1
  const filename = `observer-${pad(observerLogCounter)}.md`
  const path = join(MEMORY_DIR, filename)
  const content = [
    '---',
    `type: observation`,
    `session: ${sessionId}`,
    `sequence: ${observerLogCounter}`,
    `generation: ${generation}`,
    `tokens: ${tokens}`,
    `messages_observed: ${messagesObserved}`,
    `sealed_range: ${sealedRange[0]}–${sealedRange[1]}`,
    `created: ${new Date().toISOString()}`,
    '---',
    '',
    observations,
    '',
  ].join('\n')

  try {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content, 'utf-8')
    console.log(`  [memory] 💾 ${filename}`)
  } catch { /* best-effort */ }
}

const persistReflectorLog = async (
  sessionId: string,
  observations: string,
  tokens: number,
  generation: number,
  compressionLevel: number,
): Promise<void> => {
  reflectorLogCounter += 1
  const filename = `reflector-${pad(reflectorLogCounter)}.md`
  const path = join(MEMORY_DIR, filename)
  const content = [
    '---',
    `type: reflection`,
    `session: ${sessionId}`,
    `sequence: ${reflectorLogCounter}`,
    `generation: ${generation}`,
    `tokens: ${tokens}`,
    `compression_level: ${compressionLevel}`,
    `created: ${new Date().toISOString()}`,
    '---',
    '',
    observations,
    '',
  ].join('\n')

  try {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content, 'utf-8')
    console.log(`  [memory] 💾 ${filename}`)
  } catch { /* best-effort */ }
}

// ============================================================================
// Context shaping helpers
// ============================================================================

const buildObservationAppendix = (observations: string): string => [
  'The following observations are your memory of past conversations with this user.',
  '',
  '<observations>',
  observations,
  '</observations>',
  '',
  'IMPORTANT: Reference specific details from these observations when relevant.',
  'When observations conflict, prefer the most recent one.',
].join('\n')

/**
 * Split messages into head (to observe) and tail (to keep as raw context).
 * Tail budget is 30% of observation threshold (min 120 tokens).
 * Keeps tool call/result pairs together.
 */
const splitByTailBudget = (
  messages: Message[],
  tailBudget: number,
): { head: Message[]; tail: Message[] } => {
  let tailTokens = 0
  let splitIndex = messages.length

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const tokens = estimateMessageTokens(messages[i])
    if (tailTokens + tokens > tailBudget && splitIndex < messages.length) break
    tailTokens += tokens
    splitIndex = i
  }

  while (splitIndex > 0 && splitIndex < messages.length) {
    if (isFunctionCallOutput(messages[splitIndex])) {
      splitIndex -= 1
    } else {
      break
    }
  }

  return { head: messages.slice(0, splitIndex), tail: messages.slice(splitIndex) }
}

// ============================================================================
// Observer + Reflector execution
// ============================================================================

const runObservation = async (
  openai: OpenAI,
  session: Session,
  config: MemoryConfig,
): Promise<{ contextHint?: { currentTask?: string; suggestedResponse?: string } } | null> => {
  const { messages, memory } = session
  const unobserved = messages.slice(memory.lastObservedIndex)

  const tailBudget = Math.max(120, Math.floor(config.observationThresholdTokens * 0.3))
  const { head } = splitByTailBudget(unobserved, tailBudget)
  const toObserve = head.length > 0 ? head : unobserved

  const observed = await runObserver(openai, resolveModelForProvider(config.observerModel) as string, memory.activeObservations, toObserve)
  if (!observed.observations) return null

  const prevIndex = memory.lastObservedIndex

  memory.activeObservations = memory.activeObservations
    ? `${memory.activeObservations.trim()}\n\n${observed.observations.trim()}`
    : observed.observations.trim()
  memory.lastObservedIndex = head.length > 0
    ? memory.lastObservedIndex + head.length
    : messages.length
  memory.observationTokenCount = estimateTokens(memory.activeObservations)

  const sealed = memory.lastObservedIndex - prevIndex
  console.log(`  [memory] Sealed ${sealed} messages (indices ${prevIndex}–${memory.lastObservedIndex - 1})`)
  console.log(`  [memory] Thread: ${memory.lastObservedIndex} sealed | ${messages.length - memory.lastObservedIndex} active`)

  await persistObserverLog(
    session.id,
    observed.observations,
    estimateTokens(observed.observations),
    toObserve.length,
    memory.generationCount,
    [prevIndex, memory.lastObservedIndex - 1],
  )

  return { contextHint: { currentTask: observed.currentTask, suggestedResponse: observed.suggestedResponse } }
}

const runReflection = async (
  openai: OpenAI,
  session: Session,
  config: MemoryConfig,
): Promise<void> => {
  const { memory } = session

  console.log(`  [memory] Reflecting (${memory.observationTokenCount} > ${config.reflectionThresholdTokens})`)

  const reflected = await runReflector(
    openai,
    resolveModelForProvider(config.reflectorModel) as string,
    memory.activeObservations,
    config.reflectionTargetTokens,
  )

  memory.activeObservations = reflected.observations
  memory.observationTokenCount = reflected.tokenCount
  memory._lastReflectionOutputTokens = reflected.tokenCount
  memory.generationCount += 1

  await persistReflectorLog(
    session.id,
    reflected.observations,
    reflected.tokenCount,
    memory.generationCount,
    reflected.compressionLevel,
  )
}

// ============================================================================
// Main entry point — called before each provider call in the agent loop
// ============================================================================

/**
 * Core memory processor.
 *
 * 1. Below threshold → pass through (observations in system prompt if they exist)
 * 2. Above threshold → observer seals head, keeps tail
 * 3. Observations too large → reflector compresses
 *
 * Observer runs at most once per HTTP request (flag on session.memory).
 */
export const processMemory = async (
  openai: OpenAI,
  session: Session,
  baseSystemPrompt: string,
  config: MemoryConfig = DEFAULT_MEMORY_CONFIG,
): Promise<ProcessedContext> => {
  const { messages, memory } = session
  const unobserved = messages.slice(memory.lastObservedIndex)
  const pendingTokens = estimateMessagesTokensRaw(unobserved)
  const hasObservations = memory.activeObservations.length > 0

  console.log(
    `  [memory] Pending: ${pendingTokens} tokens (${unobserved.length} msgs) | Observations: ${memory.observationTokenCount} tokens (gen ${memory.generationCount})`,
  )

  // --- Below threshold ---
  if (pendingTokens < config.observationThresholdTokens) {
    return {
      systemPrompt: hasObservations
        ? `${baseSystemPrompt}\n\n${buildObservationAppendix(memory.activeObservations)}`
        : baseSystemPrompt,
      messages: hasObservations ? unobserved : messages,
    }
  }

  // --- Observer already ran this request (tool call turns) ---
  if (memory._observerRanThisRequest) {
    console.log(`  [memory] Observer already ran this request, skipping`)
    return {
      systemPrompt: hasObservations
        ? `${baseSystemPrompt}\n\n${buildObservationAppendix(memory.activeObservations)}`
        : baseSystemPrompt,
      messages: hasObservations ? unobserved : messages,
    }
  }

  // --- Observation ---
  console.log(`  [memory] Threshold exceeded (${pendingTokens} >= ${config.observationThresholdTokens}), running observer`)

  try {
    await runObservation(openai, session, config)
    memory._observerRanThisRequest = true
  } catch (err) {
    console.error('  [memory] Observer failed:', err instanceof Error ? err.message : err)
    return { systemPrompt: baseSystemPrompt, messages }
  }

  // --- Reflection (only if observations grew meaningfully since last reflection) ---
  const grewSinceReflection = memory.observationTokenCount - (memory._lastReflectionOutputTokens ?? 0)
  const shouldReflect = memory.observationTokenCount > config.reflectionThresholdTokens
    && grewSinceReflection >= config.reflectionTargetTokens

  if (shouldReflect) {
    try {
      await runReflection(openai, session, config)
    } catch (err) {
      console.error('  [memory] Reflector failed:', err instanceof Error ? err.message : err)
    }
  } else if (memory.observationTokenCount > config.reflectionThresholdTokens) {
    console.log(`  [memory] Skipping reflection (grew ${grewSinceReflection} tokens since last, need ${config.reflectionTargetTokens})`)
  }

  // --- Return reshaped context ---
  const remaining = messages.slice(memory.lastObservedIndex)
  const finalMessages: Message[] = remaining.length > 0
    ? remaining
    : [{ role: 'user' as const, content: CONTINUATION_HINT }]

  console.log(`  [memory] Context: ${finalMessages.length} active msgs + observations (gen ${memory.generationCount}) | ${memory.lastObservedIndex} sealed`)

  return {
    systemPrompt: `${baseSystemPrompt}\n\n${buildObservationAppendix(memory.activeObservations)}`,
    messages: finalMessages,
  }
}

// ============================================================================
// Flush — force-observe remaining messages at end of session/demo
// ============================================================================

export const flushMemory = async (
  session: Session,
  config: MemoryConfig = DEFAULT_MEMORY_CONFIG,
): Promise<void> => {
  const { messages, memory } = session
  const unobserved = messages.slice(memory.lastObservedIndex)
  if (unobserved.length === 0) return

  const { openai } = await import('../config.js')
  console.log(`  [flush] Observing ${unobserved.length} remaining messages`)

  await runObservation(openai, session, config)

  if (memory.observationTokenCount > config.reflectionThresholdTokens) {
    try {
      await runReflection(openai, session, config)
    } catch (err) {
      console.error('  [flush] Reflector failed:', err instanceof Error ? err.message : err)
    }
  }
}
