import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from '../../src/components/Welcome/HomePage';
import { useDownloadsStore } from '../../src/store/downloads';
import { useSettingsStore } from '../../src/store/settings';
import type { Account, DownloadTask } from '../../src/types';

const mocks = vi.hoisted(() => ({ accounts: [] as Account[], accountsLoading: false, search: vi.fn(), clear: vi.fn(), country: '', entity: '' }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../src/hooks/useAccounts', () => ({ useAccounts: () => ({ accounts: mocks.accounts, loading: mocks.accountsLoading }) }));
vi.mock('../../src/hooks/useSearch', () => ({ useSearch: (selector: (state: typeof mocks) => unknown) => selector(mocks) }));

const account = { email: 'private@example.test', store: '143465', passwordToken: 'private-token' } as Account;
function task(id: string, status: DownloadTask['status'], date: string): DownloadTask {
  return { id, status, createdAt: date, progress: 45, speed: '', accountHash: 'private-hash', software: {
    id: Number(id), name: `App ${id}`, bundleID: `test.app.${id}`, version: '1.0', artworkUrl: '',
  }, error: status === 'failed' ? 'private@example.test private-token' : undefined } as DownloadTask;
}
function renderHome() {
  return render(<MemoryRouter><Routes><Route path="/" element={<HomePage />} /><Route path="/search" element={<p>Search results</p>} /></Routes></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.accounts = [account];
  mocks.accountsLoading = false;
  mocks.country = '';
  mocks.entity = '';
  useDownloadsStore.setState({ tasks: [], loading: false });
  useSettingsStore.setState({ defaultCountry: 'US', defaultEntity: 'iPhone', privacyMode: false });
});
afterEach(cleanup);

describe('HomePage useful entry points', () => {
  it('submits a trimmed search in the account region and opens the results', async () => {
    renderHome();
    const searchButton = screen.getByRole('button', { name: 'search.button' });
    expect(searchButton).toBeDisabled();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  Via  ' } });
    fireEvent.click(searchButton);
    await screen.findByText('Search results');
    expect(mocks.search).toHaveBeenCalledOnce();
    expect(mocks.search).toHaveBeenCalledWith('Via', 'CN', 'iPhone');
  });

  it('honors an already selected storefront and device', async () => {
    mocks.country = 'JP';
    mocks.entity = 'iPad';
    renderHome();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Firefox' } });
    fireEvent.click(screen.getByRole('button', { name: 'search.button' }));
    await waitFor(() => expect(mocks.search).toHaveBeenCalledWith('Firefox', 'JP', 'iPad'));
  });

  it('puts active downloads first, limits the list and links to real task details', () => {
    const completed = Array.from({ length: 7 }, (_, i) => task(String(i + 1), 'completed', `2026-09-0${i + 1}`));
    const active = task('8', 'downloading', '2026-08-01');
    const all = [...completed, active];
    useDownloadsStore.setState({ tasks: all });
    renderHome();
    const links = screen.getAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/downloads/'));
    expect(links).toHaveLength(6);
    expect(links[0]).toHaveAttribute('href', '/downloads/8');
    expect(links[1]).toHaveAttribute('href', '/downloads/7');
    expect(links[0]).toHaveTextContent('45%');
    expect(useDownloadsStore.getState().tasks).toEqual(all);
  });

  it('offers adding an account without showing stale tasks from removed accounts', () => {
    mocks.accounts = [];
    useDownloadsStore.setState({ tasks: [task('1', 'completed', '2026-09-01')] });
    renderHome();
    expect(screen.getByRole('link', { name: 'home.actions.addAccount' })).toHaveAttribute('href', '/accounts/add');
    expect(screen.queryByText('App 1')).not.toBeInTheDocument();
    expect(screen.getByText('home.noDownloads')).toBeInTheDocument();
  });

  it('keeps raw account and error data out of the activity list', () => {
    useSettingsStore.setState({ privacyMode: true });
    useDownloadsStore.setState({ tasks: [task('1', 'failed', '2026-09-01')] });
    const view = renderHome();
    expect(view.container.innerHTML).not.toMatch(/private@example.test|private-token|private-hash/);
    expect(screen.getByText('downloads.status.failed')).toBeInTheDocument();
  });
});
