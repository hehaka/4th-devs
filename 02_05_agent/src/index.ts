import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { randomUUID } from 'node:crypto'
import { runAgent } from './agent.js'
import { flushMemory } from './memory/processor.js'
import type { Session } from './types.js'

const app = new Hono()
app.use(cors())

const sessions = new Map<string, Session>()

const truncate = (s: string, max = 60): string =>
  s.length > max ? s.slice(0, max) + '…' : s

const freshMemory = () => ({
  activeObservations: '',
  lastObservedIndex: 0,
  observationTokenCount: 0,
  generationCount: 0,
})

app.post('/api/chat', async (c) => {
  const body = await c.req.json()
  const sessionId = typeof body.session_id === 'string' ? body.session_id : randomUUID()
  const message = typeof body.message === 'string' ? body.message : null

  if (!message) {
    return c.json({ error: 'message is required' }, 400)
  }

  let session = sessions.get(sessionId)
  if (!session) {
    session = { id: sessionId, messages: [], memory: freshMemory() }
    sessions.set(sessionId, session)
  }

  console.log(`\n[session:${sessionId.slice(0, 8)}] "${truncate(message)}"`)

  try {
    const result = await runAgent(session, message)

    return c.json({
      session_id: sessionId,
      response: result.response,
      memory: {
        hasObservations: session.memory.activeObservations.length > 0,
        observationTokens: session.memory.observationTokenCount,
        generation: session.memory.generationCount,
        totalMessages: session.messages.length,
        sealedMessages: session.memory.lastObservedIndex,
        activeMessages: session.messages.length - session.memory.lastObservedIndex,
      },
      usage: result.usage,
    })
  } catch (err) {
    console.error('[error]', err instanceof Error ? err.message : err)
    return c.json({ error: 'Agent execution failed' }, 500)
  }
})

app.get('/api/sessions', (c) => {
  const list = [...sessions.entries()].map(([id, s]) => ({
    id,
    messageCount: s.messages.length,
    observationTokens: s.memory.observationTokenCount,
    generation: s.memory.generationCount,
  }))
  return c.json(list)
})

app.get('/api/sessions/:id/memory', (c) => {
  const session = sessions.get(c.req.param('id'))
  if (!session) return c.json({ error: 'Session not found' }, 404)

  return c.json({
    session_id: session.id,
    messageCount: session.messages.length,
    memory: session.memory,
  })
})

app.post('/api/sessions/:id/flush', async (c) => {
  const session = sessions.get(c.req.param('id'))
  if (!session) return c.json({ error: 'Session not found' }, 404)

  console.log(`\n[session:${c.req.param('id').slice(0, 8)}] Flushing remaining messages to observations`)

  try {
    await flushMemory(session)
    return c.json({
      session_id: session.id,
      memory: {
        observationTokens: session.memory.observationTokenCount,
        generation: session.memory.generationCount,
        totalMessages: session.messages.length,
        sealedMessages: session.memory.lastObservedIndex,
        activeMessages: session.messages.length - session.memory.lastObservedIndex,
      },
    })
  } catch (err) {
    console.error('[error]', err instanceof Error ? err.message : err)
    return c.json({ error: 'Flush failed' }, 500)
  }
})

const port = parseInt(process.env.PORT ?? '3001', 10)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`\n========================================`)
  console.log(`  02_05 Agent — Context Engineering Demo`)
  console.log(`  http://localhost:${info.port}`)
  console.log(`========================================\n`)
})
