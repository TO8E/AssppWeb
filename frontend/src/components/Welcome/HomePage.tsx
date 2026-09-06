import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from '../Layout/PageContainer';
import AppIcon from '../common/AppIcon';
import Badge from '../common/Badge';
import { ChevronRightIcon, DownloadsIcon, SearchIcon } from '../common/icons';
import { useAccounts } from '../../hooks/useAccounts';
import { useSearch } from '../../hooks/useSearch';
import { useDownloadsStore } from '../../store/downloads';
import { useSettingsStore } from '../../store/settings';
import { firstAccountCountry } from '../../utils/account';
import type { DownloadTask } from '../../types';

const activeStatuses = new Set<DownloadTask['status']>(['pending', 'downloading', 'injecting']);

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { accounts, loading: accountsLoading } = useAccounts();
  // The global download notifier already fetches and polls this shared store.
  const tasks = useDownloadsStore((state) => state.tasks);
  const downloadsLoading = useDownloadsStore((state) => state.loading);
  const defaultCountry = useSettingsStore((state) => state.defaultCountry);
  const defaultEntity = useSettingsStore((state) => state.defaultEntity);
  const country = useSearch((state) => state.country);
  const entity = useSearch((state) => state.entity);
  const search = useSearch((state) => state.search);
  const [term, setTerm] = useState('');

  const recentTasks = accounts.length === 0 ? [] : [...tasks]
    .sort((a, b) => Number(activeStatuses.has(b.status)) - Number(activeStatuses.has(a.status)) ||
      (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
    .slice(0, 6);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    const query = term.trim();
    if (!query) return;
    void search(query, country || firstAccountCountry(accounts) || defaultCountry, entity || defaultEntity);
    navigate('/search');
  }

  return (
    <PageContainer
      title={t('nav.home')}
      action={accounts.length > 0 ? (
        <Link to="/accounts" className="inline-flex min-h-10 items-center gap-1 text-sm text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400">
          {t('home.accountCount', { count: accounts.length })}
          <ChevronRightIcon className="h-4 w-4" />
        </Link>
      ) : undefined}
    >
      <div className="space-y-6">
        <form onSubmit={handleSearch} role="search" aria-label={t('home.actions.searchApps')} className="flex min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 dark:border-gray-800 dark:bg-gray-900 dark:focus-within:border-blue-400">
          <SearchIcon className="ml-2 h-5 w-5 text-gray-400" />
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            aria-label={t('search.placeholder')}
            placeholder={t('search.placeholder')}
            className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-base text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
          />
          <button type="submit" disabled={!term.trim()} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50">
            {t('search.button')}
          </button>
        </form>

        {!accountsLoading && accounts.length === 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('home.addAccountHint')}</p>
            <Link to="/accounts/add" className="inline-flex min-h-10 items-center text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
              {t('home.actions.addAccount')}
              <ChevronRightIcon className="ml-1 h-4 w-4" />
            </Link>
          </div>
        )}

        <section aria-labelledby="recent-downloads-title">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="recent-downloads-title" className="text-base font-semibold text-gray-900 dark:text-white">{t('home.recentDownloads')}</h2>
            <Link to="/downloads" className="inline-flex min-h-10 items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
              {t('home.viewAll')}
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </div>
          {recentTasks.length > 0 ? (
            <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
              {recentTasks.map((task) => (
                <Link key={task.id} to={`/downloads/${task.id}`} className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 active:bg-gray-100 dark:hover:bg-gray-800/60 dark:active:bg-gray-800">
                  <AppIcon url={task.software.artworkUrl} name={task.software.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{task.software.name}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                      v{task.software.version}
                      {activeStatuses.has(task.status) && ` · ${Math.round(task.progress)}%`}
                    </p>
                  </div>
                  <Badge status={task.status} />
                  <ChevronRightIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 px-4 py-6 text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <DownloadsIcon className="h-5 w-5" />
              <p className="text-sm">{accountsLoading || downloadsLoading ? t('loading') : t('home.noDownloads')}</p>
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
