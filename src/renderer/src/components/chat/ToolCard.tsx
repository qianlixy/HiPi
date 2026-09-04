import React, { useState } from 'react'
import { Terminal, FileEdit, FilePlus, Eye, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { ToolExecution } from '../../types'

interface ToolCardProps {
  tool: ToolExecution
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool }) => {
  const [isOpen, setIsOpen] = useState(false)

  const getToolIcon = () => {
    switch (tool.toolName) {
      case 'bash':
        return <Terminal className="w-3.5 h-3.5 text-yellow-400" />
      case 'edit':
        return <FileEdit className="w-3.5 h-3.5 text-blue-400" />
      case 'create':
      case 'write':
        return <FilePlus className="w-3.5 h-3.5 text-emerald-400" />
      default:
        return <Eye className="w-3.5 h-3.5 text-purple-400" />
    }
  }

  const getStatusIcon = () => {
    switch (tool.status) {
      case 'running':
        return <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
      case 'completed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
      case 'failed':
        return <AlertCircle className="w-3.5 h-3.5 text-red-400" />
    }
  }

  const formatArgs = () => {
    if (!tool.arguments) return ''
    if (tool.toolName === 'bash' && tool.arguments.command) {
      return tool.arguments.command
    }
    if (tool.arguments.path || tool.arguments.filePath || tool.arguments.file) {
      return tool.arguments.path || tool.arguments.filePath || tool.arguments.file
    }
    return JSON.stringify(tool.arguments).slice(0, 50)
  }

  return (
    <div className="my-2 border border-[#30363d] rounded-lg bg-[#161b22]/90 overflow-hidden text-xs">
      {/* Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#21262d] transition-colors"
      >
        <div className="flex items-center space-x-2 truncate flex-1 min-w-0">
          <button className="text-gray-400 p-0.5">
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {getToolIcon()}
          <span className="font-semibold text-gray-200 capitalize">{tool.toolName}</span>
          <span className="text-gray-400 font-mono text-[11px] truncate bg-[#0d1117] px-1.5 py-0.5 rounded border border-[#30363d]/50">
            {formatArgs()}
          </span>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
          {getStatusIcon()}
          <span className="text-[10px] text-gray-400 capitalize">{tool.status}</span>
        </div>
      </div>

      {/* Body: Output or details */}
      {isOpen && (
        <div className="border-t border-[#30363d] bg-[#0d1117] p-2.5 font-mono text-[11px] max-h-60 overflow-y-auto">
          {tool.output ? (
            <pre className="text-gray-300 whitespace-pre-wrap break-all">{tool.output}</pre>
          ) : tool.error ? (
            <pre className="text-red-400 whitespace-pre-wrap break-all">{tool.error}</pre>
          ) : (
            <div className="text-gray-500 italic">命令正在执行中，等待输出...</div>
          )}
        </div>
      )}
    </div>
  )
}
