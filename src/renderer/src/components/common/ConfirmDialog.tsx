import React, { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'

export interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  confirmVariant = 'primary',
  onConfirm,
  onCancel
}) => {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onCancel}
      data-testid="confirm-dialog-backdrop"
    >
      <div
        className="w-full max-w-md bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        data-testid="confirm-dialog-container"
      >
        {/* Header */}
        <div className="h-12 px-4 border-b border-[#30363d] flex items-center justify-between flex-shrink-0 bg-[#0d1117]/60">
          <div className="flex items-center space-x-2">
            {confirmVariant === 'danger' && (
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            )}
            <span className="font-semibold text-sm text-gray-100">{title}</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 text-xs text-gray-300 leading-relaxed">
          {message}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#30363d] bg-[#0d1117]/40 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-[#30363d] bg-[#21262d] hover:bg-[#30363d] text-xs text-gray-200 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors ${
              confirmVariant === 'danger'
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
