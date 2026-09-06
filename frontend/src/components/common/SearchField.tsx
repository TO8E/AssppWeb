import Button from './Button';
import { Input } from './FormControl';
import { SearchIcon } from './icons';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  buttonLabel: string;
  busy?: boolean;
  disabled?: boolean;
}

/** Shared field/action layout for app search and Bundle ID lookup. */
export default function SearchField({ value, onChange, placeholder, buttonLabel, busy = false, disabled = false }: SearchFieldProps) {
  return (
    <div className="ui-search-field">
      <div className="relative min-w-0 flex-1">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <Input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} disabled={disabled} className="pl-10" />
      </div>
      <Button type="submit" variant="primary" disabled={disabled || busy || !value.trim()} aria-busy={busy} className="shrink-0">{buttonLabel}</Button>
    </div>
  );
}
