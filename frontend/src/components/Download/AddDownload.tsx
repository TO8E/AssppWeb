import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageContainer from '../Layout/PageContainer';
import ActionGroup from '../common/ActionGroup';
import Button from '../common/Button';
import { Select } from '../common/FormControl';
import SearchField from '../common/SearchField';
import EmptyState from '../common/EmptyState';
import AccountSelect from '../common/AccountSelect';
import SoftwareHeader from '../common/SoftwareHeader';
import CountrySelect from '../common/CountrySelect';
import { useAccounts } from '../../hooks/useAccounts';
import { useDownloadAction } from '../../hooks/useDownloadAction';
import { useSettingsStore } from '../../store/settings';
import { useToastStore } from '../../store/toast';
import { lookupApp } from '../../api/search';
import { listVersions } from '../../apple/versionFinder';
import { firstAccountCountry } from '../../utils/account';
import { getErrorMessage } from '../../utils/error';
import { countryCodeMap, storeIdToCountry } from '../../apple/config';
import type { Software } from '../../types';

export default function AddDownload() {
  const { accounts, updateAccount } = useAccounts();
  const { defaultCountry } = useSettingsStore();
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const {
    startDownload,
    acquireLicense,
    toastDownloadError,
    toastLicenseError,
  } = useDownloadAction();

  const [bundleId, setBundleId] = useState("");
  const [country, setCountry] = useState(defaultCountry);
  const [countryTouched, setCountryTouched] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [app, setApp] = useState<Software | null>(null);
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [step, setStep] = useState<"lookup" | "ready" | "versions">("lookup");
  const [loadingAction, setLoadingAction] = useState<
    "lookup" | "license" | "versions" | "download" | null
  >(null);

  const isLoading = loadingAction !== null;

  const availableCountryCodes = Array.from(
    new Set(
      accounts
        .map((a) => storeIdToCountry(a.store))
        .filter(Boolean) as string[],
    ),
  ).sort((a, b) =>
    t(`countries.${a}`, a).localeCompare(t(`countries.${b}`, b)),
  );

  const allCountryCodes = Object.keys(countryCodeMap).sort((a, b) =>
    t(`countries.${a}`, a).localeCompare(t(`countries.${b}`, b)),
  );

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => storeIdToCountry(a.store) === country);
  }, [accounts, country]);

  useEffect(() => {
    if (filteredAccounts.length > 0) {
      if (
        !selectedAccount ||
        !filteredAccounts.find((a) => a.email === selectedAccount)
      ) {
        setSelectedAccount(filteredAccounts[0].email);
      }
    } else if (selectedAccount !== "") {
      setSelectedAccount("");
    }
  }, [filteredAccounts, selectedAccount]);

  const account = accounts.find((a) => a.email === selectedAccount);
  const autoCountry = firstAccountCountry(accounts);

  useEffect(() => {
    if (countryTouched) return;
    const nextCountry = autoCountry ?? defaultCountry;
    if (nextCountry && nextCountry !== country) {
      setCountry(nextCountry);
    }
  }, [autoCountry, country, countryTouched, defaultCountry]);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!bundleId.trim()) return;
    setLoadingAction("lookup");
    try {
      const result = await lookupApp(bundleId.trim(), country);
      if (!result) {
        addToast(t("downloads.add.notFound"), "error");
        return;
      }
      setApp(result);
      setStep("ready");
    } catch (e) {
      addToast(getErrorMessage(e, t("downloads.add.lookupFailed")), "error");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleGetLicense() {
    if (!account || !app) return;
    setLoadingAction("license");
    try {
      await acquireLicense(account, app);
    } catch (e) {
      toastLicenseError(account, app, e);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleLoadVersions() {
    if (!account || !app) return;
    setLoadingAction("versions");
    try {
      const result = await listVersions(account, app);
      setVersions(result.versions);
      await updateAccount({ ...account, cookies: result.updatedCookies });
      setStep("versions");
    } catch (e) {
      addToast(getErrorMessage(e, t("downloads.add.versionsFailed")), "error");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleDownload() {
    if (!account || !app) return;
    setLoadingAction("download");
    try {
      await startDownload(account, app, selectedVersion || undefined);
    } catch (e) {
      toastDownloadError(account, app, e);
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <PageContainer back={{ to: "/downloads", label: t('nav.backTo', { page: t('nav.downloads') }) }} title={t("downloads.add.title")}>
      <div className="min-w-0 space-y-6">
        <form
          onSubmit={handleLookup}
          className="min-w-0 space-y-4 border-b border-gray-100 pb-6 dark:border-gray-800"
        >
          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("downloads.add.bundleId")}
            </label>
            <SearchField value={bundleId} onChange={setBundleId} placeholder={t('downloads.add.placeholder')} buttonLabel={loadingAction === 'lookup' ? t('downloads.add.lookingUp') : t('downloads.add.lookup')} busy={isLoading} disabled={isLoading} />
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <CountrySelect
              value={country}
              onChange={(v) => {
                setCountry(v);
                setCountryTouched(true);
              }}
              availableCountryCodes={availableCountryCodes}
              allCountryCodes={allCountryCodes}
              disabled={isLoading}
              className="w-full min-w-0 max-w-full"
            />
            <AccountSelect
              accounts={filteredAccounts}
              value={selectedAccount}
              onChange={setSelectedAccount}
              emptyLabel={t('downloads.add.noAccountsForRegion')}
              className="w-full min-w-0 max-w-full"
              disabled={isLoading || filteredAccounts.length === 0}
            />
          </div>
        </form>

        {!app && !isLoading && (
          <EmptyState title={t('downloads.add.emptyTitle')} description={t('downloads.add.emptyDesc')} />
        )}

        {app && (
          <div className="min-w-0 pb-6">
            <div className="mb-4"><SoftwareHeader app={app}><span>v{app.version}</span><span>{app.formattedPrice ?? t('search.product.free')}</span></SoftwareHeader></div>

            {step === "versions" && versions.length > 0 && (
              <div className="mb-4 min-w-0">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("downloads.add.versionOptional")}
                </label>
                <Select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  className="w-full min-w-0 max-w-full"
                >
                  <option value="">{t("downloads.add.latest")}</option>
                  {versions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <ActionGroup>
              {(app.price === undefined || app.price === 0) && (
                <Button
                  onClick={handleGetLicense}
                  disabled={isLoading || !account}
                  variant="secondary" className="min-w-0 sm:w-auto"
                >
                  {loadingAction === "license"
                    ? t("downloads.add.processing")
                    : t("downloads.add.getLicense")}
                </Button>
              )}

              <Button
                onClick={handleDownload}
                disabled={isLoading || !account}
                variant="primary" className="min-w-0 sm:w-auto"
              >
                {loadingAction === "download"
                  ? t("downloads.add.processing")
                  : t("downloads.add.download")}
              </Button>
              {step !== "versions" && (
                <Button
                  onClick={handleLoadVersions}
                  disabled={isLoading || !account}
                  variant="secondary" className="min-w-0 sm:w-auto"
                >
                  {loadingAction === "versions"
                    ? t("downloads.add.processing")
                    : t("downloads.add.selectVersion")}
                </Button>
              )}
            </ActionGroup>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
