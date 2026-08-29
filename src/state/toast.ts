import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
}

interface ToastState {
  toasts: Toast[]
  show: (message: string) => void
  dismiss: (id: number) => void
}

let nextId = 1

/** Tiny global toast queue — used for the XP-style "balloon tip"
 *  confirmations (e.g. "Post published"). Auto-dismisses after a few
 *  seconds; ToastHost (mounted once in App.tsx) renders whatever's queued. */
export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message) => {
    const id = nextId++
    set({ toasts: [...get().toasts, { id, message }] })
    window.setTimeout(() => get().dismiss(id), 3200)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))
