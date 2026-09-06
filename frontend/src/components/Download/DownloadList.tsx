import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from '../Layout/PageContainer';
import Button, { buttonClass } from '../common/Button';
import EmptyState from '../common/EmptyState';
import Modal from '../common/Modal';
import ProgressBar from '../common/ProgressBar';
import Spinner from '../common/Spinner';
import DownloadItem from './DownloadItem';
import { useDownloads } from '../../hooks/useDownloads';
import { useAccounts } from '../../hooks/useAccounts';
import { useDownloadAction } from '../../hooks/useDownloadAction';
import { useToastStore } from '../../store/toast';
import { lookupApp } from '../../api/search';
import { getAccountContext } from '../../utils/toast';
import { isNewerVersion } from '../../utils/version';
import { storeIdToCountry } from '../../apple/config';
import type { DownloadTask } from '../../types';

type StatusFilter = "all" | DownloadTask["status"];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function DownloadList() {
  const { t } = useTranslation();
  const {
    tasks,
    loading,
    pauseDownload,
    resumeDownload,
    deleteDownload,
    hashToEmail,
  } = useDownloads();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const addToast = useToastStore((s) => s.addToast);
  const { accounts } = useAccounts();
  const { startDownload } = useDownloadAction();

  const [checkingAll, setCheckingAll] = useState(false);
  const cancelCheckRef = useRef(false);
  const [checkProgress, setCheckProgress] = useState({
    current: 0,
    total: 0,
    appName: "",
  });

  useEffect(() => {
    return () => {
      cancelCheckRef.current = true;
    };
  }, []);

  const filtered =
    filter === "all"
      ? tasks
      : tasks.filter((task) => task.status === filter);

  const sortedTasks = [...filtered].sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  function handleDelete(id: string) {
    const task = tasks.find((item) => item.id === id);

    if (!confirm(t("downloads.deleteConfirm"))) return;

    if (task) {
      const accountEmail = hashToEmail[task.accountHash];
      const account = accounts.find((a) => a.email === accountEmail);
      const ctx = getAccountContext(account, t);

      addToast(
        t("toast.msg", { appName: task.software.name, ...ctx }),
        "success",
        t("toast.title.deleteSuccess"),
      );
    }

    deleteDownload(id);
  }

  function handlePause(id: string) {
    pauseDownload(id);
  }

  function handleResume(id: string) {
    resumeDownload(id);
  }

  function handleCancelCheck() {
    cancelCheckRef.current = true;
    setCheckingAll(false);
  }

  async function handleCheckAllUpdates() {

    cancelCheckRef.current = false;
    setCheckingAll(true);
    addToast(t("downloads.checkUpdatesStarted"), "info");
    let count = 0;
    const completedTasks = tasks.filter((t) => t.status === "completed");

    setCheckProgress({ current: 0, total: completedTasks.length, appName: "" });

    for (let i = 0; i < completedTasks.length; i++) {
      if (cancelCheckRef.current) break;

      const task = completedTasks[i];
      const accountEmail = hashToEmail[task.accountHash];
      const account = accounts.find((a) => a.email === accountEmail);

      setCheckProgress((prev) => ({ ...prev, appName: task.software.name }));

      if (!account) {
        setCheckProgress((prev) => ({ ...prev, current: i + 1 }));
        continue;
      }

      try {
        await delay(1500);
        if (cancelCheckRef.current) break;

        const country = storeIdToCountry(account.store) ?? "US";
        const latestApp = await lookupApp(task.software.bundleID, country);

        if (
          latestApp &&
          isNewerVersion(latestApp.version, task.software.version)
        ) {
          await startDownload(account, latestApp);
          await deleteDownload(task.id);
          count++;
        }
      } catch {
        // Continue with next item
      }

      setCheckProgress((prev) => ({ ...prev, current: i + 1 }));
    }

    if (!cancelCheckRef.current) {
      await delay(500);
      if (!cancelCheckRef.current) {
        setCheckingAll(false);
        addToast(t("downloads.checkUpdatesCompleted", { count }), "success");
      }
    }
  }

  return (
    <PageContainer title={t('downloads.title')} action={
      <div className="ui-action-row">
        <Button onClick={handleCheckAllUpdates} disabled={checkingAll}>
          {checkingAll ? t('downloads.checkingUpdates') : t('downloads.checkUpdates')}
        </Button>
        <Link to="/downloads/add" className={buttonClass('primary')}>{t('downloads.new')}</Link>
      </div>
    }>

      <div
        className="mb-4 grid grid-cols-3 border-b border-gray-100 dark:border-gray-800 sm:grid-cols-6"
        role="group"
        aria-label={t("downloads.title")}
      >
        {(
          [
            "all",
            "downloading",
            "pending",
            "paused",
            "completed",
            "failed",
          ] as StatusFilter[]
        ).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            aria-pressed={filter === status}
            className={`ui-filter ${filter === status ? 'ui-filter--active' : ''}`}
          >
            {t(`downloads.status.${status}`)}
            <span className="ml-1">
              {`(${
                status === "all"
                  ? tasks.length
                  : tasks.filter((task) => task.status === status).length
              })`}
            </span>
          </button>
        ))}
      </div>

      <p role="note" className="mb-5 text-sm leading-6 text-gray-500 dark:text-gray-400">{t('downloads.warning')}</p>

      {loading && tasks.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">
          {t("downloads.loading")}
        </div>
      ) : sortedTasks.length === 0 ? (
        <EmptyState title={filter === 'all' ? t('downloads.emptyAll') : t('downloads.emptyFilter', { status: t(`downloads.status.${filter}`) })} description={filter === 'all' ? t('downloads.emptyAllDesc') : t('downloads.emptyFilterDesc')} action={filter === 'all' ? <Link to="/search" className={buttonClass('primary')}>{t('downloads.searchApps')}</Link> : undefined} />
      ) : (
        <div className="ui-list">
          {sortedTasks.map((task) => (
            <DownloadItem
              key={task.id}
              task={task}
              onPause={handlePause}
              onResume={handleResume}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <Modal
        open={checkingAll && checkProgress.total > 0}
        onClose={handleCancelCheck}
        title={t("downloads.checkingUpdates")}
      >
        <div className="space-y-4">
          <div className="flex justify-center text-blue-600 dark:text-blue-400">
            <Spinner />
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {checkProgress.appName
                ? `${t("downloads.checkingApp")}${checkProgress.appName}`
                : "..."}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
              {checkProgress.current} / {checkProgress.total}
            </p>
          </div>
          <ProgressBar
            label={t("downloads.checkingUpdates")}
            progress={
              checkProgress.total > 0
                ? (checkProgress.current / checkProgress.total) * 100
                : 0
            }
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            {t("downloads.checkUpdatesDesc")}
          </p>
          <div className="flex justify-center">
            <Button
              onClick={handleCancelCheck}
              variant="secondary"
            >
              {t("settings.data.cancel")}
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
