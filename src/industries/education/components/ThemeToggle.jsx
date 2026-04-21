import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useThemeStore();
  return (
    <button onClick={toggleTheme} className="relative h-9 w-9 rounded-lg border border-border bg-background-surface flex items-center justify-center hover-lift" aria-label="Toggle theme">
      {theme === 'dark' ? <Sun className="h-4 w-4 text-warning" /> : <Moon className="h-4 w-4 text-foreground-secondary" />}
    </button>
  );
};
export default ThemeToggle;
