import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from '../Layout/PageContainer';
import { Select } from '../common/FormControl';
import SearchField from '../common/SearchField';
import EmptyState from '../common/EmptyState';
import AppIcon from '../common/AppIcon';
import CountrySelect from '../common/CountrySelect';
import { ChevronRightIcon } from '../common/icons';
import { useSearch } from '../../hooks/useSearch';
import { useAccounts } from '../../hooks/useAccounts';
import { useSettingsStore } from '../../store/settings';
import { useToastStore } from '../../store/toast';
import { firstAccountCountry } from '../../utils/account';
import { countryCodeMap, storeIdToCountry } from '../../apple/config';

export default function SearchPage() {
  const { t } = useTranslation();
  const { defaultCountry, defaultEntity } = useSettingsStore();
  const { accounts } = useAccounts();
  const initialCountry = firstAccountCountry(accounts) ?? defaultCountry;
  const addToast = useToastStore((s) => s.addToast);

  const {
    term,
    country,
    entity,
    results,
    loading,
    error,
    search,
    setSearchParam,
  } = useSearch();

  useEffect(() => {
    if (error) {
      addToast(error, "error");
    }
  }, [error, addToast]);

  useEffect(() => {
    if (!country && initialCountry) setSearchParam({ country: initialCountry });
    if (!entity && defaultEntity) setSearchParam({ entity: defaultEntity });
  }, [country, initialCountry, entity, defaultEntity, setSearchParam]);

  const activeCountry = country || initialCountry;
  const activeEntity = entity || defaultEntity;

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!term.trim()) return;
    search(term.trim(), activeCountry, activeEntity);
  }

  return (
    <PageContainer title={t("search.title")}>
      <form
        onSubmit={handleSubmit}
        className="mb-5 space-y-3 border-b border-gray-100 pb-4 dark:border-gray-800"
      >
        <SearchField value={term} onChange={(value) => setSearchParam({ term: value })} placeholder={t('search.placeholder')} buttonLabel={loading ? t('search.searching') : t('search.button')} busy={loading} />
        <div className="flex w-full gap-3 sm:max-w-md">
          <CountrySelect
            value={activeCountry}
            onChange={(c) => setSearchParam({ country: c })}
            availableCountryCodes={availableCountryCodes}
            allCountryCodes={allCountryCodes}
            className="w-1/2"
          />
          <Select
            value={activeEntity}
            onChange={(e) => setSearchParam({ entity: e.target.value })}
            aria-label={t("settings.defaults.entity")}
            className="w-1/2"
          >
            <option value="iPhone">iPhone</option>
            <option value="iPad">iPad</option>
          </Select>
        </div>
      </form>

      {results.length === 0 && !loading && !error && (
        <EmptyState title={t('search.empty')} description={t('search.emptyDesc')} />
      )}

      {results.length > 0 && (
        <div className="ui-list">
          <div className="ui-list-items">
            {results.map((app) => (
              <Link
                key={app.id}
                to={`/search/${app.id}`}
                state={{ app, country: activeCountry }}
                className="ui-list-row"
              >
                <AppIcon url={app.artworkUrl} name={app.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {app.name}
                  </p>
                  <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="min-w-0 truncate">{app.artistName}</span>
                    <span className="shrink-0">
                      {app.formattedPrice ?? t("search.free")}
                    </span>
                    <span className="shrink-0">v{app.version}</span>
                  </div>
                </div>
                <ChevronRightIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
