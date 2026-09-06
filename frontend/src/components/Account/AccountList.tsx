import { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from '../Layout/PageContainer';
import { buttonClass } from '../common/Button';
import EmptyState from '../common/EmptyState';
import { AccountsIcon, ChevronRightIcon } from '../common/icons';
import { useAccountRoutes } from '../../hooks/useAccountRoutes';
import { usePrivacy } from '../../hooks/usePrivacy';
import { useAccountsStore } from '../../store/accounts';
import { storeIdToCountry } from '../../apple/config';

export default function AccountList() {
  const { t } = useTranslation();
  const { accounts, loading, loadAccounts } = useAccountsStore();
  const { privacyMode, hidden, accountLabel } = usePrivacy();
  const { ids } = useAccountRoutes(accounts, privacyMode);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  return (
    <PageContainer
      title={t("accounts.title")}
      action={
        <Link
          to="/accounts/add"
          className={buttonClass('primary', '')}
        >
          {t("accounts.add")}
        </Link>
      }
    >
      {loading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">
          {t("accounts.loading")}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState title={t('accounts.empty')} description={t('accounts.emptyDesc')} action={<Link to="/accounts/add" className={buttonClass('primary')}>{t('accounts.add')}</Link>} />
      ) : (
        <div className="ui-list">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {accounts.map((account) => {
              const countryCode =
                storeIdToCountry(account.store) || account.store;
              const countryName = t(`countries.${countryCode}`, countryCode);

              return (
                <NavLink
                  key={account.email}
                  to={privacyMode ? (ids[account.email] ? `/accounts/id/${ids[account.email]}` : "/accounts") : `/accounts/${encodeURIComponent(account.email)}`}
                  aria-disabled={privacyMode && !ids[account.email]}
                  onClick={(event) => { if (privacyMode && !ids[account.email]) event.preventDefault(); }}
                  className="ui-list-row"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-base font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                    {privacyMode ? <AccountsIcon className="h-5 w-5" /> : (account.firstName || account.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900 dark:text-white">
                      {privacyMode ? accountLabel(account) : `${account.firstName} ${account.lastName}`}
                    </p>
                    <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                      {privacyMode ? hidden : account.email}
                    </p>
                  </div>
                  <div
                    title={privacyMode ? undefined : countryName}
                    className="max-w-24 shrink-0 truncate rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400 sm:px-3"
                  >
                    <span className="sm:hidden">{privacyMode ? hidden : countryCode}</span>
                    <span className="hidden truncate sm:block">
                      {privacyMode ? hidden : countryName}
                    </span>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                </NavLink>
              );
            })}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
