import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { AccountsIcon, DownloadsIcon, HomeIcon, MoonIcon, SearchIcon, SettingsIcon, SunIcon, SystemIcon } from '../common/icons';
import { useSettingsStore } from '../../store/settings';

const navItems = [
  { to: '/', label: 'home', icon: HomeIcon },
  { to: '/accounts', label: 'accounts', icon: AccountsIcon },
  { to: '/search', label: 'search', icon: SearchIcon },
  { to: '/downloads', label: 'downloads', icon: DownloadsIcon },
  { to: '/settings', label: 'settings', icon: SettingsIcon },
];

export default function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside className="app-material sticky top-0 z-30 hidden h-[100dvh] w-56 shrink-0 flex-col border-r border-gray-200/80 bg-gray-50/85 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-950/90 md:flex">
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <img
            src="/icon-192x192.png"
            alt=""
            className="h-10 w-10 shrink-0 rounded-[11px] shadow-[0_2px_8px_rgba(0,0,0,0.14)] ring-1 ring-black/5 dark:ring-white/10"
          />
          <span className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">
            Asspp Web
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'text-gray-600 hover:bg-white/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/75 dark:hover:text-white'
              }`
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {t(`nav.${item.label}`)}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-200/70 p-3 dark:border-gray-800/80">
        <ThemeToggle />
      </div>
    </aside>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useSettingsStore();
  const { t } = useTranslation();

  const cycleTheme = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
      title={t(`theme.${theme}`)}
    >
      {theme === 'light' && <SunIcon className="h-5 w-5" />}
      {theme === 'dark' && <MoonIcon className="h-5 w-5" />}
      {theme === 'system' && <SystemIcon className="h-5 w-5" />}
      <span>{t(`theme.${theme}`)}</span>
    </button>
  );
}
