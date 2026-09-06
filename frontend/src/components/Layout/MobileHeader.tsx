import { useTranslation } from 'react-i18next';
import { MoonIcon, SunIcon, SystemIcon } from '../common/icons';
import { useSettingsStore } from '../../store/settings';

export default function MobileHeader() {
  const { t } = useTranslation();

  return (
    <>
      {/* Use fixed instead of sticky to prevent PWA overscroll gap, with safe-top / 使用 fixed 替代 sticky 防止 PWA 下拉出现空白缝隙，保留 safe-top */}
      <header className="app-material safe-top fixed left-0 right-0 top-0 z-40 w-full border-b border-gray-200/80 bg-white/90 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/90 md:hidden">
        <div className="grid h-14 grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 px-3">
          <img
            src="/icon-192x192.png"
            alt=""
            className="h-7 w-7 justify-self-center rounded-md ring-1 ring-black/5 dark:ring-white/10"
          />
          <span className="truncate text-center text-base font-semibold tracking-tight text-gray-900 dark:text-white">
            Asspp Web
          </span>
          <ThemeToggle />
        </div>
      </header>
      {/* Spacer to occupy the space of the fixed header in the document flow / 为 fixed 定位的顶栏提供占位，防止下方内容被遮挡 */}
      <div className="md:hidden safe-top">
        <div className="h-14" />
      </div>
    </>
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
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-blue-600 transition-colors hover:bg-gray-100 active:bg-gray-200 dark:text-blue-400 dark:hover:bg-gray-800 dark:active:bg-gray-700"
      aria-label={t(`theme.${theme}`)}
      title={t(`theme.${theme}`)}
    >
      {theme === 'light' && <SunIcon className="h-[18px] w-[18px]" />}
      {theme === 'dark' && <MoonIcon className="h-[18px] w-[18px]" />}
      {theme === 'system' && <SystemIcon className="h-[18px] w-[18px]" />}
    </button>
  );
}
