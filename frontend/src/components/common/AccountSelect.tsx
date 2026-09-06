import { useTranslation } from 'react-i18next';
import { usePrivacy } from '../../hooks/usePrivacy';
import type { Account } from '../../types';

export default function AccountSelect({ accounts, value, onChange, disabled, className, emptyLabel }: {
  accounts: Account[];
  value: string;
  onChange: (email: string) => void;
  disabled?: boolean;
  className?: string;
  emptyLabel?: string;
}) {
  const { t } = useTranslation();
  const { privacyMode, accountLabel } = usePrivacy();
  const index = accounts.findIndex((account) => account.email === value);
  return (
    <select
      aria-label={t('search.product.account')}
      value={privacyMode ? String(index) : value}
      onChange={(event) => {
        const account = privacyMode
          ? accounts[Number(event.target.value)]
          : accounts.find((item) => item.email === event.target.value);
        if (account) onChange(account.email);
      }}
      disabled={disabled}
      className={className}
    >
      {accounts.length === 0 && <option value="">{emptyLabel ?? t('accounts.empty')}</option>}
      {accounts.map((account, optionIndex) => (
        <option key={account.email} value={privacyMode ? String(optionIndex) : account.email}>
          {accountLabel(account, optionIndex)}
        </option>
      ))}
    </select>
  );
}
