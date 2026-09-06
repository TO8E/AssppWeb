import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from '../Layout/PageContainer';
import Button from '../common/Button';
import AccountSelect from '../common/AccountSelect';
import Alert from '../common/Alert';
import SoftwareHeader from '../common/SoftwareHeader';
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
      <PageContainer back={{ to: '/search', label: t('nav.backTo', { page: t('nav.search') }) }} title={t('search.versions.title')}>
        <p className="text-gray-500 [overflow-wrap:anywhere]">
          {t('search.versions.unavailable')}
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer back={{ to: app ? `/search/${app.id}` : '/search', label: t('nav.backTo', { page: app ? t('search.product.title') : t('nav.search') }), state: app ? { app, country } : undefined }} title={t('search.versions.title')}>
      <div className="min-w-0 space-y-6">
        <SoftwareHeader app={app}><span>{app.bundleID}</span></SoftwareHeader>

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
                className="w-full min-w-0"
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
        <Button
          onClick={history.refresh}
          disabled={history.loading || downloadingVersion !== null}
          variant="secondary"
        >
          {t('search.versions.refresh')}
        </Button>
      </div>
      {!!history.error && (
        <Alert type="error">
          {mask(getErrorMessage(history.error, t('search.versions.loadFailed')))}
        </Alert>
      )}
      {history.versions.length > 0 && (
        <>
          <div className="ui-list">
            {history.visibleVersions.map((versionId) => {
              const meta = history.metadata[versionId];
              const isDownloading = downloadingVersion === versionId;
              const isLoadingMetadata = history.loadingMetadata.includes(versionId);
              const metadataFailed = history.failed.includes(versionId);
              const canFetchMetadata = !isLoadingMetadata && (!history.autoFetchVersionNumbers || metadataFailed);
              return (
                <div key={versionId} className="ui-list-row justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 [overflow-wrap:anywhere] dark:text-white">
                      {meta ? `v${meta.displayVersion}` : `ID: ${versionId}`}
                    </p>
                    {!meta && (canFetchMetadata ? (
                      <Button
                        onClick={() => history.requestMetadata(versionId)}
                        variant="plain" className="max-w-full"
                      >
                        {t(metadataFailed ? 'search.versions.retryDetails' : 'search.versions.fetchNumber')}
                      </Button>
                    ) : (
                      <span className="text-xs text-gray-400 [overflow-wrap:anywhere] dark:text-gray-500">
                        {t('search.versions.loadingDetails')}
                      </span>
                    ))}
                  </div>
                  <Button
                    onClick={() => onDownload(versionId)}
                    disabled={downloadingVersion !== null}
                    variant="secondary" className="max-w-[45%] shrink-0"
                  >
                    {isDownloading ? t('search.versions.downloading') : t('search.versions.download')}
                  </Button>
                </div>
              );
            })}
          </div>
          {history.pageCount > 1 && (
            <nav aria-label={t('search.versions.pagination')} className="flex flex-wrap items-center justify-between gap-3">
              <Button
                onClick={() => history.setPage(history.page - 1)}
                disabled={history.page === 0 || downloadingVersion !== null}
                variant="secondary"
              >
                {t('search.versions.previous')}
              </Button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t('search.versions.page', { current: history.page + 1, total: history.pageCount })}
              </span>
              <Button
                onClick={() => history.setPage(history.page + 1)}
                disabled={history.page + 1 >= history.pageCount || downloadingVersion !== null}
                variant="secondary"
              >
                {t('search.versions.next')}
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
