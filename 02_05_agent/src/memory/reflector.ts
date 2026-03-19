/**
 * Reflector — compresses and reorganizes observations when they exceed token budget.
 *
 * Based on Mastra's Observational Memory system.
 * https://mastra.ai/blog/observational-memory
 */

import OpenAI from 'openai'
import { estimateTokens } from '../tokens.js'
import { extractTag } from './xml.js'

const REFLECTOR_MAX_OUTPUT_TOKENS = 10_000

const COMPRESSION_LEVELS = [
  '',
  'Condense older observations more aggressively. Preserve detail for recent ones only.',
  'Heavily condense. Remove redundancy, keep only durable facts, active commitments, and blockers.',
] as const

export interface ReflectorResult {
  observations: string
  tokenCount: number
  raw: string
  compressionLevel: number
}

const SYSTEM_PROMPT = `You are the observation reflector — part of the memory consciousness.

You must reorganize and compress observations while preserving continuity.

Rules:
1) Your output is the ENTIRE memory. Anything omitted is forgotten.
2) Preserve source tags ([user], [assistant], [tool:name]) on every observation.
3) [user] observations are highest priority — never drop them unless contradicted by a newer [user] observation.
4) [assistant] elaborations are lowest priority — condense or drop them first.
5) [tool:*] outcomes should be kept as concise action records.
6) Condense older details first. Preserve recent details more strongly.
7) Resolve contradictions by preferring newer observations.
8) Use the same bullet format as input. Do NOT restructure into XML attributes or other schemas.

Output format:
<observations>
* 🔴 [user] ...
* 🟡 [tool:write_file] ...
</observations>`.trim()

const buildPrompt = (observations: string, guidance: string): string =>
  [
    'Compress and reorganize the observation memory below.',
    guidance ? `Additional guidance: ${guidance}` : '',
    '',
    '<observations>',
    observations,
    '</observations>',
  ]
    .filter(Boolean)
    .join('\n')

export const runReflector = async (
  openai: OpenAI,
  model: string,
  observations: string,
  targetTokens: number,
): Promise<ReflectorResult> => {
  let bestObservations = observations
  let bestTokens = estimateTokens(observations)
  let bestRaw = observations
  let bestLevel = -1

  console.log(`  [reflector] Compressing observations (${bestTokens} → target ${targetTokens} tokens)`)

  for (let level = 0; level < COMPRESSION_LEVELS.length; level += 1) {
    const response = await openai.responses.create({
      model,
      instructions: SYSTEM_PROMPT,
      input: buildPrompt(observations, COMPRESSION_LEVELS[level]),
      temperature: 0,
      max_output_tokens: REFLECTOR_MAX_OUTPUT_TOKENS,
      store: false,
    })

    const raw = response.output_text ?? ''
    const compressed = extractTag(raw, 'observations') ?? raw.trim()
    if (!compressed) continue

    const tokens = estimateTokens(compressed)
    if (tokens < bestTokens) {
      bestObservations = compressed
      bestTokens = tokens
      bestRaw = raw
      bestLevel = level
    }

    if (tokens <= targetTokens) {
      console.log(`  [reflector] Compressed to ${tokens} tokens (level ${level})`)
      return { observations: compressed, tokenCount: tokens, raw, compressionLevel: level }
    }
  }

  console.log(`  [reflector] Best: ${bestTokens} tokens (level ${bestLevel})`)
  return { observations: bestObservations, tokenCount: bestTokens, raw: bestRaw, compressionLevel: bestLevel }
}
