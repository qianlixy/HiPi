import React, { useRef, useEffect } from 'react'
import { Code, FolderOpen } from 'lucide-react'
import { Workspace, ChatMessage } from '../../types'
import { MessageItem } from './MessageItem'
import { PromptInput } from './PromptInput'

interface ChatAreaProps {
  workspace?: Workspace
  messages: ChatMessage[]
  isStreaming: boolean
  onSendMessage: (message: string) => void
  onAbort: () => void
  onOpenFolderDialog: () => void
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  workspace,
  messages,
  isStreaming,
  onSendMessage,
  onAbort,
  onOpenFolderDialog
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isStreaming])

  return (
    <div className="flex-1 h-full flex flex-col bg-[#0d1117] min-w-0 overflow-hidden titlebar-no-drag">
      {/* Main Messages Container */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto select-text titlebar-no-drag">
        {!workspace ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600/20 to-purple-600/20 border border-blue-500/30 flex items-center justify-center text-accent mb-4 shadow-inner">
              <FolderOpen className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-gray-200">欢迎使用 HiPi 编程客户端</h2>
            <p className="text-xs text-gray-400 mt-1 max-w-sm">
              底层直接驱动 PI Coding Agent，智能执行命令、生成并重构代码
            </p>
            <button
              onClick={onOpenFolderDialog}
              className="mt-6 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg transition-all"
            >
              打开本地工作空间
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
            <div className="w-12 h-12 rounded-xl bg-[#161b22] border border-[#30363d] flex items-center justify-center text-accent mb-3">
              <Code className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-gray-300">开启新会话</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm">
              在下方输入您的编码需求，PI 将读取上下文、调用工具并协助您完成开发
            </p>

            <div className="grid grid-cols-2 gap-2 mt-6 max-w-md w-full text-left">
              <div
                onClick={() => onSendMessage('审查当前工程的代码架构并给出优化建议')}
                className="p-2.5 rounded-lg border border-[#30363d] bg-[#161b22]/60 hover:bg-[#21262d] cursor-pointer text-xs text-gray-300 transition-colors"
              >
                <div className="font-semibold text-accent mb-0.5">代码分析</div>
                <div className="text-[11px] text-gray-400">审查当前工程的代码架构并给出优化建议</div>
              </div>
              <div
                onClick={() => onSendMessage('查看 package.json 并运行测试')}
                className="p-2.5 rounded-lg border border-[#30363d] bg-[#161b22]/60 hover:bg-[#21262d] cursor-pointer text-xs text-gray-300 transition-colors"
              >
                <div className="font-semibold text-purple-400 mb-0.5">运行诊断</div>
                <div className="text-[11px] text-gray-400">查看 package.json 并运行测试</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#30363d]/40">
            {messages.map((msg) => (
              <MessageItem key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom Input Area */}
      <PromptInput
        disabled={!workspace}
        isStreaming={isStreaming}
        onSend={onSendMessage}
        onAbort={onAbort}
      />
    </div>
  )
}
