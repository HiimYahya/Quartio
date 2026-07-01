import { create } from 'zustand'

let counter = 0

const useToastStore = create((set) => ({
  toasts: [],
  push: (type, message) => {
    const id = ++counter
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// API impérative simple : toast.success('...'), toast.error('...'), toast.info('...')
export const toast = {
  success: (m) => useToastStore.getState().push('success', m),
  error:   (m) => useToastStore.getState().push('error', m),
  info:    (m) => useToastStore.getState().push('info', m),
}

export default useToastStore
