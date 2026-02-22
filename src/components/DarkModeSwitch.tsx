import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useLanguage } from '../i18n';

interface DarkModeSwitchProps {
  /** Sidebar collapsed state – hides label when true */
  collapsed?: boolean;
  /** Show a text label next to the icon (for sidebar usage) */
  showLabel?: boolean;
}

const DarkModeSwitch = ({ collapsed = false, showLabel = false }: DarkModeSwitchProps) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { language } = useLanguage();
  const isDark = resolvedTheme === 'dark';

  const label = isDark
    ? language === 'en' ? 'Light Mode' : 'ライトモード'
    : language === 'en' ? 'Dark Mode' : 'ダークモード';

  if (showLabel) {
    return (
      <button
        onClick={toggleTheme}
        className={`
          w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm
          text-rakubun-text-secondary hover:bg-rakubun-bg-secondary hover:text-rakubun-text
          transition-all duration-200
          ${collapsed ? 'justify-center px-0' : ''}
        `}
        aria-label={label}
      >
        {isDark ? (
          <Sun className="w-[18px] h-[18px] shrink-0" />
        ) : (
          <Moon className="w-[18px] h-[18px] shrink-0" />
        )}
        {!collapsed && <span>{label}</span>}
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-rakubun-text-secondary hover:text-rakubun-text hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-200"
      aria-label={label}
      title={label}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};

export default DarkModeSwitch;
