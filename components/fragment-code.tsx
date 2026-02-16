import { CodeContextMenu } from './code-context-menu'
import { CodeView } from './code-view'
import type { CodeSelection } from './code-view'
import { Button } from './ui/button'
import { CopyButton } from './ui/copy-button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CodeSelectionData } from '@/lib/messages'
import { Download, FileText, Paperclip } from 'lucide-react'
import { useState } from 'react'

export function FragmentCode({
  files,
  onAttachSelection,
  isChatLoading,
}: {
  files: { name: string; content: string }[]
  onAttachSelection?: (selection: CodeSelectionData) => void
  isChatLoading?: boolean
}) {
  const [currentFile, setCurrentFile] = useState(files[0].name)
  const [currentSelection, setCurrentSelection] =
    useState<CodeSelection | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    selectedText: string
  } | null>(null)

  const currentFileContent = files.find(
    (file) => file.name === currentFile,
  )?.content

  function download(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  function handleSelectionChange(selection: CodeSelection | null) {
    setCurrentSelection(selection)
  }

  function handleContextMenu(e: React.MouseEvent, selectedText: string) {
    setContextMenu({ x: e.clientX, y: e.clientY, selectedText })
  }

  function handleAttachFromButton() {
    if (!currentSelection || !onAttachSelection) return

    const language = currentFile.split('.').pop() || 'text'
    onAttachSelection({
      code: currentSelection.code,
      fileName: currentFile,
      language,
      lineRange: currentSelection.lineRange,
      tokenEstimate: Math.ceil(currentSelection.code.length / 4),
    })
    setCurrentSelection(null)
    window.getSelection()?.removeAllRanges()
  }

  function handleAttachFromContextMenu() {
    if (!contextMenu?.selectedText || !onAttachSelection) return

    const code = contextMenu.selectedText
    const position = (currentFileContent || '').indexOf(code)
    const textBefore = (currentFileContent || '').substring(0, position)
    const startLine =
      position === -1 ? 1 : (textBefore.match(/\n/g) || []).length + 1
    const endLine = startLine + (code.match(/\n/g) || []).length
    const language = currentFile.split('.').pop() || 'text'

    onAttachSelection({
      code,
      fileName: currentFile,
      language,
      lineRange: { start: startLine, end: endLine },
      tokenEstimate: Math.ceil(code.length / 4),
    })
    setCurrentSelection(null)
  }

  function handleFileTabSwitch(fileName: string) {
    setCurrentFile(fileName)
    setCurrentSelection(null)
  }

  const showUseSelectionButton =
    currentSelection !== null && !isChatLoading && onAttachSelection

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-2 pt-1 gap-2">
        <div className="flex flex-1 gap-2 overflow-x-auto">
          {files.map((file) => (
            <div
              key={file.name}
              className={`flex gap-2 select-none cursor-pointer items-center text-sm text-muted-foreground px-2 py-1 rounded-md hover:bg-muted border ${
                file.name === currentFile ? 'bg-muted border-muted' : ''
              }`}
              onClick={() => handleFileTabSwitch(file.name)}
            >
              <FileText className="h-4 w-4" />
              {file.name}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {showUseSelectionButton && (
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-white hover:text-white h-7 px-2 text-xs gap-1"
                    onClick={handleAttachFromButton}
                  >
                    <Paperclip className="h-3 w-3" />
                    Use Selection
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Attach selected code as chat context
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <CopyButton
                  content={currentFileContent || ''}
                  className="text-muted-foreground"
                />
              </TooltipTrigger>
              <TooltipContent side="bottom">Copy</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={() =>
                    download(currentFile, currentFileContent || '')
                  }
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Download</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div className="flex flex-col flex-1 overflow-x-auto">
        <CodeView
          code={currentFileContent || ''}
          lang={currentFile.split('.').pop() || ''}
          onSelectionChange={handleSelectionChange}
          onContextMenu={handleContextMenu}
          isChatLoading={isChatLoading}
        />
      </div>
      {contextMenu && (
        <CodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectedText={contextMenu.selectedText}
          hasSelection={contextMenu.selectedText.length > 0}
          isChatLoading={isChatLoading || false}
          onCopy={() => {}}
          onUseAsContext={handleAttachFromContextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
