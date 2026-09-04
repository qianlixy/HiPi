import React, { useState, useEffect } from 'react'
import {
  X,
  Key,
  Server,
  Terminal,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Save,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { AppSettings, PiRuntimeStatus, CustomProviderConfig } from '../../types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSettingsSaved: (newSettings: AppSettings) => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved
}) => {
  const [activeTab, setActiveTab] = useState<'keys' | 'custom' | 'runtime'>('custom')
  const [settings, setSettings] = useState<AppSettings>({
    apiKeys: {},
    customProviders: [],
    workspaces: []
  })
  const [runtimeStatus, setRuntimeStatus] = useState<PiRuntimeStatus | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )

  // Custom Provider editing state
  const [editingProvider, setEditingProvider] = useState<CustomProviderConfig | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (isOpen) {
      window.hipiApi.settings.get().then((s) => {
        setSettings({
          ...s,
          customProviders: s.customProviders || []
        })
      })
      loadRuntimeStatus()
      setSaveSuccess(false)
      setStatusMsg(null)
      setEditingProvider(null)
    }
  }, [isOpen])

  const loadRuntimeStatus = () => {
    window.hipiApi.pi.getRuntimeStatus().then(setRuntimeStatus)
  }

  const handleKeyChange = (provider: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      apiKeys: {
        ...prev.apiKeys,
        [provider]: value
      }
    }))
  }

  const handleSave = async () => {
    try {
      const updated = await window.hipiApi.settings.save(settings)
      setSettings(updated)
      onSettingsSaved(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: '保存失败: ' + err.message })
    }
  }

  // --- Custom Provider Handlers ---
  const handleAddNewProvider = () => {
    setEditingProvider({
      id: `custom-${Date.now()}`,
      name: '',
      baseUrl: '',
      apiKey: '',
      models: '',
      compat: {
        supportsDeveloperRole: true,
        supportsReasoningEffort: true
      }
    })
    setShowAdvanced(false)
  }

  const handleSaveEditingProvider = () => {
    if (!editingProvider) return
    if (!editingProvider.name.trim() || !editingProvider.baseUrl.trim() || !editingProvider.models.trim()) {
      alert('请填写名称、Base URL 和至少一个模型 ID')
      return
    }

    // Auto-normalize Base URL with /v1
    let normalizedUrl = editingProvider.baseUrl.trim().replace(/\/+$/, '')
    if (!normalizedUrl.endsWith('/v1') && !normalizedUrl.endsWith('/api')) {
      normalizedUrl = `${normalizedUrl}/v1`
    }

    const providerToSave: CustomProviderConfig = {
      ...editingProvider,
      baseUrl: normalizedUrl
    }

    const currentList = settings.customProviders || []
    const index = currentList.findIndex((p) => p.id === providerToSave.id)

    let updatedList: CustomProviderConfig[]
    if (index >= 0) {
      updatedList = [...currentList]
      updatedList[index] = providerToSave
    } else {
      updatedList = [...currentList, providerToSave]
    }

    const updatedSettings = {
      ...settings,
      customProviders: updatedList
    }
    setSettings(updatedSettings)
    setEditingProvider(null)
  }

  const handleDeleteProvider = (id: string) => {
    const currentList = settings.customProviders || []
    const updatedList = currentList.filter((p) => p.id !== id)
    setSettings({
      ...settings,
      customProviders: updatedList
    })
    if (editingProvider?.id === id) {
      setEditingProvider(null)
    }
  }

  const handleUpgrade = async () => {
    setIsUpdating(true)
    setStatusMsg(null)
    try {
      const res = await window.hipiApi.pi.upgradeRuntime()
      if (res.success) {
        setStatusMsg({
          type: 'success',
          text: `PI 成功升级至 v${res.version || '最新版'}`
        })
        loadRuntimeStatus()
      } else {
        setStatusMsg({ type: 'error', text: `升级失败: ${res.error}` })
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `升级失败: ${err.message}` })
    } finally {
      setIsUpdating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Modal Header */}
        <div className="h-14 px-5 border-b border-[#30363d] flex items-center justify-between flex-shrink-0 bg-[#0d1117]/60">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sm text-gray-100">客户端设置</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-[#30363d] px-5 bg-[#0d1117]/30">
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex items-center space-x-2 py-2.5 px-3 border-b-2 text-xs font-medium transition-colors ${
              activeTab === 'custom'
                ? 'border-accent text-accent'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>类 OpenAPI / 兼容接口</span>
          </button>
          <button
            onClick={() => setActiveTab('keys')}
            className={`flex items-center space-x-2 py-2.5 px-3 border-b-2 text-xs font-medium transition-colors ${
              activeTab === 'keys'
                ? 'border-accent text-accent'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>主流 API 密钥</span>
          </button>
          <button
            onClick={() => setActiveTab('runtime')}
            className={`flex items-center space-x-2 py-2.5 px-3 border-b-2 text-xs font-medium transition-colors ${
              activeTab === 'runtime'
                ? 'border-accent text-accent'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>PI 核心运行时</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {statusMsg && (
            <div
              className={`p-3 rounded-lg flex items-center space-x-2 text-xs border ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-red-950/40 border-red-800 text-red-300'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* TAB 1: Custom OpenAI Compatible Providers */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-gray-200">自定义 OpenAI 兼容接口</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    支持接入 OneAPI、NewAPI、本地 Ollama / vLLM 或第三方中转服务。配置将自动同步至 PI。
                  </p>
                </div>
                {!editingProvider && (
                  <button
                    onClick={handleAddNewProvider}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white font-medium shadow-sm transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>添加 Provider</span>
                  </button>
                )}
              </div>

              {/* Provider Edit Form */}
              {editingProvider ? (
                <div className="p-4 rounded-xl border border-accent/40 bg-[#0d1117] space-y-3 shadow-lg">
                  <div className="flex items-center justify-between pb-2 border-b border-[#30363d]">
                    <span className="text-xs font-semibold text-accent">
                      {editingProvider.id.startsWith('custom-') && !editingProvider.name
                        ? '添加自定义 Provider'
                        : `编辑 Provider: ${editingProvider.name}`}
                    </span>
                    <button
                      onClick={() => setEditingProvider(null)}
                      className="text-gray-400 hover:text-white text-xs"
                    >
                      取消
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-300 mb-1">
                        Provider 名称 *
                      </label>
                      <input
                        type="text"
                        value={editingProvider.name}
                        onChange={(e) =>
                          setEditingProvider({ ...editingProvider, name: e.target.value })
                        }
                        placeholder="例如: OneAPI中转 / 本地Ollama"
                        className="w-full px-2.5 py-1.5 rounded bg-[#161b22] border border-[#30363d] text-xs text-gray-200 placeholder-gray-600 focus:border-accent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-300 mb-1">
                        API 基础地址 (Base URL) *
                      </label>
                      <input
                        type="text"
                        value={editingProvider.baseUrl}
                        onChange={(e) =>
                          setEditingProvider({ ...editingProvider, baseUrl: e.target.value })
                        }
                        placeholder="例如: https://ai.example.com/v1"
                        className="w-full px-2.5 py-1.5 rounded bg-[#161b22] border border-[#30363d] text-xs text-gray-200 placeholder-gray-600 focus:border-accent outline-none"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">
                        提示: 标准兼容接口需包含 <code className="text-accent">/v1</code>（如未填写系统将自动补全）
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-300 mb-1">
                      API 密钥 (API Key)
                    </label>
                    <input
                      type="password"
                      value={editingProvider.apiKey}
                      onChange={(e) =>
                        setEditingProvider({ ...editingProvider, apiKey: e.target.value })
                      }
                      placeholder="sk-... (如果本地服务无需验证可留空)"
                      className="w-full px-2.5 py-1.5 rounded bg-[#161b22] border border-[#30363d] text-xs text-gray-200 placeholder-gray-600 focus:border-accent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-300 mb-1">
                      大模型 ID 列表 * (支持逗号或换行分隔多个模型)
                    </label>
                    <textarea
                      rows={2}
                      value={editingProvider.models}
                      onChange={(e) =>
                        setEditingProvider({ ...editingProvider, models: e.target.value })
                      }
                      placeholder="例如: gemini-flash-latest, deepseek-chat, gpt-4o-mini"
                      className="w-full px-2.5 py-1.5 rounded bg-[#161b22] border border-[#30363d] text-xs text-gray-200 placeholder-gray-600 focus:border-accent outline-none resize-none font-mono"
                    />
                  </div>

                  {/* Advanced Collapsible */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center space-x-1 text-[11px] text-gray-400 hover:text-gray-200"
                    >
                      {showAdvanced ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                      <span>高级兼容性选项</span>
                    </button>

                    {showAdvanced && (
                      <div className="mt-2 p-2.5 rounded bg-[#161b22] border border-[#30363d] space-y-2 text-xs">
                        <label className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingProvider.compat?.supportsDeveloperRole !== false}
                            onChange={(e) =>
                              setEditingProvider({
                                ...editingProvider,
                                compat: {
                                  ...editingProvider.compat,
                                  supportsDeveloperRole: e.target.checked
                                }
                              })
                            }
                            className="rounded bg-[#0d1117] border-gray-600 text-accent focus:ring-0"
                          />
                          <span>支持 Developer 角色（若中转服务报错建议取消勾选，将作为 system 消息发送）</span>
                        </label>

                        <label className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingProvider.compat?.supportsReasoningEffort !== false}
                            onChange={(e) =>
                              setEditingProvider({
                                ...editingProvider,
                                compat: {
                                  ...editingProvider.compat,
                                  supportsReasoningEffort: e.target.checked
                                }
                              })
                            }
                            className="rounded bg-[#0d1117] border-gray-600 text-accent focus:ring-0"
                          />
                          <span>支持 reasoning_effort 思考参数（适配带推理的模型）</span>
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={() => setEditingProvider(null)}
                      className="px-3 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-xs text-gray-300"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveEditingProvider}
                      className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow"
                    >
                      保存此 Provider
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Providers List */}
              <div className="space-y-2">
                {(!settings.customProviders || settings.customProviders.length === 0) && !editingProvider ? (
                  <div className="p-6 rounded-lg border border-dashed border-[#30363d] text-center text-gray-500 text-xs">
                    暂未配置自定义 OpenAI 兼容接口。点击上方“+ 添加 Provider”按钮即可添加。
                  </div>
                ) : (
                  (settings.customProviders || []).map((provider) => {
                    const modelList = provider.models
                      ? provider.models.split(/[\n,]/).map((m) => m.trim()).filter(Boolean)
                      : []
                    return (
                      <div
                        key={provider.id}
                        className="p-3 rounded-lg border border-[#30363d] bg-[#0d1117] flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1 flex-1 min-w-0 mr-4">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-gray-200">{provider.name}</span>
                            <span className="px-1.5 py-0.2 rounded bg-purple-950/60 border border-purple-800 text-[10px] text-purple-300">
                              openai-completions
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono truncate">
                            {provider.baseUrl}
                          </div>
                          <div className="text-[11px] text-gray-500 truncate">
                            模型: {modelList.length > 0 ? modelList.join(', ') : '未指定模型'}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEditingProvider(provider)
                              setShowAdvanced(false)
                            }}
                            className="p-1.5 rounded hover:bg-[#21262d] text-gray-400 hover:text-white transition-colors"
                            title="编辑"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProvider(provider.id)}
                            className="p-1.5 rounded hover:bg-[#21262d] text-gray-400 hover:text-red-400 transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Mainstream API Keys */}
          {activeTab === 'keys' && (
            <div className="space-y-3.5">
              <p className="text-xs text-gray-400 leading-relaxed">
                配置各模型服务商密钥。HiPi 会在拉起底层 PI 子进程时自动注入对应的环境变量，避免污染全局配置。
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Anthropic API Key (Claude)
                </label>
                <input
                  type="password"
                  value={settings.apiKeys.anthropic || ''}
                  onChange={(e) => handleKeyChange('anthropic', e.target.value)}
                  placeholder="sk-ant-api03-..."
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-xs text-gray-200 placeholder-gray-600 focus:border-accent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  OpenAI API Key (GPT / o3-mini)
                </label>
                <input
                  type="password"
                  value={settings.apiKeys.openai || ''}
                  onChange={(e) => handleKeyChange('openai', e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-xs text-gray-200 placeholder-gray-600 focus:border-accent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Google Gemini API Key
                </label>
                <input
                  type="password"
                  value={settings.apiKeys.google || ''}
                  onChange={(e) => handleKeyChange('google', e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-xs text-gray-200 placeholder-gray-600 focus:border-accent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  DeepSeek API Key
                </label>
                <input
                  type="password"
                  value={settings.apiKeys.deepseek || ''}
                  onChange={(e) => handleKeyChange('deepseek', e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-xs text-gray-200 placeholder-gray-600 focus:border-accent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  OpenRouter API Key
                </label>
                <input
                  type="password"
                  value={settings.apiKeys.openrouter || ''}
                  onChange={(e) => handleKeyChange('openrouter', e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-xs text-gray-200 placeholder-gray-600 focus:border-accent outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 3: PI Runtime Sandbox */}
          {activeTab === 'runtime' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-[#0d1117] border border-[#30363d] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">运行沙箱路径:</span>
                  <span className="font-mono text-gray-300 text-[11px] truncate max-w-[280px]">
                    {runtimeStatus?.runtimeDir || '~/.hipi/pi-runtime'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">当前已安装版本:</span>
                  <span className="font-semibold text-gray-200">
                    {runtimeStatus?.version ? `v${runtimeStatus.version}` : '未安装'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">线上最新发布版本:</span>
                  <span className="text-accent">
                    {runtimeStatus?.latestVersion ? `v${runtimeStatus.latestVersion}` : '检测中...'}
                  </span>
                </div>
              </div>

              <div className="border border-[#30363d] rounded-lg p-3 bg-[#161b22] text-xs text-gray-400 leading-relaxed">
                <p>
                  底层 PI Coding Agent（
                  <code className="text-gray-300">@earendil-works/pi-coding-agent</code>
                  ）运行在独立的沙箱环境中。点击下方按钮即可一键在后台升级至最新版，无需更新整个 HiPi 客户端。
                </p>
              </div>

              <button
                onClick={handleUpgrade}
                disabled={isUpdating}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-xs font-semibold text-white shadow-md flex items-center justify-center space-x-2 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                <span>{isUpdating ? '正在在线升级 PI...' : '一键升级 PI 至最新版本'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="h-14 px-5 border-t border-[#30363d] flex items-center justify-between bg-[#0d1117]/60 flex-shrink-0">
          <div className="text-[11px] text-gray-500">
            {saveSuccess && <span className="text-emerald-400">设置与模型已同步保存生效！</span>}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg hover:bg-[#21262d] text-xs text-gray-300 transition-colors"
            >
              关闭
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-accent hover:bg-blue-400 text-xs font-semibold text-black shadow-md flex items-center space-x-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>保存配置</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
