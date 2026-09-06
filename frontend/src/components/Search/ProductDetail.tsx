import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from '../Layout/PageContainer';
import ActionGroup from '../common/ActionGroup';
import Button, { buttonClass } from '../common/Button';
import Section, { InfoRow } from '../common/Section';
import SoftwareHeader from '../common/SoftwareHeader';
import AccountSelect from '../common/AccountSelect';
import Spinner from '../common/Spinner';
import SapStatus from '../common/SapStatus';
import { useAccounts } from '../../hooks/useAccounts';
import { useDownloadAction } from '../../hooks/useDownloadAction';
import { lookupApp } from '../../api/search';
import { storeIdToCountry } from '../../apple/config';
import type { Software } from '../../types';

export default function ProductDetail() {
  const { appId } = useParams<{ appId: string }>();
  const location = useLocation();
  const { accounts } = useAccounts();
  const { t } = useTranslation();
  const {
    startDownload,
    acquireLicense,
    toastDownloadError,
    toastLicenseError,
  } = useDownloadAction();

  const routeState = location.state as {
    app?: Software;
    country?: string;
  } | null;
  const stateApp = routeState?.app;
  const stateCountry = routeState?.country;
  const [country] = useState(stateCountry ?? "US");
  const [app, setApp] = useState<Software | null>(stateApp ?? null);
  const [loading, setLoading] = useState(!stateApp);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [loadingAction, setLoadingAction] = useState<
    "purchase" | "download" | null
  >(null);

  const filteredAccounts = useMemo(
    () =>
      accounts.filter((a) => storeIdToCountry(a.store) === country),
    [accounts, country],
  );

  const account = filteredAccounts.find((a) => a.email === selectedAccount);
  const isDownloading = loadingAction === 'download';

  useEffect(() => {
    if (!stateApp && appId) {
      setLoading(true);
      lookupApp(appId, country)
        .then((result) => {
          setApp(result);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [appId, stateApp, country]);

  useEffect(() => {
    if (
      filteredAccounts.length > 0 &&
      !filteredAccounts.some((a) => a.email === selectedAccount)
    ) {
      setSelectedAccount(filteredAccounts[0].email);
    }
  }, [filteredAccounts, selectedAccount]);

  if (loading) {
    return (
      <PageContainer back={{ to: "/search", label: t('nav.backTo', { page: t('nav.search') }) }} title={t("search.product.title")}>
        <div className="text-center text-gray-500 py-12">{t("loading")}</div>
      </PageContainer>
    );
  }

  if (!app) {
    return (
      <PageContainer back={{ to: "/search", label: t('nav.backTo', { page: t('nav.search') }) }} title={t("search.product.title")}>
        <p className="text-gray-500">{t("search.product.notFound")}</p>
      </PageContainer>
    );
  }

  async function handlePurchase() {
    if (!account || !app) return;
    setLoadingAction("purchase");
    try {
      await acquireLicense(account, app);
    } catch (e) {
      toastLicenseError(account, app, e);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleDownload() {
    if (!account || !app) return;
    setLoadingAction("download");
    try {
      await startDownload(account, app);
    } catch (e) {
      toastDownloadError(account, app, e);
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <PageContainer title={t("search.product.title")} back={{ to: "/search", label: t('nav.backTo', { page: t('nav.search') }) }}>
      <div className="min-w-0 [overflow-wrap:anywhere]">

        <Section>
          <SoftwareHeader app={app}>
            <span>{app.formattedPrice ?? t('search.product.free')}</span>
            <span>{app.primaryGenreName}</span>
            <span>v{app.version}</span>
            <span>★ {app.averageUserRating.toFixed(1)} ({app.userRatingCount} {t('search.product.ratings')})</span>
          </SoftwareHeader>
        </Section>

        {accounts.length === 0 ? (
          <div className="rounded-2xl bg-yellow-50 p-4 text-sm text-yellow-800 ring-1 ring-yellow-200/70 dark:bg-yellow-950/30 dark:text-yellow-300 dark:ring-yellow-800/50">
            <Link to="/accounts/add" className="font-medium underline">
              {t("search.product.addAccountLink")}
            </Link>{" "}
            {t("search.product.addAccountPrompt")}
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="rounded-2xl bg-yellow-50 p-4 text-sm text-yellow-800 ring-1 ring-yellow-200/70 dark:bg-yellow-950/30 dark:text-yellow-300 dark:ring-yellow-800/50">
            {t("search.product.noAccountsForRegion")}
          </div>
        ) : (
          <Section className="space-y-4">
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("search.product.account")}
              </label>
              <AccountSelect
                accounts={filteredAccounts}
                value={selectedAccount}
                onChange={setSelectedAccount}
                className="min-w-0"
                disabled={loadingAction !== null}
              />
            </div>
            <ActionGroup>
              {(app.price === undefined || app.price === 0) && (
                <Button
                  type="button"
                  onClick={handlePurchase}
                  disabled={loadingAction !== null}
                  variant="secondary" className="min-w-0"
                >
                  {loadingAction === "purchase"
                    ? t("search.product.processing")
                    : t("search.product.getLicense")}
                </Button>
              )}
              <Button
                type="button"
                onClick={handleDownload}
                disabled={loadingAction !== null || !account}
                aria-busy={isDownloading}
                variant="primary" className="min-w-0"
              >
                <span
                  aria-hidden="true"
                  className="flex h-4 w-4 shrink-0 items-center justify-center"
                >
                  {isDownloading ? <Spinner /> : <DownloadIcon />}
                </span>
                <span>{t("search.product.download")}</span>
              </Button>
              <Link
                to={`/search/${app.id}/versions`}
                state={{ app, country }}
                className={buttonClass('secondary', 'min-w-0')}
              >
                {t("search.product.versionHistory")}
              </Link>
            </ActionGroup>
            <SapStatus />
          </Section>
        )}

        <Section>
          <h2 className="ui-section-title">
            {t("search.product.details")}
          </h2>
          <dl className="min-w-0">
            <InfoRow label={t("search.product.bundleId")}>{app.bundleID}</InfoRow>
            <InfoRow label={t("search.product.version")}>{app.version}</InfoRow>
            <InfoRow label={t("search.product.size")}>{app.fileSizeBytes
                ? `${(parseInt(app.fileSizeBytes) / 1024 / 1024).toFixed(1)} MB`
                : "N/A"}</InfoRow>
            <InfoRow label={t("search.product.minOs")}>{app.minimumOsVersion}</InfoRow>
            <InfoRow label={t("search.product.seller")}>{app.sellerName}</InfoRow>
            <InfoRow label={t("search.product.released")}>{new Date(app.releaseDate).toLocaleDateString()}</InfoRow>
          </dl>
        </Section>

        {app.description && (
          <Section>
            <h2 className="ui-section-title">
              {t("search.product.description")}
            </h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
              {app.description}
            </p>
          </Section>
        )}

        {app.releaseNotes && (
          <Section>
            <h2 className="ui-section-title">
              {t("search.product.releaseNotes")}
            </h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
              {app.releaseNotes}
            </p>
          </Section>
        )}

        {app.screenshotUrls && app.screenshotUrls.length > 0 && (
          <Section>
            <h2 className="ui-section-title">
              {t("search.product.screenshots")}
            </h2>
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {app.screenshotUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Screenshot ${i + 1}`}
                  className="h-64 shrink-0 snap-start snap-always rounded-3xl object-contain sm:h-80"
                  loading="lazy"
                />
              ))}
            </div>
          </Section>
        )}
      </div>
    </PageContainer>
  );
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14"
      />
    </svg>
  );
}
