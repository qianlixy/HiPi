import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { User, Sparkles, AlertCircle, Copy, Check } from 'lucide-react'
import { ChatMessage } from '../../types'
import { ToolCard } from './ToolCard'

interface MessageItemProps {
  message: ChatMessage
}

function extractNodeText(node: React.ReactNode): string {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractNodeText).join('')
  if (React.isValidElement(node) && node.props && (node.props as any).children) {
    return extractNodeText((node.props as any).children)
  }
  return ''
}

export function handleLinkClick(e: React.MouseEvent<HTMLAnchorElement>, href?: string) {
  e.preventDefault()
  if (!href) return
  if (typeof window !== 'undefined' && window.hipiApi?.system?.openExternal) {
    window.hipiApi.system.openExternal(href)
  } else if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(href, '_blank', 'noopener,noreferrer')
  }
}

export const MarkdownLink: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement>> = ({
  href,
  children,
  ...props
}) => {
  return (
    <a
      href={href}
      onClick={(e) => handleLinkClick(e, href)}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
      className="text-[#58a6ff] hover:text-[#79c0ff] hover:underline underline-offset-2 decoration-[#58a6ff]/60 cursor-pointer font-medium transition-colors duration-150 break-all"
      {...props}
    >
      {children}
    </a>
  )
}

const CodeBlock: React.FC<React.HTMLAttributes<HTMLPreElement>> = ({ children, ...props }) => {
  const [copied, setCopied] = useState(false)

  let language = ''
  if (React.isValidElement(children) && children.props && typeof (children.props as any).className === 'string') {
    const match = /language-(\w+)/.exec((children.props as any).className || '')
    if (match) language = match[1]
  }

  const handleCopy = () => {
    const text = extractNodeText(children)
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <div className="relative group/code my-3 rounded-lg overflow-hidden border border-[#30363d] bg-[#161b22] select-text">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1c2128] text-xs text-gray-400 border-b border-[#30363d]/60 select-none">
        <span className="font-mono text-[11px] uppercase text-gray-400">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center space-x-1 hover:text-white px-2 py-0.5 rounded hover:bg-[#30363d]/50 transition-colors text-[11px] select-none cursor-pointer"
          title="复制代码"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">已复制</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-gray-400" />
              <span>复制代码</span>
            </>
          )}
        </button>
      </div>
      <pre className="!bg-transparent !border-none !m-0 !p-3 overflow-x-auto select-text font-mono text-xs" {...props}>
        {children}
      </pre>
    </div>
  )
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user'
  const isError = !isUser && message.content.startsWith('⚠️')
  const hasTools = message.toolExecutions && message.toolExecutions.length > 0
  const isEmpty = !isUser && !message.content && !hasTools && !message.isStreaming

  return (
    <div className={`py-4 px-6 flex space-x-3.5 select-text ${isUser ? 'bg-transparent' : 'bg-[#161b22]/30'}`}>
      {/* Avatar */}
      <div className="flex-shrink-0 pt-0.5 select-none">
        {isUser ? (
          <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-400">
            <User className="w-4 h-4" />
          </div>
        ) : isError ? (
          <div className="w-7 h-7 rounded-full bg-red-600/20 border border-red-500/50 flex items-center justify-center text-red-400">
            <AlertCircle className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Content Body */}
      <div className="flex-1 min-w-0 space-y-2 select-text">
        <div className="flex items-center space-x-2 select-none">
          <span className={`text-xs font-semibold ${isError ? 'text-red-300' : 'text-gray-300'}`}>
            {isUser ? 'You' : isError ? '调用异常' : 'PI Assistant'}
          </span>
          <span className="text-[10px] text-gray-500">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>

        {/* Tool Executions (if any) */}
        {hasTools && (
          <div className="space-y-1.5 my-2">
            {message.toolExecutions!.map((tool) => (
              <ToolCard key={tool.toolCallId} tool={tool} />
            ))}
          </div>
        )}

        {/* Error Card */}
        {isError && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-start space-x-2.5 select-text">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400 select-none" />
            <div className="flex-1 leading-relaxed whitespace-pre-wrap select-text">{message.content}</div>
          </div>
        )}

        {/* Normal Text Content */}
        {!isError && message.content && (
          <div className="text-sm text-gray-200 leading-relaxed font-normal prose prose-invert max-w-none break-words select-text">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                pre({ children, ...props }) {
                  return <CodeBlock {...props}>{children}</CodeBlock>
                },
                a: MarkdownLink
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Empty Content Fallback when streaming finished without output */}
        {isEmpty && (
          <div className="p-3 rounded-lg bg-yellow-950/30 border border-yellow-800/60 text-yellow-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>未收到回复内容。请检查 API Key、模型 ID（如拼写）或网络连接是否正常。</span>
          </div>
        )}

        {/* Streaming Cursor */}
        {message.isStreaming && (
          <span className="inline-block w-2 h-4 bg-accent animate-pulse align-middle ml-1" />
        )}
      </div>
    </div>
  )
}
