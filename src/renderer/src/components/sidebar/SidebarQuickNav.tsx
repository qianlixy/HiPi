import React from 'react'
import { MessageSquarePlus, ListTodo } from 'lucide-react'

export interface QuickNavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
  badge?: string | number
  onClick: () => void
}

export interface SidebarQuickNavProps {
  onAction?: (actionId: string, label: string) => void
}

export function getQuickNavItems(
  onAction?: (actionId: string, label: string) => void
): QuickNavItem[] {
  return [
    {
      id: 'new-session',
      label: '新建会话',
      icon: MessageSquarePlus,
      shortcut: '⌘N',
      onClick: () => onAction?.('new-session', '新建会话')
    },
    {
      id: 'task-list',
      label: '任务列表',
      icon: ListTodo,
      onClick: () => onAction?.('task-list', '任务列表')
    }
  ]
}

export const SidebarQuickNav: React.FC<SidebarQuickNavProps> = ({ onAction }) => {
  const items = getQuickNavItems(onAction)

  return (
    <div className="flex-shrink-0 px-2 pt-2.5 pb-1 select-none">
      {/* Quick Action Entries */}
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon
          const isPrimary = item.id === 'new-session'
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-all group ${
                isPrimary
                  ? 'bg-[#21262d]/60 hover:bg-[#21262d] text-gray-200 border border-[#30363d]/60 hover:border-[#30363d]'
                  : 'hover:bg-[#21262d] text-gray-300 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <Icon
                  className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isPrimary
                      ? 'text-blue-400 group-hover:text-blue-300'
                      : 'text-gray-400 group-hover:text-gray-300'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.shortcut && (
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-gray-500 bg-[#161b22] border border-[#30363d] rounded">
                  {item.shortcut}
                </kbd>
              )}
            </button>
          )
        })}
      </div>

      {/* Section Divider & Label */}
      <div className="pt-3 pb-1 px-1 flex items-center justify-between text-[11px] font-medium text-gray-500">
        <span>工作空间</span>
      </div>
    </div>
  )
}
