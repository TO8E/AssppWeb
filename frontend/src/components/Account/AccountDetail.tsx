import { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from '../Layout/PageContainer';
import ActionGroup from '../common/ActionGroup';
import Button from '../common/Button';
import { Input } from '../common/FormControl';
import Section, { InfoRow } from '../common/Section';
import Spinner from '../common/Spinner';
import SapStatus from '../common/SapStatus';
import { useAccountRoutes } from '../../hooks/useAccountRoutes';
import { usePrivacy } from '../../hooks/usePrivacy';
import { useAccounts } from '../../hooks/useAccounts';
import { useToastStore } from '../../store/toast';
import { authenticate, AuthenticationError } from '../../apple/authenticate';
import { getErrorMessage } from '../../utils/error';
import { storeIdToCountry } from '../../apple/config';

export default function AccountDetail() {
  const { email, accountId } = useParams<{ email: string; accountId: string }>();
  const { privacyMode } = usePrivacy();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    accounts,
    loading: storeLoading,
    loadAccounts,
    updateAccount,
    removeAccount,
  } = useAccounts();
  const addToast = useToastStore((s) => s.addToast);

  const [showDelete, setShowDelete] = useState(false);
  const [reauthing, setReauthing] = useState(false);
  const [reauthCode, setReauthCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const { ids, loading: routesLoading } = useAccountRoutes(accounts, privacyMode || Boolean(accountId));
  const account = accounts.find((a) => accountId ? ids[a.email] === accountId : a.email === email);

  if (storeLoading || routesLoading) {
    return (
      <PageContainer back={{ to: "/accounts", label: t('nav.backTo', { page: t('nav.accounts') }) }} title={t("accounts.title")}>
        <div className="text-center text-gray-500 py-12">{t("loading")}</div>
      </PageContainer>
    );
  }

  if (!account) {
    if (privacyMode && email) return <Navigate replace to="/accounts" />;
    return (
      <PageContainer back={{ to: "/accounts", label: t('nav.backTo', { page: t('nav.accounts') }) }} title={t("accounts.title")}>
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">{t("accounts.detail.notFound")}</p>

        </div>
      </PageContainer>
    );
  }

  if (privacyMode && email) {
    return <Navigate replace to={ids[account.email] ? `/accounts/id/${ids[account.email]}` : '/accounts'} />;
  }

  async function handleReauth() {
    if (!account) return;

    // An account imported as a token bundle carries no password. Signing in
    // needs one, and trying anyway would spend a minute or two preparing the
    // SAP signer before failing on an empty field.
    if (!account.password) {
      addToast(t("accounts.detail.noPassword"), "error");
      return;
    }

    setReauthing(true);

    try {
      const updated = await authenticate(
        account.email,
        account.password,
        needsCode && reauthCode ? reauthCode : undefined,
        account.cookies,
        account.deviceIdentifier,
      );
      await updateAccount(updated);
      setNeedsCode(false);
      setReauthCode("");
      addToast(t("accounts.detail.reauthSuccess"), "success");
    } catch (err) {
      if (err instanceof AuthenticationError && err.codeRequired) {
        setNeedsCode(true);
        addToast(err.message, "error");
      } else {
        addToast(
          getErrorMessage(err, t("accounts.detail.reauthFailed")),
          "error",
        );
      }
    } finally {
      setReauthing(false);
    }
  }

  async function handleDelete() {
    if (!account) return;
    await removeAccount(account.email);
    addToast(t("accounts.detail.deleteSuccess"), "success");
    navigate("/accounts");
  }

  const countryCode = storeIdToCountry(account.store);
  const displayRegion = countryCode
    ? `${t(`countries.${countryCode}`, countryCode)} (${account.store})`
    : account.store;

  return (
    <PageContainer back={{ to: "/accounts", label: t('nav.backTo', { page: t('nav.accounts') }) }} title={t("accounts.detail.title")}>
      <div className="max-w-2xl">
        <Section>
          <dl className="">
            <DetailRow
              label={t("accounts.detail.name")}
              value={`${account.firstName} ${account.lastName}`}
            />
            <DetailRow
              label={t("accounts.detail.email")}
              value={account.email}
            />
            <DetailRow
              label={t("accounts.detail.appleId")}
              value={account.appleId || account.email}
            />
            <DetailRow
              label={t("accounts.detail.storeRegion")}
              value={displayRegion}
            />
            <DetailRow
              label={t("accounts.detail.dsid")}
              value={account.directoryServicesIdentifier}
            />
            <DetailRow
              label={t("accounts.detail.deviceId")}
              value={account.deviceIdentifier}
            />
            {account.pod && (
              <DetailRow label={t("accounts.detail.pod")} value={account.pod} />
            )}
          </dl>
        </Section>

        {needsCode && (
          <Section>
            <label
              htmlFor="reauth-code"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t("accounts.detail.code")}
            </label>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <Input
                id="reauth-code"
                type={privacyMode ? "password" : "text"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={reauthCode}
                onChange={(e) => setReauthCode(e.target.value)}
                disabled={reauthing}
                placeholder="000000"
                className="w-full min-w-0 flex-1"
                autoFocus
              />
              <Button
                onClick={handleReauth}
                disabled={reauthing || !reauthCode}
                variant="primary" className="shrink-0"
              >
                {reauthing && <Spinner />}
                {t("accounts.detail.verify")}
              </Button>
            </div>
            <SapStatus />
          </Section>
        )}

        <div className="my-4 space-y-4">
          <ActionGroup>
            <Button
              onClick={handleReauth}
              disabled={reauthing || needsCode || showDelete}
              variant="primary"
            >
              {reauthing && <Spinner />}
              {t('accounts.detail.reauth')}
            </Button>
            <Button
              onClick={() => setShowDelete(true)}
              disabled={reauthing || showDelete}
              variant="danger"
            >
              {t('accounts.detail.delete')}
            </Button>
          </ActionGroup>
          {!needsCode && <SapStatus />}
          {showDelete && (
            <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{t('accounts.detail.areYouSure')}</p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setShowDelete(false)} variant="secondary">
                  {t('accounts.detail.cancel')}
                </Button>
                <Button onClick={handleDelete} variant="danger-solid">
                  {t('accounts.detail.confirmDelete')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { mask } = usePrivacy();
  return <InfoRow label={label}>{mask(value) || '--'}</InfoRow>;
}
