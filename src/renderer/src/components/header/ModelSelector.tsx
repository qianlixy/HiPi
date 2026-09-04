import React, { useEffect, useState } from 'react'
import { Cpu, ChevronDown, Check } from 'lucide-react'
import { Model } from '../../types'

interface ModelSelectorProps {
  workspacePath?: string
  currentModel?: { provider: string; modelId: string }
  onModelChange: (provider: string, modelId: string) => void
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  workspacePath,
  currentModel,
  onModelChange
}) => {
  const [models, setModels] = useState<Model[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const defaultModels: Model[] = [
    { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet', provider: 'anthropic' },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'o3-mini', name: 'o3-mini', provider: 'openai' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1', provider: 'deepseek' }
  ]

  const loadModels = async () => {
    setLoading(true)
    let availableList: Model[] = []

    try {
      if (workspacePath) {
        const res = await window.hipiApi.pi.getAvailableModels(workspacePath)
        if (res && Array.isArray(res.models) && res.models.length > 0) {
          availableList = res.models.map((m: any) => ({
            id: m.id || m.modelId,
            name: m.name || m.id,
            provider: m.provider || 'default'
          }))
        }
      }
    } catch {}

    // Also merge from customProviders in settings to ensure zero-delay visibility
    try {
      const settings = await window.hipiApi.settings.get()
      if (settings && settings.customProviders) {
        for (const cp of settings.customProviders) {
          const providerId = cp.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
          const mIds = cp.models
            ? cp.models.split(/[\n,]/).map((m) => m.trim()).filter(Boolean)
            : []
          for (const mId of mIds) {
            const exists = availableList.some(
              (m) => m.id === mId && m.provider === providerId
            )
            if (!exists) {
              availableList.push({
                id: mId,
                name: `${cp.name ? cp.name + ' - ' : ''}${mId}`,
                provider: providerId
              })
            }
          }
        }
      }
    } catch {}

    if (availableList.length === 0) {
      setModels(defaultModels)
    } else {
      setModels(availableList)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadModels()
  }, [workspacePath])

  // Re-load when dropdown is opened
  useEffect(() => {
    if (isOpen) {
      loadModels()
    }
  }, [isOpen])

  const activeModel =
    models.find(
      (m) =>
        m.id === currentModel?.modelId &&
        (!currentModel?.provider || m.provider === currentModel.provider)
    ) ||
    models.find((m) => m.id === currentModel?.modelId) ||
    models[0] ||
    defaultModels[0]

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-xs font-medium text-gray-200 border border-[#30363d] transition-colors"
      >
        <Cpu className="w-3.5 h-3.5 text-accent" />
        <span className="truncate max-w-[140px]">{activeModel.name}</span>
        <ChevronDown className="w-3 h-3 text-gray-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-64 max-h-80 overflow-y-auto bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl py-1 z-30">
            <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
              <span>选择模型</span>
              {loading && <span className="text-[10px] text-accent lowercase">刷新中...</span>}
            </div>

            <div className="divide-y divide-[#30363d]/30">
              {models.map((m) => {
                const isSelected =
                  m.id === activeModel.id &&
                  (!currentModel?.provider || m.provider === activeModel.provider)
                return (
                  <button
                    key={`${m.provider}:${m.id}`}
                    onClick={() => {
                      onModelChange(m.provider, m.id)
                      setIsOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[#21262d] transition-colors ${
                      isSelected ? 'text-accent font-semibold bg-[#21262d]/50' : 'text-gray-300'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="truncate font-medium">{m.name}</div>
                      <div className="text-[10px] text-gray-500 font-mono truncate">{m.id}</div>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <span className="text-[10px] text-gray-400 px-1 py-0.5 rounded bg-[#0d1117] border border-[#30363d]/60 uppercase">
                        {m.provider}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent ml-1" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
