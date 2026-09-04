import React from 'react'
import { MessageSquare, Trash2 } from 'lucide-react'
import { SessionSummary } from '../../types'

interface SessionItemProps {
  session: SessionSummary
  isActive: boolean
  isStreaming?: boolean
  onSelect: (session: SessionSummary) => void
  onDelete: (session: SessionSummary) => void
}

export const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isActive,
  isStreaming,
  onSelect,
  onDelete
}) => {
  const formatTime = (ts: number) => {
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return '刚刚'
    if (mins < 60) return `${mins}分钟前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}小时前`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}天前`
    return new Date(ts).toLocaleDateString()
  }

  return (
    <div
      onClick={() => onSelect(session)}
      onDoubleClick={() => onSelect(session)}
      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors ${
        isActive
          ? 'bg-[#21262d] text-white font-medium border-l-2 border-accent pl-2'
          : 'text-gray-400 hover:bg-[#161b22] hover:text-gray-200'
      }`}
    >
      <div className="flex items-center space-x-2 truncate flex-1 min-w-0">
        {isStreaming ? (
          <span
            data-testid="session-streaming-indicator"
            className="relative flex h-2.5 w-2.5 flex-shrink-0 mr-0.5"
            title="会话正在执行中..."
          >
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
          </span>
        ) : (
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
        )}
        <span className="truncate">{session.name || '新会话'}</span>
      </div>

      <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
        <span className="text-[10px] text-gray-500 group-hover:hidden">
          {formatTime(session.timestamp)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(session)
          }}
          className="hidden group-hover:flex p-1 rounded hover:bg-[#30363d] text-gray-400 hover:text-red-400 transition-colors"
          title="删除会话"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
