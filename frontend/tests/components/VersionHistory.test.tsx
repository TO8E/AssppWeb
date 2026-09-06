import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VersionHistory from '../../src/components/Search/VersionHistory';
import { listVersions } from '../../src/apple/versionFinder';
import { getVersionMetadata } from '../../src/apple/versionLookup';
import { useAccountsStore } from '../../src/store/accounts';
import { useSettingsStore } from '../../src/store/settings';
import type { Account, Software } from '../../src/types';

const mocks = vi.hoisted(() => ({ startDownload: vi.fn(), toastDownloadError: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../src/apple/versionFinder', () => ({ listVersions: vi.fn() }));
vi.mock('../../src/apple/versionLookup', () => ({ getVersionMetadata: vi.fn() }));
vi.mock('../../src/hooks/useDownloadAction', () => ({ useDownloadAction: () => mocks }));

const app = {
  id: 461703208, bundleID: 'com.example.maps', name: 'Maps', artworkUrl: '',
} as Software;
const account: Account = {
  email: 'one@example.test', password: 'secret-password', appleId: 'apple-one',
  store: '143465', firstName: 'First', lastName: 'Account', passwordToken: 'secret-token',
  directoryServicesIdentifier: '123', cookies: [], deviceIdentifier: 'aabbccddeeff', pod: '11',
};
const secondAccount: Account = { ...account, email: 'two@example.test', deviceIdentifier: '112233445566' };
const updatedCookie = { name: 'session', value: 'secret-cookie', path: '/', httpOnly: true, secure: true };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function renderHistory(strict = false) {
  const content = (
    <MemoryRouter initialEntries={[{ pathname: `/search/${app.id}/versions`, state: { app, country: 'CN' } }]}>
      <VersionHistory />
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{content}</StrictMode> : content);
}

beforeEach(async () => {
  vi.resetAllMocks();
  localStorage.clear();
  await useAccountsStore.getState().loadAccounts();
  useAccountsStore.setState({
    accounts: [account, secondAccount], loading: false,
    updateAccount: vi.fn(async (updated: Account) => {
      useAccountsStore.setState((state) => ({
        accounts: state.accounts.map((item) => item.email === updated.email ? updated : item),
      }));
    }),
  });
  useSettingsStore.setState({ privacyMode: false });
  vi.mocked(listVersions).mockResolvedValue({ versions: ['103', '102', '101'], updatedCookies: [] });
  vi.mocked(getVersionMetadata).mockImplementation(async (current, _app, versionId) => ({
    metadata: { displayVersion: `16.${versionId}`, releaseDate: '2011-09-08T22:19:39Z' },
    updatedCookies: current.cookies,
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('VersionHistory automatic version labels', () => {
  it('loads the list and labels without clicks and does not show the app release date', async () => {
    renderHistory(true);
    expect(await screen.findByText('v16.101')).toBeInTheDocument();
    expect(listVersions).toHaveBeenCalledOnce();
    expect(getVersionMetadata).toHaveBeenCalledTimes(3);
    expect(screen.queryByText(/2011/)).not.toBeInTheDocument();
    expect(screen.queryByText('search.versions.loadDetails')).not.toBeInTheDocument();
    expect(useAccountsStore.getState().updateAccount).not.toHaveBeenCalled();
  });

  it('reuses cached labels after leaving and returning without storing credentials', async () => {
    const view = renderHistory();
    await screen.findByText('v16.101');
    const cached = localStorage.getItem('asspp-version-metadata-v2')!;
    expect(cached).toContain('16.103');
    expect(cached).not.toMatch(/example.test|secret-|releaseDate|2011/);
    view.unmount();
    renderHistory();
    await screen.findByText('v16.101');
    expect(listVersions).toHaveBeenCalledTimes(2);
    expect(getVersionMetadata).toHaveBeenCalledTimes(3);
  });

  it('only resolves the visible page and reuses results when paging back', async () => {
    vi.mocked(listVersions).mockResolvedValue({
      versions: Array.from({ length: 25 }, (_, i) => String(125 - i)), updatedCookies: [],
    });
    renderHistory();
    await screen.findByText('v16.106');
    expect(getVersionMetadata).toHaveBeenCalledTimes(20);
    expect(screen.queryByText('v16.105')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'search.versions.next' }));
    await screen.findByText('v16.101');
    expect(getVersionMetadata).toHaveBeenCalledTimes(25);
    expect(screen.getByRole('button', { name: 'search.versions.next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'search.versions.previous' }));
    await screen.findByText('v16.125');
    expect(getVersionMetadata).toHaveBeenCalledTimes(25);
  });

  it('does not query an intermediate page when quickly paging from 1 through 2 to 3', async () => {
    vi.mocked(listVersions).mockResolvedValue({
      versions: Array.from({ length: 45 }, (_, i) => String(145 - i)), updatedCookies: [],
    });
    renderHistory();
    await screen.findByText('v16.126');
    expect(getVersionMetadata).toHaveBeenCalledTimes(20);
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'search.versions.next' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(getVersionMetadata).toHaveBeenCalledTimes(20);
    fireEvent.click(screen.getByRole('button', { name: 'search.versions.next' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(349); });
    expect(getVersionMetadata).toHaveBeenCalledTimes(20);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(getVersionMetadata).toHaveBeenCalledTimes(25);
    expect(vi.mocked(getVersionMetadata).mock.calls.slice(20).map(([, , id]) => id))
      .toEqual(['105', '104', '103', '102', '101']);
  });

  it('cancels the delayed metadata lookup when leaving before the delay ends', async () => {
    vi.useFakeTimers();
    let view!: ReturnType<typeof renderHistory>;
    await act(async () => { view = renderHistory(); });
    expect(screen.getByText('ID: 103')).toBeInTheDocument();
    expect(getVersionMetadata).not.toHaveBeenCalled();
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(getVersionMetadata).not.toHaveBeenCalled();
  });

  it('offers an explicit retry without continuously retrying a failed lookup', async () => {
    vi.mocked(getVersionMetadata).mockRejectedValueOnce(new Error('Temporary failure'));
    renderHistory();
    await screen.findByText('v16.101');
    expect(getVersionMetadata).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole('button', { name: 'search.versions.retryDetails' }));
    await screen.findByText('v16.103');
    expect(getVersionMetadata).toHaveBeenCalledTimes(4);
  });

  it('keeps metadata requests sequential and carries forward returned cookies', async () => {
    const pending = deferred<Awaited<ReturnType<typeof getVersionMetadata>>>();
    vi.mocked(listVersions).mockResolvedValue({ versions: ['103', '102'], updatedCookies: [updatedCookie] });
    vi.mocked(getVersionMetadata).mockReturnValueOnce(pending.promise);
    renderHistory();
    await waitFor(() => expect(getVersionMetadata).toHaveBeenCalledOnce());
    expect(vi.mocked(getVersionMetadata).mock.calls[0][0].cookies).toEqual([updatedCookie]);
    const rotatedCookie = { ...updatedCookie, value: 'rotated-cookie' };
    await act(async () => { pending.resolve({ metadata: { displayVersion: '16.103' }, updatedCookies: [rotatedCookie] }); });
    await screen.findByText('v16.102');
    expect(vi.mocked(getVersionMetadata).mock.calls[1][0].cookies).toEqual([rotatedCookie]);
    expect(useAccountsStore.getState().accounts[0]).toEqual({ ...account, cookies: [rotatedCookie] });
  });

  it('preserves account edits made while a metadata request is pending', async () => {
    const pending = deferred<Awaited<ReturnType<typeof getVersionMetadata>>>();
    vi.mocked(getVersionMetadata).mockReturnValueOnce(pending.promise);
    renderHistory();
    await waitFor(() => expect(getVersionMetadata).toHaveBeenCalledOnce());
    act(() => { useAccountsStore.setState({ accounts: [{ ...account, firstName: 'Edited' }, secondAccount] }); });
    await act(async () => { pending.resolve({ metadata: { displayVersion: '16.103' }, updatedCookies: [updatedCookie] }); });
    await screen.findByText('v16.101');
    expect(useAccountsStore.getState().accounts[0].firstName).toBe('Edited');
  });

  it('does not overwrite a newly authenticated account with an old response', async () => {
    const pending = deferred<Awaited<ReturnType<typeof getVersionMetadata>>>();
    vi.mocked(getVersionMetadata).mockReturnValueOnce(pending.promise);
    renderHistory();
    await waitFor(() => expect(getVersionMetadata).toHaveBeenCalledOnce());
    act(() => { useAccountsStore.setState({ accounts: [{ ...account, passwordToken: 'new-token' }, secondAccount] }); });
    await act(async () => { pending.resolve({ metadata: { displayVersion: '16.103' }, updatedCookies: [updatedCookie] }); });
    await screen.findByText('v16.101');
    expect(useAccountsStore.getState().accounts[0]).toEqual({ ...account, passwordToken: 'new-token' });
  });

  it('ignores an old account list response after switching accounts', async () => {
    const pending = deferred<Awaited<ReturnType<typeof listVersions>>>();
    vi.mocked(listVersions).mockReturnValueOnce(pending.promise);
    renderHistory();
    await waitFor(() => expect(listVersions).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByRole('combobox'), { target: { value: secondAccount.email } });
    await screen.findByText('v16.101');
    await act(async () => { pending.resolve({ versions: ['999'], updatedCookies: [updatedCookie] }); });
    expect(screen.queryByText(/999/)).not.toBeInTheDocument();
    expect(useAccountsStore.getState().updateAccount).not.toHaveBeenCalled();
    expect(vi.mocked(getVersionMetadata).mock.calls.every(([current]) => current.email === secondAccount.email)).toBe(true);
  });

  it('stops queued lookups and cookie writes on unmount', async () => {
    const pending = deferred<Awaited<ReturnType<typeof getVersionMetadata>>>();
    vi.mocked(getVersionMetadata).mockReturnValueOnce(pending.promise);
    const view = renderHistory();
    await waitFor(() => expect(getVersionMetadata).toHaveBeenCalledOnce());
    view.unmount();
    await act(async () => { pending.resolve({ metadata: { displayVersion: '16.103' }, updatedCookies: [updatedCookie] }); });
    expect(getVersionMetadata).toHaveBeenCalledOnce();
    expect(useAccountsStore.getState().updateAccount).not.toHaveBeenCalled();
  });

  it('stops the old page queue and only queries the newly selected page', async () => {
    const pending = deferred<Awaited<ReturnType<typeof getVersionMetadata>>>();
    vi.mocked(listVersions).mockResolvedValue({
      versions: Array.from({ length: 25 }, (_, i) => String(125 - i)), updatedCookies: [],
    });
    vi.mocked(getVersionMetadata).mockReturnValueOnce(pending.promise);
    renderHistory();
    await waitFor(() => expect(getVersionMetadata).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'search.versions.next' }));
    expect(getVersionMetadata).toHaveBeenCalledOnce();
    await act(async () => { pending.resolve({ metadata: { displayVersion: '16.125' }, updatedCookies: [] }); });
    await screen.findByText('v16.101');
    expect(vi.mocked(getVersionMetadata).mock.calls.map(([, , id]) => id)).toEqual(['125', '105', '104', '103', '102', '101']);
    expect(screen.queryByText('v16.125')).not.toBeInTheDocument();
  });

  it('refreshes the list while keeping known version labels', async () => {
    renderHistory();
    await screen.findByText('v16.101');
    vi.mocked(listVersions).mockResolvedValueOnce({ versions: ['104', '103'], updatedCookies: [] });
    fireEvent.click(screen.getByRole('button', { name: 'search.versions.refresh' }));
    await screen.findByText('v16.104');
    expect(getVersionMetadata).toHaveBeenCalledTimes(4);
    expect(screen.queryByText('v16.101')).not.toBeInTheDocument();
  });

  it('refetches expired in-memory and stored version labels after 30 days', async () => {
    renderHistory();
    await screen.findByText('v16.101');
    const later = Date.now() + 30 * 24 * 60 * 60 * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    fireEvent.click(screen.getByRole('button', { name: 'search.versions.refresh' }));
    await waitFor(() => expect(getVersionMetadata).toHaveBeenCalledTimes(6));
    await screen.findByText('v16.101');
    const entries = JSON.parse(localStorage.getItem('asspp-version-metadata-v2')!);
    expect(entries).toHaveLength(3);
    expect(entries.every((entry: [string, string, number]) => entry[2] === later)).toBe(true);
  });

  it('masks account errors in privacy mode and allows a list retry', async () => {
    useSettingsStore.setState({ privacyMode: true });
    vi.mocked(listVersions).mockRejectedValueOnce(new Error(`Expired token for ${account.email}`));
    renderHistory();
    expect(await screen.findByText('privacy.hidden')).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(account.email);
    expect(getVersionMetadata).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'search.versions.refresh' }));
    await screen.findByText('v16.101');
  });

  it('downloads the real version ID using the selected account in privacy mode', async () => {
    useSettingsStore.setState({ privacyMode: true });
    renderHistory();
    await screen.findByText('v16.101');
    fireEvent.click(screen.getAllByRole('button', { name: 'search.versions.download' })[0]);
    await waitFor(() => expect(mocks.startDownload).toHaveBeenCalledWith(account, app, '103'));
  });
});
