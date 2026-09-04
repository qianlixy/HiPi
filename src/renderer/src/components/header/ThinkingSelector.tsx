import React, { useEffect, useState } from 'react'
import { Brain, ChevronDown } from 'lucide-react'

interface ThinkingSelectorProps {
  workspacePath?: string
  currentLevel?: string
  onLevelChange: (level: string) => void
}

export const ThinkingSelector: React.FC<ThinkingSelectorProps> = ({
  workspacePath,
  currentLevel = 'off',
  onLevelChange
}) => {
  const [levels, setLevels] = useState<string[]>(['off', 'low', 'medium', 'high'])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!workspacePath) return
    window.hipiApi.pi
      .getAvailableThinkingLevels(workspacePath)
      .then((res) => {
        if (res && Array.isArray(res.levels) && res.levels.length > 0) {
          setLevels(res.levels)
        }
      })
      .catch(() => {})
  }, [workspacePath])

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-xs font-medium text-gray-200 border border-[#30363d] transition-colors"
        title="思考预算与深度"
      >
        <Brain className={`w-3.5 h-3.5 ${currentLevel !== 'off' ? 'text-purple-400' : 'text-gray-400'}`} />
        <span className="capitalize">{currentLevel}</span>
        <ChevronDown className="w-3 h-3 text-gray-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-32 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl py-1 z-30">
            <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Thinking 深度
            </div>
            {levels.map((lvl) => (
              <button
                key={lvl}
                onClick={() => {
                  onLevelChange(lvl)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-3 py-1.5 text-xs capitalize hover:bg-[#21262d] transition-colors ${
                  lvl === currentLevel ? 'text-purple-400 font-semibold' : 'text-gray-300'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
