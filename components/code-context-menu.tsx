'use client'

import { Copy, Paperclip } from 'lucide-react'
import { useEffect, useRef } from 'react'

export function CodeContextMenu({
  x,
  y,
  selectedText,
  hasSelection,
  isChatLoading,
  onCopy,
  onUseAsContext,
  onClose,
}: {
  x: number
  y: number
  selectedText: string
  hasSelection: boolean
  isChatLoading: boolean
  onCopy: () => void
  onUseAsContext: () => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  function handleCopy() {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText)
    }
    onCopy()
    onClose()
  }

  function handleUseAsContext() {
    onUseAsContext()
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] rounded-lg border bg-popover p-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      <button
        onClick={handleCopy}
        disabled={!hasSelection}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Copy className="h-4 w-4" />
        <span>Copy</span>
        <span className="ml-auto text-xs text-muted-foreground">Ctrl+C</span>
      </button>
      <div className="my-1 h-px bg-border" />
      <button
        onClick={handleUseAsContext}
        disabled={!hasSelection || isChatLoading}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-orange-500"
      >
        <Paperclip className="h-4 w-4" />
        <span>Use as Context</span>
      </button>
    </div>
  )
}
