import { create } from 'zustand';

export const useChatStore = create((set) => ({
  isOpen: false,
  messages: [],
  isTyping: false,
  sessionId: null,
  toggleChat: () => set((s) => ({ isOpen: !s.isOpen })),
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (messages) => set({ messages }),
  setTyping: (isTyping) => set({ isTyping }),
  setSessionId: (sessionId) => set({ sessionId }),
  clearMessages: () => set({ messages: [], sessionId: null }),
}));
