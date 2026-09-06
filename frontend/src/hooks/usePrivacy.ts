import { useTranslation } from 'react-i18next';
import { useAccountsStore } from '../store/accounts';
import { useSettingsStore } from '../store/settings';
import type { Account } from '../types';

export function usePrivacy() {
  const { t } = useTranslation();
  const privacyMode = useSettingsStore((state) => state.privacyMode);
  const accounts = useAccountsStore((state) => state.accounts);
  const hidden = t('privacy.hidden');

  function accountLabel(account: Account, fallbackIndex = 0): string {
    if (!privacyMode) {
      return `${account.firstName} ${account.lastName} (${account.email})`;
    }
    const index = accounts.map((item) => item.email).sort().indexOf(account.email);
    return t('privacy.account', { number: (index < 0 ? fallbackIndex : index) + 1 });
  }

  return {
    privacyMode,
    hidden,
    accountLabel,
    mask: (value: string | undefined) => privacyMode ? hidden : value,
  };
}
