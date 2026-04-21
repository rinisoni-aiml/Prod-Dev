import { create } from 'zustand';

export const useThemeStore = create((set) => {
  const saved = localStorage.getItem('pulseiq-theme');
  const initial = saved || 'dark';
  document.documentElement.classList.toggle('dark', initial === 'dark');

  return {
    theme: initial,
    toggleTheme: () =>
      set((state) => {
        const next = state.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('pulseiq-theme', next);
        document.documentElement.classList.toggle('dark', next === 'dark');
        return { theme: next };
      }),
    setTheme: (theme) => {
      localStorage.setItem('pulseiq-theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
      set({ theme });
    },
  };
});
