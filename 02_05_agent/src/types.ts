export type TextMessage = {
  role: 'user' | 'assistant' | 'system' | 'developer'
  content: string | null
}

export type FunctionCallItem = {
  type: 'function_call'
  call_id: string
  name: string
  arguments: string
}

export type FunctionCallOutputItem = {
  type: 'function_call_output'
  call_id: string
  output: string
}

export type Message = TextMessage | FunctionCallItem | FunctionCallOutputItem

export const isTextMessage = (m: Message): m is TextMessage => 'role' in m && !('type' in m)
export const isFunctionCall = (m: Message): m is FunctionCallItem => 'type' in m && m.type === 'function_call'
export const isFunctionCallOutput = (m: Message): m is FunctionCallOutputItem => 'type' in m && m.type === 'function_call_output'

export interface AgentTemplate {
  name: string
  model: string
  tools: string[]
  systemPrompt: string
}

export interface MemoryState {
  activeObservations: string
  lastObservedIndex: number
  observationTokenCount: number
  generationCount: number
  _observerRanThisRequest?: boolean
  _lastReflectionOutputTokens?: number
}

export interface Session {
  id: string
  messages: Message[]
  memory: MemoryState
}

export interface ToolDefinition {
  type: 'function'
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface Tool {
  definition: ToolDefinition
  handler: (args: Record<string, unknown>) => Promise<string>
}
