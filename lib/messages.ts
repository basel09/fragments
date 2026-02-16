import { FragmentSchema } from './schema'
import { ExecutionResult } from './types'
import { DeepPartial } from 'ai'

export type MessageText = {
  type: 'text'
  text: string
}

export type MessageCode = {
  type: 'code'
  text: string
}

export type MessageImage = {
  type: 'image'
  image: string
}

export type MessageCodeSelection = {
  type: 'codeSelection'
  code: string
  fileName: string
  language: string
  lineRange: { start: number; end: number }
  tokenEstimate: number
}

export type CodeSelectionData = {
  code: string
  fileName: string
  language: string
  lineRange: { start: number; end: number }
  tokenEstimate: number
}

export type Message = {
  role: 'assistant' | 'user'
  content: Array<MessageText | MessageCode | MessageImage | MessageCodeSelection>
  object?: DeepPartial<FragmentSchema>
  result?: ExecutionResult
}

export function toAISDKMessages(messages: Message[]) {
  const totalMessages = messages.length

  return messages.map((message, messageIndex) => {
    // Strategy 3: Sort content so text comes first, codeSelection last (cache optimization)
    const sortedContent = message.content.slice().sort((a, b) => {
      if (a.type === 'codeSelection') return 1
      if (b.type === 'codeSelection') return -1
      return 0
    })

    return {
      role: message.role,
      content: sortedContent.map((content) => {
        if (content.type === 'code') {
          return {
            type: 'text' as const,
            text: content.text,
          }
        }

        if (content.type === 'codeSelection') {
          const turnsFromEnd = totalMessages - messageIndex

          // Strategy 2: Selection expiry — collapse old selections after 3 turns (6 messages)
          if (turnsFromEnd > 6) {
            return {
              type: 'text' as const,
              text: `[Previously selected ${content.language} code from ${content.fileName}, lines ${content.lineRange.start}-${content.lineRange.end}]`,
            }
          }

          // Recent selections: include full code with structured metadata
          return {
            type: 'text' as const,
            text: `[Selected code from ${content.fileName}, lines ${content.lineRange.start}-${content.lineRange.end}, ${content.language}]:\n\`\`\`${content.language}\n${content.code}\n\`\`\``,
          }
        }

        return content
      }),
    }
  })
}

export async function toMessageImage(files: File[]) {
  if (files.length === 0) {
    return []
  }

  return Promise.all(
    files.map(async (file) => {
      const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
      return `data:${file.type};base64,${base64}`
    }),
  )
}
