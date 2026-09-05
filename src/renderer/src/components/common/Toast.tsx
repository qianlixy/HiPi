import React, { useEffect } from 'react'
import { Sparkles } from 'lucide-react'

export interface ToastProps {
  message: string | null
  duration?: number
  onClose: () => void
}

export function createToastTimer(onClose: () => void, duration: number = 2000) {
  const timerId = setTimeout(() => {
    onClose()
  }, duration)

  return {
    clear: () => clearTimeout(timerId)
  }
}

export const Toast: React.FC<ToastProps> = ({
  message,
  duration = 2000,
  onClose
}) => {
  useEffect(() => {
    if (!message) return

    const timer = createToastTimer(onClose, duration)
    return () => timer.clear()
  }, [message, duration, onClose])

  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-[#1c2128]/95 backdrop-blur-md border border-[#30363d] shadow-xl text-gray-200 text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none"
    >
      <Sparkles className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
      <span>{message}</span>
    </div>
  )
}
