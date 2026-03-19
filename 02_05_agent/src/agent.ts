import type OpenAI from 'openai'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import matter from 'gray-matter'
import type { AgentTemplate, Message, Session } from './types.js'
import { isFunctionCall } from './types.js'
import { tools, findTool } from './tools.js'
import { processMemory, DEFAULT_MEMORY_CONFIG } from './memory/processor.js'
import { estimateMessagesTokens, recordActualUsage, getCalibration } from './tokens.js'
import { openai, resolveModelForProvider } from './config.js'

const MAX_TURNS = 25
const WORKSPACE = join(process.cwd(), 'workspace')

const truncate = (s: string, max = 100): string =>
  s.length > max ? s.slice(0, max) + '…' : s

const loadAgent = async (name: string): Promise<AgentTemplate> => {
  const raw = await readFile(join(WORKSPACE, 'agents', `${name}.agent.md`), 'utf-8')
  const { data, content } = matter(raw)
  return {
    name: data.name ?? name,
    model: typeof data.model === 'string' ? data.model : 'gpt-4.1-mini',
    tools: Array.isArray(data.tools) ? data.tools : [],
    systemPrompt: content.trim(),
  }
}

export interface AgentResult {
  response: string
  usage: {
    totalEstimatedTokens: number
    totalActualTokens: number
    calibration: ReturnType<typeof getCalibration>
    turns: number
  }
}

export const runAgent = async (session: Session, userMessage: string): Promise<AgentResult> => {
  const template = await loadAgent('alice')

  session.messages.push({ role: 'user', content: userMessage })
  session.memory._observerRanThisRequest = false

  const agentTools = template.tools
    .map((name) => tools.find((t) => t.definition.name === name))
    .filter((t): t is NonNullable<typeof t> => t != null)

  const responsesTools: OpenAI.Responses.Tool[] = agentTools.map((t) => ({
    type: 'function' as const,
    name: t.definition.name,
    description: t.definition.description,
    parameters: t.definition.parameters,
    strict: false,
  }))

  const model = resolveModelForProvider(template.model) as string
  let totalEstimated = 0
  let totalActual = 0

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    const context = await processMemory(openai, session, template.systemPrompt, DEFAULT_MEMORY_CONFIG)

    const estimated = estimateMessagesTokens(context.messages)
    totalEstimated += estimated.safe

    console.log(`  [agent] Turn ${turn + 1}, ${context.messages.length} items (~${estimated.safe} tokens)`)

    const response = await openai.responses.create({
      model,
      instructions: context.systemPrompt,
      input: context.messages as OpenAI.Responses.ResponseInputItem[],
      tools: responsesTools.length > 0 ? responsesTools : undefined,
      store: false,
    })

    const usage = response.usage
    if (usage) {
      const actual = usage.input_tokens + usage.output_tokens
      totalActual += actual
      recordActualUsage(estimated.safe, actual)
      console.log(`  [agent] API usage — estimated: ${estimated.safe}, actual: ${actual}`)
    }

    const functionCalls: Message[] = []

    for (const item of response.output) {
      if (item.type === 'message') {
        const text = item.content
          .filter((c): c is OpenAI.Responses.ResponseOutputText => c.type === 'output_text')
          .map((c) => c.text)
          .join('')
        if (text) {
          session.messages.push({ role: 'assistant', content: text })
        }
      } else if (item.type === 'function_call') {
        const fc: Message = { type: 'function_call', call_id: item.call_id, name: item.name, arguments: item.arguments }
        session.messages.push(fc)
        functionCalls.push(fc)
      }
    }

    if (functionCalls.length === 0) {
      console.log(`  [agent] Done (${turn + 1} turns)`)
      return {
        response: response.output_text ?? '',
        usage: { totalEstimatedTokens: totalEstimated, totalActualTokens: totalActual, calibration: getCalibration(), turns: turn + 1 },
      }
    }

    for (const fc of functionCalls) {
      if (!isFunctionCall(fc)) continue

      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(fc.arguments || '{}')
      } catch {
        args = {}
      }

      console.log(`  [agent] Tool: ${fc.name}(${truncate(JSON.stringify(args))})`)

      const tool = findTool(fc.name)
      const result = tool ? await tool.handler(args) : `Unknown tool: ${fc.name}`

      session.messages.push({ type: 'function_call_output', call_id: fc.call_id, output: result })
    }
  }

  return {
    response: 'Exceeded maximum turns',
    usage: { totalEstimatedTokens: totalEstimated, totalActualTokens: totalActual, calibration: getCalibration(), turns: MAX_TURNS },
  }
}
