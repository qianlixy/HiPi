import React, { useState, useRef, useEffect } from 'react'
import { ArrowUp, Square } from 'lucide-react'

interface PromptInputProps {
  disabled?: boolean
  isStreaming?: boolean
  onSend: (message: string) => void
  onAbort: () => void
}

export function shouldSubmitPrompt(e: {
  key: string
  shiftKey: boolean
  keyCode?: number
  nativeEvent?: { isComposing?: boolean }
}): boolean {
  if (e.nativeEvent?.isComposing || e.keyCode === 229) {
    return false
  }
  return e.key === 'Enter' && !e.shiftKey
}

export const PromptInput: React.FC<PromptInputProps> = ({
  disabled,
  isStreaming,
  onSend,
  onAbort
}) => {
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
    }
  }, [content])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (shouldSubmitPrompt(e)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleSubmit = () => {
    if (isStreaming) {
      onAbort()
      return
    }
    const trimmed = content.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setContent('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  return (
    <div className="p-4 bg-[#0d1117] border-t border-[#30363d] flex-shrink-0 titlebar-no-drag">
      <div className="relative max-w-4xl mx-auto rounded-xl border border-[#30363d] bg-[#161b22] shadow-lg transition-all focus-within:border-accent/80 focus-within:ring-1 focus-within:ring-accent/40">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            disabled
              ? '请先选择一个工作空间...'
              : '向 PI 发送指令，或让它编写、重构代码... (Enter 发送, Shift+Enter 换行)'
          }
          rows={1}
          className="w-full px-4 pt-3 pb-12 bg-transparent text-sm text-gray-100 placeholder-gray-500 resize-none outline-none max-h-48 select-text"
        />

        {/* Bottom Actions Row */}
        <div className="absolute right-3 bottom-2.5 flex items-center space-x-2">
          {isStreaming ? (
            <button
              onClick={onAbort}
              className="p-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium shadow-md transition-all flex items-center space-x-1 text-xs"
              title="停止生成"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>停止</span>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={disabled || !content.trim()}
              className={`p-1.5 rounded-lg transition-all ${
                content.trim() && !disabled
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                  : 'bg-[#21262d] text-gray-500 cursor-not-allowed'
              }`}
              title="发送指令"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
