import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, resolve, relative, dirname } from 'node:path'
import type { Tool } from './types.js'

const WORKSPACE = join(process.cwd(), 'workspace')

const isPathSafe = (path: string): boolean => {
  const fullPath = resolve(join(WORKSPACE, path))
  const rel = relative(resolve(WORKSPACE), fullPath)
  return !rel.startsWith('..')
}

export const tools: Tool[] = [
  {
    definition: {
      type: 'function',
      name: 'read_file',
      description: 'Read a file from the workspace directory. Path is relative to workspace root.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to workspace' },
        },
        required: ['path'],
      },
    },
    handler: async (args) => {
      const path = typeof args.path === 'string' ? args.path : ''
      if (!path || !isPathSafe(path)) return 'Error: invalid or unsafe path'
      try {
        return await readFile(join(WORKSPACE, path), 'utf-8')
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  },
  {
    definition: {
      type: 'function',
      name: 'write_file',
      description: 'Write content to a file in the workspace directory. Creates directories if needed.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to workspace' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
    handler: async (args) => {
      const path = typeof args.path === 'string' ? args.path : ''
      const content = typeof args.content === 'string' ? args.content : ''
      if (!path || !isPathSafe(path)) return 'Error: invalid or unsafe path'
      try {
        const fullPath = join(WORKSPACE, path)
        await mkdir(dirname(fullPath), { recursive: true })
        await writeFile(fullPath, content, 'utf-8')
        return `Wrote ${path}`
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  },
]

export const findTool = (name: string): Tool | undefined =>
  tools.find((t) => t.definition.name === name)
