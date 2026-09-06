import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from '../Layout/PageContainer';
import AccountSelect from '../common/AccountSelect';
import Alert from '../common/Alert';
import AppIcon from '../common/AppIcon';
import { useAccounts } from '../../hooks/useAccounts';
import { useDownloadAction } from '../../hooks/useDownloadAction';
import { usePrivacy } from '../../hooks/usePrivacy';
import { useVersionHistory } from '../../hooks/useVersionHistory';
import { getErrorMessage } from '../../utils/error';
import { storeIdToCountry } from '../../apple/config';
import type { Account, Software } from '../../types';

export default function VersionHistory() {
  const location = useLocation();
  const { accounts, updateAccount } = useAccounts();
  const { t } = useTranslation();
  const { startDownload, toastDownloadError } = useDownloadAction();
  const routeState = location.state as { app?: Software; country?: string } | null;
  const app = routeState?.app;
  const country = routeState?.country ?? 'US';
  const [selectedAccount, setSelectedAccount] = useState('');
  const [downloadingVersion, setDownloadingVersion] = useState<string | null>(null);
  const filteredAccounts = useMemo(
    () => accounts.filter((account) => storeIdToCountry(account.store) === country),
    [accounts, country],
  );
  const account = filteredAccounts.find((item) => item.email === selectedAccount) ?? filteredAccounts[0];

  async function handleDownloadVersion(versionId: string) {
    if (!account || !app) return;
    setDownloadingVersion(versionId);
    try {
      await startDownload(account, app, versionId);
    } catch (error) {
      toastDownloadError(account, app, error);
    } finally {
      setDownloadingVersion(null);
    }
  }

  if (!app) {
    return (
      <PageContainer title={t('search.versions.title')}>
        <p className="text-gray-500 [overflow-wrap:anywhere]">
          {t('search.versions.unavailable')}
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer title={t('search.versions.title')}>
      <div className="min-w-0 space-y-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="shrink-0">
            <AppIcon url={app.artworkUrl} name={app.name} size="md" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-medium text-gray-900 [overflow-wrap:anywhere] dark:text-white">
              {app.name}
            </h2>
            <p className="text-sm text-gray-500 [overflow-wrap:anywhere] dark:text-gray-400">
              {app.bundleID}
            </p>
          </div>
        </div>

        {accounts.length > 0 && filteredAccounts.length === 0 ? (
          <Alert type="warning">{t('search.product.noAccountsForRegion')}</Alert>
        ) : account ? (
          <>
            <div className="min-w-0">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('search.versions.account')}
              </label>
              <AccountSelect
                accounts={filteredAccounts}
                value={account.email}
                onChange={setSelectedAccount}
                disabled={downloadingVersion !== null}
                className="w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <VersionList
              key={JSON.stringify([app.id, account.email, account.store, account.deviceIdentifier, account.directoryServicesIdentifier])}
              app={app}
              account={account}
              updateAccount={updateAccount}
              downloadingVersion={downloadingVersion}
              onDownload={handleDownloadVersion}
            />
          </>
        ) : null}
      </div>
    </PageContainer>
  );
}

function VersionList({ app, account, updateAccount, downloadingVersion, onDownload }: {
  app: Software;
  account: Account;
  updateAccount: (account: Account) => Promise<void>;
  downloadingVersion: string | null;
  onDownload: (versionId: string) => void;
}) {
  const { t } = useTranslation();
  const { mask } = usePrivacy();
  const history = useVersionHistory(app, account, updateAccount);

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400" role="status">
          {history.loading ? t('search.versions.loading') : t('search.versions.total', { count: history.versions.length })}
        </p>
        <button
          onClick={history.refresh}
          disabled={history.loading || downloadingVersion !== null}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {t('search.versions.refresh')}
        </button>
      </div>
      {!!history.error && (
        <Alert type="error">
          {mask(getErrorMessage(history.error, t('search.versions.loadFailed')))}
        </Alert>
      )}
      {history.versions.length > 0 && (
        <>
          <div className="min-w-0 divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
            {history.visibleVersions.map((versionId) => {
              const meta = history.metadata[versionId];
              const isDownloading = downloadingVersion === versionId;
              const isLoadingMetadata = history.loadingMetadata.includes(versionId);
              const metadataFailed = history.failed.includes(versionId);
              const canFetchMetadata = !isLoadingMetadata && (!history.autoFetchVersionNumbers || metadataFailed);
              return (
                <div key={versionId} className="flex min-w-0 items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 [overflow-wrap:anywhere] dark:text-white">
                      {meta ? `v${meta.displayVersion}` : `ID: ${versionId}`}
                    </p>
                    {!meta && (canFetchMetadata ? (
                      <button
                        onClick={() => history.requestMetadata(versionId)}
                        className="max-w-full py-1 text-left text-xs text-blue-600 [overflow-wrap:anywhere] transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {t(metadataFailed ? 'search.versions.retryDetails' : 'search.versions.fetchNumber')}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 [overflow-wrap:anywhere] dark:text-gray-500">
                        {t('search.versions.loadingDetails')}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => onDownload(versionId)}
                    disabled={downloadingVersion !== null}
                    className="max-w-[45%] shrink-0 rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-medium leading-tight text-white [overflow-wrap:anywhere] transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isDownloading ? t('search.versions.downloading') : t('search.versions.download')}
                  </button>
                </div>
              );
            })}
          </div>
          {history.pageCount > 1 && (
            <nav aria-label={t('search.versions.pagination')} className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => history.setPage(history.page - 1)}
                disabled={history.page === 0 || downloadingVersion !== null}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
              >
                {t('search.versions.previous')}
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t('search.versions.page', { current: history.page + 1, total: history.pageCount })}
              </span>
              <button
                onClick={() => history.setPage(history.page + 1)}
                disabled={history.page + 1 >= history.pageCount || downloadingVersion !== null}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
              >
                {t('search.versions.next')}
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
