import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { User, Sparkles, AlertCircle } from 'lucide-react'
import { ChatMessage } from '../../types'
import { ToolCard } from './ToolCard'

interface MessageItemProps {
  message: ChatMessage
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user'
  const isError = !isUser && message.content.startsWith('⚠️')
  const hasTools = message.toolExecutions && message.toolExecutions.length > 0
  const isEmpty = !isUser && !message.content && !hasTools && !message.isStreaming

  return (
    <div className={`py-4 px-6 flex space-x-3.5 ${isUser ? 'bg-transparent' : 'bg-[#161b22]/30'}`}>
      {/* Avatar */}
      <div className="flex-shrink-0 pt-0.5">
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
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center space-x-2">
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
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
            <div className="flex-1 leading-relaxed whitespace-pre-wrap">{message.content}</div>
          </div>
        )}

        {/* Normal Text Content */}
        {!isError && message.content && (
          <div className="text-sm text-gray-200 leading-relaxed font-normal prose prose-invert max-w-none break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
