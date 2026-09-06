import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from '../Layout/PageContainer';
import Button from '../common/Button';
import { Select } from '../common/FormControl';
import Section, { InfoRow } from '../common/Section';
import SoftwareHeader from '../common/SoftwareHeader';
import Badge from '../common/Badge';
import Modal from '../common/Modal';
import ProgressBar from '../common/ProgressBar';
import PackageQuickActions from './PackageQuickActions';
import { usePrivacy } from '../../hooks/usePrivacy';
import { useAccounts } from '../../hooks/useAccounts';
import { useDownloadAction } from '../../hooks/useDownloadAction';
import { useDownloads } from '../../hooks/useDownloads';
import { useToastStore } from '../../store/toast';
import { listVersions } from '../../apple/versionFinder';
import { lookupApp } from '../../api/search';
import { formatBytes } from '../../utils/format';
import { getAccountContext } from '../../utils/toast';
import { isNewerVersion } from '../../utils/version';
import { storeIdToCountry } from '../../apple/config';
import type { Software } from '../../types';

export default function PackageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { mask } = usePrivacy();
  const { tasks, deleteDownload, pauseDownload, resumeDownload, hashToEmail } =
    useDownloads();
  const { accounts } = useAccounts();
  const { startDownload } = useDownloadAction();
  const addToast = useToastStore((state) => state.addToast);

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [latestApp, setLatestApp] = useState<Software | null>(null);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState('');

  const task = tasks.find((item) => item.id === id);

  if (!task) {
    return (
      <PageContainer back={{ to: "/downloads", label: t('nav.backTo', { page: t('nav.downloads') }) }} title={t('downloads.package.title')}>
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">
          {tasks.length === 0 ? t('loading') : t('downloads.package.notFound')}
        </div>
      </PageContainer>
    );
  }

  const isActive = task.status === 'downloading' || task.status === 'injecting';
  const isPaused = task.status === 'paused';
  const isCompleted = task.status === 'completed';
  const accountEmail = hashToEmail[task.accountHash];
  const account = accounts.find((item) => item.email === accountEmail);
  const accountLabel = mask(accountEmail || task.accountHash);
  const appName = task.software.name;
  const taskId = task.id;
  const bundleID = task.software.bundleID;
  const currentVersion = task.software.version;

  async function handleDelete() {
    if (!confirm(t('downloads.package.deleteConfirm'))) return;

    await deleteDownload(taskId);
    const context = getAccountContext(account, t);
    addToast(
      t('toast.msg', { appName, ...context }),
      'success',
      t('toast.title.deleteSuccess'),
    );
    navigate('/downloads');
  }

  function handlePause() {
    pauseDownload(taskId);
  }

  function handleResume() {
    resumeDownload(taskId);
  }

  async function handleCheckUpdate() {
    if (!account) return;

    setCheckingUpdate(true);
    try {
      const country = storeIdToCountry(account.store) ?? 'US';
      const app = await lookupApp(bundleID, country);

      if (app && isNewerVersion(app.version, currentVersion)) {
        setLatestApp(app);
        const result = await listVersions(account, app);
        setAvailableVersions(result.versions);
        setSelectedVersion(result.versions[0] || '');
        setShowUpdateModal(true);
      } else {
        addToast(t('downloads.package.noUpdate'), 'info');
      }
    } catch {
      addToast(t('downloads.package.checkUpdateFailed'), 'error');
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function handleConfirmUpdate() {
    if (!account || !latestApp) return;

    setShowUpdateModal(false);
    try {
      const isLatest =
        availableVersions.length > 0 &&
        selectedVersion === availableVersions[0];
      await startDownload(
        account,
        latestApp,
        isLatest ? undefined : selectedVersion,
      );
      await deleteDownload(taskId);
      navigate('/downloads');
    } catch {
      addToast(t('downloads.package.updateFailed'), 'error');
    }
  }

  return (
    <PageContainer back={{ to: "/downloads", label: t('nav.backTo', { page: t('nav.downloads') }) }} title={t('downloads.package.title')}>
      <div className="min-w-0">

        <Section className="min-w-0">
          <SoftwareHeader app={task.software}>
            <Badge status={task.status} />
            <span>v{currentVersion}</span>
          </SoftwareHeader>

          {(isActive || isPaused) && (
            <div className="mt-4 min-w-0 border-t border-gray-100 pt-4 dark:border-gray-800">
              <ProgressBar
                progress={task.progress}
                label={task.software.name}
              />
              <div className="mt-1.5 flex min-w-0 justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
                <span>{Math.round(task.progress)}%</span>
                {task.speed && isActive && (
                  <span className="min-w-0 truncate text-right">
                    {task.speed}
                  </span>
                )}
              </div>
            </div>
          )}

          {task.error && (
            <p
              role="alert"
              className="mt-4 min-w-0 break-words rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 [overflow-wrap:anywhere] dark:bg-red-950/30 dark:text-red-400"
            >
              {mask(task.error)}
            </p>
          )}
        </Section>

        <Section
          aria-labelledby="package-information-title"
          className="min-w-0"
        >
          <h3
            id="package-information-title" className="ui-section-title"
          >
            {t('downloads.package.information')}
          </h3>

          <dl className="min-w-0">
            <DetailTile
              label={t('downloads.package.size')}
              value={formatBytes(task.software.fileSizeBytes)}
            />
            <DetailTile
              label={t('downloads.package.minOs')}
              value={`iOS ${task.software.minimumOsVersion || '—'}`}
            />
            <DetailTile
              label={t('downloads.package.category')}
              value={task.software.primaryGenreName || '—'}
            />
            <DetailTile
              label={t('downloads.package.released')}
              value={formatDate(task.software.releaseDate)}
            />
          </dl>

          <dl className="min-w-0 border-t border-gray-100 dark:border-gray-800">
            <PackageDetailRow
              label={t('downloads.package.developer')}
              valueTitle={task.software.sellerName}
            >
              {task.software.sellerName || task.software.artistName}
            </PackageDetailRow>
            <PackageDetailRow
              label={t('downloads.package.bundleId')}
              valueTitle={task.software.bundleID}
              mono
            >
              {task.software.bundleID}
            </PackageDetailRow>
            <PackageDetailRow
              label={t('downloads.package.version')}
              valueTitle={task.software.version}
              mono
            >
              {task.software.version}
            </PackageDetailRow>
            <PackageDetailRow
              label={t('downloads.package.account')}
              valueTitle={accountLabel}
            >
              {accountLabel}
            </PackageDetailRow>
            <PackageDetailRow label={t('downloads.package.created')}>
              {new Date(task.createdAt).toLocaleString()}
            </PackageDetailRow>
          </dl>
        </Section>

        <Section
          aria-labelledby="package-actions-title"
          className="min-w-0"
        >
          <h3
            id="package-actions-title" className="ui-section-title"
          >
            {t('downloads.package.quickActions')}
          </h3>

          {isCompleted && !task.hasFile && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              {t('downloads.package.fileUnavailable')}
            </p>
          )}

          <div className="mt-4">
            <PackageQuickActions task={task}>
            {isCompleted && (
              <Button
                type="button"
                onClick={handleCheckUpdate}
                disabled={checkingUpdate || !account}
                variant="secondary" className="min-w-0"
              >
                {checkingUpdate
                  ? t('downloads.package.checkingUpdate')
                  : t('downloads.package.checkUpdate')}
              </Button>
            )}
            {isActive && (
              <Button
                type="button"
                onClick={handlePause}
                variant="secondary" className="min-w-0"
              >
                {t('downloads.package.pause')}
              </Button>
            )}
            {isPaused && (
              <Button
                type="button"
                onClick={handleResume}
                variant="primary" className="min-w-0"
              >
                {t('downloads.package.resume')}
              </Button>
            )}
            <Button
              type="button"
              onClick={handleDelete}
              variant="danger" className="min-w-0"
            >
              {t('downloads.package.delete')}
            </Button>
            </PackageQuickActions>
          </div>
        </Section>
      </div>

      <Modal
        open={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        title={t('downloads.package.updateAvailable')}
      >
        <div className="min-w-0 space-y-4">
          <p className="min-w-0 break-words text-sm text-gray-600 [overflow-wrap:anywhere] dark:text-gray-300">
            {t('downloads.package.updatePrompt', {
              version: latestApp?.version,
            })}
          </p>
          {availableVersions.length > 0 && (
            <div className="min-w-0">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('downloads.package.selectVersion')}
              </label>
              <Select
                value={selectedVersion}
                onChange={(event) => setSelectedVersion(event.target.value)}
                className="w-full min-w-0 max-w-full"
              >
                {availableVersions.map((version, index) => (
                  <option key={version} value={version}>
                    {index === 0
                      ? t('downloads.package.latestVersion', { id: version })
                      : version}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="mt-6 grid min-w-0 grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={() => setShowUpdateModal(false)}
              variant="secondary" className="min-w-0"
            >
              {t('settings.data.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleConfirmUpdate}
              variant="primary" className="min-w-0"
            >
              {t('downloads.package.update')}
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return <InfoRow label={label} title={value}>{value}</InfoRow>;
}

function PackageDetailRow({ label, children, mono = false, valueTitle }: {
  label: string; children: ReactNode; mono?: boolean; valueTitle?: string;
}) {
  return <InfoRow label={label} mono={mono} title={valueTitle}>{children}</InfoRow>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}
