import './code-theme.css'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-typescript'
import { useEffect, useCallback } from 'react'

export type CodeSelection = {
  code: string
  lineRange: { start: number; end: number }
}

export function CodeView({
  code,
  lang,
  onSelectionChange,
  onContextMenu,
  isChatLoading,
}: {
  code: string
  lang: string
  onSelectionChange?: (selection: CodeSelection | null) => void
  onContextMenu?: (e: React.MouseEvent, selectedText: string) => void
  isChatLoading?: boolean
}) {
  useEffect(() => {
    Prism.highlightAll()
  }, [code])

  const calculateLineRange = useCallback(
    (selectedText: string): { start: number; end: number } => {
      const position = code.indexOf(selectedText)
      if (position === -1) {
        return { start: 1, end: 1 }
      }

      const textBefore = code.substring(0, position)
      const startLine = (textBefore.match(/\n/g) || []).length + 1
      const selectionLines = (selectedText.match(/\n/g) || []).length
      const endLine = startLine + selectionLines

      return { start: startLine, end: endLine }
    },
    [code],
  )

  function handleMouseUp() {
    if (isChatLoading || !onSelectionChange) return

    const selection = window.getSelection()
    const selectedText = selection?.toString().trim() || ''

    if (selectedText.length === 0) {
      onSelectionChange(null)
      return
    }

    const lineRange = calculateLineRange(selectedText)
    onSelectionChange({ code: selectedText, lineRange })
  }

  function handleContextMenu(e: React.MouseEvent) {
    if (!onContextMenu) return
    e.preventDefault()

    const selection = window.getSelection()
    const selectedText = selection?.toString().trim() || ''
    onContextMenu(e, selectedText)
  }

  return (
    <pre
      className="p-4 pt-2"
      style={{
        fontSize: 12,
        backgroundColor: 'transparent',
        borderRadius: 0,
        margin: 0,
      }}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      <code className={`language-${lang}`}>{code}</code>
    </pre>
  )
}
