import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import PageContainer from '../Layout/PageContainer';
import ActionGroup from '../common/ActionGroup';
import Button from '../common/Button';
import { Input, Select } from '../common/FormControl';
import Section, { InfoRow } from '../common/Section';
import Switch from '../common/Switch';
import Modal from '../common/Modal';
import { useSettingsStore } from '../../store/settings';
import { useAccountsStore } from '../../store/accounts';
import { useToastStore } from '../../store/toast';
import { apiGet } from '../../api/client';
import { encryptData, decryptData } from '../../utils/crypto';
import { countryCodeMap } from '../../apple/config';
import type { Account } from '../../types';

interface ServerInfo {
  uptime?: number;
  buildCommit?: string;
  buildDate?: string;
  port?: number;
  dataDir?: string;
  publicBaseUrl?: string;
  disableHttpsRedirect?: boolean;
  autoCleanupDays?: number;
  autoCleanupMaxMB?: number;
  maxDownloadMB?: number;
  downloadThreads?: number;
}

const entityTypes = [
  { value: "software", label: "iPhone" },
  { value: "iPadSoftware", label: "iPad" },
];

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const privacyMode = useSettingsStore((state) => state.privacyMode);
  const setPrivacyMode = useSettingsStore((state) => state.setPrivacyMode);
  const autoFetchVersionNumbers = useSettingsStore((state) => state.autoFetchVersionNumbers);
  const setAutoFetchVersionNumbers = useSettingsStore((state) => state.setAutoFetchVersionNumbers);
  const { accounts, addAccount, updateAccount } = useAccountsStore();
  const addToast = useToastStore((s) => s.addToast);

  const [country, setCountry] = useState(
    () => localStorage.getItem("asspp-default-country") || "US",
  );
  const [entity, setEntity] = useState(
    () => localStorage.getItem("asspp-default-entity") || "software",
  );
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [exportConfirmPassword, setExportConfirmPassword] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPassword, setImportPassword] = useState("");
  const [importFileData, setImportFileData] = useState("");

  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [pendingAccounts, setPendingAccounts] = useState<Account[]>([]);
  const [conflictStats, setConflictStats] = useState({ conflict: 0, new: 0 });

  useEffect(() => {
    localStorage.setItem("asspp-default-country", country);
  }, [country]);

  useEffect(() => {
    localStorage.setItem("asspp-default-entity", entity);
  }, [entity]);

  useEffect(() => {
    apiGet<ServerInfo>("/api/settings")
      .then(setServerInfo)
      .catch(() => setServerInfo(null));
  }, []);

  const sortedCountries = Object.keys(countryCodeMap).sort((a, b) =>
    t(`countries.${a}`, a).localeCompare(t(`countries.${b}`, b)),
  );

  const handleExport = async () => {
    if (exportPassword !== exportConfirmPassword) {
      addToast(t("settings.data.passwordMismatch"), "error");
      return;
    }
    try {
      const encrypted = await encryptData(accounts, exportPassword);
      const blob = new Blob([encrypted], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "asspp-accounts.enc";
      a.click();
      URL.revokeObjectURL(url);

      setExportModalOpen(false);
      setExportPassword("");
      setExportConfirmPassword("");
      addToast(t("settings.data.exportSuccess"), "success");
    } catch {
      addToast(t("settings.data.exportFailed"), "error");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportFileData(content);
      setImportModalOpen(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImport = async () => {
    try {
      const parsed = await decryptData(importFileData, importPassword);
      if (!Array.isArray(parsed)) throw new Error("Invalid format");
      const valid = parsed.filter(
        (item: any) =>
          item &&
          typeof item === "object" &&
          typeof item.email === "string" &&
          item.email.length > 0,
      ) as Account[];
      if (valid.length === 0) throw new Error("No valid accounts found");

      if (accounts.length === 0) {
        for (const acc of valid) {
          await addAccount(acc);
        }
        addToast(t("settings.data.importSuccess"), "success");
        setImportModalOpen(false);
        setImportPassword("");
      } else {
        let conflictCount = 0;
        let newCount = 0;
        valid.forEach((imported) => {
          if (accounts.some((a) => a.email === imported.email)) conflictCount++;
          else newCount++;
        });

        if (conflictCount > 0) {
          setConflictStats({ conflict: conflictCount, new: newCount });
          setPendingAccounts(valid);
          setImportModalOpen(false);
          setImportPassword("");
          setConflictModalOpen(true);
        } else {
          for (const acc of valid) {
            await addAccount(acc);
          }
          addToast(t("settings.data.importSuccess"), "success");
          setImportModalOpen(false);
          setImportPassword("");
        }
      }
    } catch {
      addToast(t("settings.data.incorrectPassword"), "error");
    }
  };

  const handleResolveConflict = async (overwrite: boolean) => {
    for (const imported of pendingAccounts) {
      const exists = accounts.some((a) => a.email === imported.email);
      if (exists) {
        if (overwrite) await updateAccount(imported);
      } else {
        await addAccount(imported);
      }
    }
    setConflictModalOpen(false);
    setPendingAccounts([]);
    addToast(t("settings.data.importSuccess"), "success");
  };

  return (
    <PageContainer title={t("settings.title")}>
      <div className="min-w-0 max-w-3xl">
        <Section className="min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 id="privacy-mode-label" className="ui-section-title">
                {t('privacy.title')}
              </h2>
              <p id="privacy-mode-description" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('privacy.description')}
              </p>
            </div>
            <Switch checked={privacyMode} onChange={setPrivacyMode} labelledBy="privacy-mode-label" describedBy="privacy-mode-description" />
          </div>
        </Section>

        <Section className="min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 id="auto-version-numbers-label" className="ui-section-title">
                {t('settings.versionNumbers.title')}
              </h2>
              <p id="auto-version-numbers-description" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('settings.versionNumbers.description')}
              </p>
            </div>
            <Switch checked={autoFetchVersionNumbers} onChange={setAutoFetchVersionNumbers} labelledBy="auto-version-numbers-label" describedBy="auto-version-numbers-description" />
          </div>
        </Section>

        <Section className="min-w-0">
          <h2 className="sr-only">
            {t("settings.language.title")}
          </h2>
          <div className="space-y-4">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[1fr_16rem]">
              <label
                htmlFor="language"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t("settings.language.label")}
              </label>
              <Select
                id="language"
                value={i18n.resolvedLanguage || "en-US"}
                onChange={async (e) => {
                  const newLang = e.target.value;
                  await i18n.changeLanguage(newLang);
                  addToast(t("settings.language.changed"), "success");
                }}
                className="min-w-0 max-w-full w-full"
              >
                <option value="en-US">English (US)</option>
                <option value="zh-CN">简体中文</option>
                <option value="zh-TW">繁體中文</option>
                <option value="ja">日本語</option>
                <option value="ko">한국어</option>
                <option value="ru">Русский</option>
              </Select>
            </div>
          </div>
        </Section>

        <Section className="min-w-0">
          <h2 className="ui-section-title">
            {t("settings.defaults.title")}
          </h2>
          <div className="space-y-4">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[1fr_16rem]">
              <label
                htmlFor="country"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t("settings.defaults.country")}
              </label>
              <Select
                id="country"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  addToast(t("settings.defaults.countryChanged"), "success");
                }}
                className="min-w-0 max-w-full w-full"
              >
                {sortedCountries.map((code) => (
                  <option key={code} value={code}>
                    {t(`countries.${code}`, code)} ({code})
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[1fr_16rem]">
              <label
                htmlFor="entity"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t("settings.defaults.entity")}
              </label>
              <Select
                id="entity"
                value={entity}
                onChange={(e) => {
                  setEntity(e.target.value);
                  addToast(t("settings.defaults.entityChanged"), "success");
                }}
                className="min-w-0 max-w-full w-full"
              >
                {entityTypes.map((et) => (
                  <option key={et.value} value={et.value}>
                    {et.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Section>

        <Section className="min-w-0">
          <h2 className="ui-section-title">
            {t("settings.server.title")}
          </h2>
          {privacyMode ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('privacy.hidden')}</p>
          ) : serverInfo ? (
            <div className="min-w-0 space-y-6">
              <dl className="min-w-0 ">
                {serverInfo.uptime != null && (
                  <SettingsInfoRow label={t("settings.server.uptime")}>
                    {formatUptime(serverInfo.uptime)}
                  </SettingsInfoRow>
                )}
              </dl>

              <div className="min-w-0">
                <h3 className="ui-section-title">
                  {t("settings.server.configuration")}
                </h3>
                <dl className="min-w-0 border-y border-gray-100 dark:border-gray-800">
                  <SettingsInfoRow label="PORT" mono>
                    {serverInfo.port}
                  </SettingsInfoRow>
                  <SettingsInfoRow
                    label="DATA_DIR"
                    mono
                    valueTitle={serverInfo.dataDir}
                  >
                    {serverInfo.dataDir}
                  </SettingsInfoRow>
                  <SettingsInfoRow
                    label="PUBLIC_BASE_URL"
                    mono
                    valueTitle={serverInfo.publicBaseUrl || undefined}
                  >
                    {serverInfo.publicBaseUrl || (
                      <span className="italic text-gray-400 dark:text-gray-500">
                        {t("settings.server.notSet")}
                      </span>
                    )}
                  </SettingsInfoRow>
                  <SettingsInfoRow
                    label="UNSAFE_DANGEROUSLY_DISABLE_HTTPS_REDIRECT"
                    mono
                  >
                    {serverInfo.disableHttpsRedirect
                      ? t("settings.server.enabled")
                      : t("settings.server.disabled")}
                  </SettingsInfoRow>
                  <SettingsInfoRow label="AUTO_CLEANUP_DAYS" mono>
                    {serverInfo.autoCleanupDays ||
                      t("settings.server.disabled")}
                  </SettingsInfoRow>
                  <SettingsInfoRow label="AUTO_CLEANUP_MAX_MB" mono>
                    {serverInfo.autoCleanupMaxMB ||
                      t("settings.server.disabled")}
                  </SettingsInfoRow>
                  <SettingsInfoRow label="MAX_DOWNLOAD_MB" mono>
                    {serverInfo.maxDownloadMB ||
                      t("settings.server.disabled")}
                  </SettingsInfoRow>
                  <SettingsInfoRow label="DOWNLOAD_THREADS" mono>
                    {serverInfo.downloadThreads ?? 8}
                  </SettingsInfoRow>
                </dl>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("settings.server.offline")}
            </p>
          )}
        </Section>

        <Section className="min-w-0">
          <h2 className="ui-section-title">
            {t("settings.data.title")}
          </h2>
          <p className="mb-4 max-w-full text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {t("settings.data.description")}
          </p>

          <ActionGroup>
            <Button
              onClick={() => setExportModalOpen(true)}
              variant="secondary" className="min-w-0"
            >
              {t("settings.data.exportBtn")}
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="secondary" className="min-w-0"
            >
              {t("settings.data.importBtn")}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".enc"
              onChange={handleFileSelect}
            />

          <Button
            onClick={() => {
              if (!confirm(t("settings.data.confirm"))) return;
              localStorage.clear();
              indexedDB.deleteDatabase("asspp-accounts");
              addToast(t("settings.data.cleared"), "success");
              setTimeout(() => {
                window.location.href = "/";
              }, 1000);
            }}
            variant="danger" className="min-w-0"
          >
            {t("settings.data.button")}
          </Button>
          </ActionGroup>
        </Section>

        <Section className="min-w-0">
          <h2 className="ui-section-title">
            {t("settings.about.title")}
          </h2>
          <p className="max-w-full text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {t("settings.about.description")}
          </p>
          {serverInfo && (
            <dl className="mt-3 min-w-0 ">
              {serverInfo.buildCommit &&
                serverInfo.buildCommit !== "unknown" && (
                  <SettingsInfoRow
                    label={t("settings.about.buildCommit")}
                    mono
                    compact
                    valueTitle={serverInfo.buildCommit}
                  >
                    {serverInfo.buildCommit}
                  </SettingsInfoRow>
                )}
              {serverInfo.buildDate && serverInfo.buildDate !== "unknown" && (
                <SettingsInfoRow
                  label={t("settings.about.buildDate")}
                  compact
                  valueTitle={serverInfo.buildDate}
                >
                    {new Date(serverInfo.buildDate).toLocaleString()}
                </SettingsInfoRow>
              )}
            </dl>
          )}
        </Section>
      </div>

      <Modal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title={t("settings.data.exportBtn")}
      >
        <div className="min-w-0 space-y-4">
          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("settings.data.passwordPrompt")}
            </label>
            <Input
              type="password"
              value={exportPassword}
              onChange={(e) => setExportPassword(e.target.value)}
              className="min-w-0 max-w-full w-full"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("settings.data.passwordConfirm")}
            </label>
            <Input
              type="password"
              value={exportConfirmPassword}
              onChange={(e) => setExportConfirmPassword(e.target.value)}
              className="min-w-0 max-w-full w-full"
            />
          </div>
        </div>
        <div className="ui-action-row my-4">
          <Button
            onClick={() => setExportModalOpen(false)}
            variant="secondary" className="min-w-0 sm:w-auto"
          >
            {t("settings.data.cancel")}
          </Button>
          <Button
            onClick={handleExport}
            disabled={!exportPassword || !exportConfirmPassword}
            variant="primary" className="min-w-0 sm:w-auto"
          >
            {t("settings.data.confirmBtn")}
          </Button>
        </div>
      </Modal>

      <Modal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title={t("settings.data.importBtn")}
      >
        <div className="min-w-0 space-y-4">
          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("settings.data.passwordPrompt")}
            </label>
            <Input
              type="password"
              value={importPassword}
              onChange={(e) => setImportPassword(e.target.value)}
              className="min-w-0 max-w-full w-full"
            />
          </div>
        </div>
        <div className="ui-action-row my-4">
          <Button
            onClick={() => setImportModalOpen(false)}
            variant="secondary" className="min-w-0 sm:w-auto"
          >
            {t("settings.data.cancel")}
          </Button>
          <Button
            onClick={handleImport}
            disabled={!importPassword}
            variant="primary" className="min-w-0 sm:w-auto"
          >
            {t("settings.data.confirmBtn")}
          </Button>
        </div>
      </Modal>

      <Modal
        open={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        title={t("settings.data.conflictTitle")}
      >
        <p className="mb-6 min-w-0 break-words text-sm leading-6 text-gray-700 dark:text-gray-300">
          {t("settings.data.conflictDesc", {
            conflict: conflictStats.conflict,
            new: conflictStats.new,
          })}
        </p>
        <div className="flex min-w-0 flex-col gap-3">
          <Button
            onClick={() => handleResolveConflict(true)}
            variant="danger-solid" className="w-full min-w-0"
          >
            {t("settings.data.conflictOverwrite")}
          </Button>
          <Button
            onClick={() => handleResolveConflict(false)}
            variant="secondary" className="w-full min-w-0"
          >
            {t("settings.data.conflictSkip")}
          </Button>
          <Button
            onClick={() => setConflictModalOpen(false)}
            variant="secondary" className="mt-2 w-full min-w-0"
          >
            {t("settings.data.cancel")}
          </Button>
        </div>
      </Modal>
    </PageContainer>
  );
}

function SettingsInfoRow({
  label,
  children,
  mono = false,
  compact = false,
  valueTitle,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
  compact?: boolean;
  valueTitle?: string;
}) {
  return <InfoRow label={label} mono={mono} title={valueTitle}>{children}</InfoRow>;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}
