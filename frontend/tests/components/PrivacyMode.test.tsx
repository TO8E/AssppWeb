import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccountList from '../../src/components/Account/AccountList';
import AccountDetail from '../../src/components/Account/AccountDetail';
import AddAccountForm from '../../src/components/Account/AddAccountForm';
import AccountSelect from '../../src/components/common/AccountSelect';
import Alert from '../../src/components/common/Alert';
import ToastContainer from '../../src/components/common/ToastContainer';
import SapStatus from '../../src/components/common/SapStatus';
import DownloadItem from '../../src/components/Download/DownloadItem';
import PackageDetail from '../../src/components/Download/PackageDetail';
import SettingsPage from '../../src/components/Settings/SettingsPage';
import { useAccountsStore } from '../../src/store/accounts';
import { useSettingsStore } from '../../src/store/settings';
import { useToastStore } from '../../src/store/toast';
import { useSapStore } from '../../src/store/sap';
import { accountRouteId } from '../../src/utils/account';
import { AuthenticationError } from '../../src/apple/authenticate';
import zhCN from '../../src/locales/zh-CN.json';
import type { Account, DownloadTask } from '../../src/types';

const mocks = vi.hoisted(() => ({ apiGet: vi.fn(), authenticate: vi.fn(), tasks: [] as DownloadTask[] }));
vi.mock('../../src/apple/request', () => ({ appleRequest: vi.fn() }));
vi.mock('../../src/apple/authenticate', () => ({
  authenticate: mocks.authenticate,
  AuthenticationError: class extends Error {
    constructor(message: string, public codeRequired = false) { super(message); }
  },
}));
vi.mock('../../src/api/client', () => ({
  apiGet: mocks.apiGet, apiPost: vi.fn(), authHeaders: () => ({}),
}));
vi.mock('../../src/hooks/useDownloads', () => ({
  useDownloads: () => ({ tasks: mocks.tasks, hashToEmail: { 'private-account-hash': 'alice@secret.test' },
    deleteDownload: vi.fn(), pauseDownload: vi.fn(), resumeDownload: vi.fn() }),
}));

const account: Account = {
  email: 'alice@secret.test', password: 'private-password', appleId: 'private-apple-id',
  firstName: 'PrivateFirst', lastName: 'PrivateLast', store: '143465',
  passwordToken: 'private-token', directoryServicesIdentifier: '778899112233',
  deviceIdentifier: 'aabbccddeeff', pod: '11', cookies: [],
};
const second: Account = { ...account, email: 'bob@secret.test', firstName: 'SecondName' };
const task = {
  id: 'task-123', accountHash: 'private-account-hash', status: 'failed', progress: 0,
  error: 'private-token alice@secret.test', hasFile: false, createdAt: '2026-09-01',
  software: { id: 1, name: 'Example App', bundleID: 'com.example.app', version: '1.0', artworkUrl: '', minimumOsVersion: '16', fileSizeBytes: '1024' },
} as DownloadTask;
const i18n = createInstance();
const originalLoad = useAccountsStore.getState().loadAccounts;

function wrap(child: React.ReactNode, initialPath = '/') {
  return render(<I18nextProvider i18n={i18n}><MemoryRouter initialEntries={[initialPath]}>{child}</MemoryRouter></I18nextProvider>);
}
function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

beforeEach(async () => {
  await i18n.init({ lng: 'zh-CN', resources: { 'zh-CN': { translation: zhCN } }, interpolation: { escapeValue: false } });
  await originalLoad();
  useAccountsStore.setState({ accounts: [account, second], loading: false, loadAccounts: vi.fn().mockResolvedValue(undefined) });
  useSettingsStore.setState({ privacyMode: false, autoFetchVersionNumbers: false });
  useToastStore.setState({ toasts: [] });
  useSapStore.setState({ stage: 'idle', error: null });
  mocks.tasks = [task];
  mocks.authenticate.mockReset();
  mocks.apiGet.mockResolvedValue({ dataDir: '/private/server/data', publicBaseUrl: 'https://private-server.test', port: 8080 });
});
afterEach(() => {
  cleanup();
  useAccountsStore.setState({ loadAccounts: originalLoad });
  vi.clearAllMocks();
});

describe('privacy mode display coverage', () => {
  it('switches in settings, hides server values and preserves account data', async () => {
    const before = JSON.stringify(useAccountsStore.getState().accounts);
    wrap(<SettingsPage />);
    await screen.findByText('/private/server/data');
    fireEvent.click(screen.getByRole('switch', { name: '隐私模式' }));
    expect(screen.getByRole('switch', { name: '隐私模式' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('/private/server/data')).not.toBeInTheDocument();
    expect(screen.queryByText('https://private-server.test')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('asspp-settings')!).state.privacyMode).toBe(true);
    expect(JSON.stringify(useAccountsStore.getState().accounts)).toBe(before);
    fireEvent.click(screen.getByRole('switch', { name: '隐私模式' }));
    expect(screen.getByText('/private/server/data')).toBeInTheDocument();
  });

  it('offers a default-off automatic version lookup switch independently of privacy mode', async () => {
    const before = JSON.stringify(useAccountsStore.getState().accounts);
    wrap(<SettingsPage />);
    await screen.findByText('/private/server/data');
    const toggle = screen.getByRole('switch', { name: '自动获取版本号' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(JSON.parse(localStorage.getItem('asspp-settings')!).state.autoFetchVersionNumbers).toBe(true);
    expect(useSettingsStore.getState().privacyMode).toBe(false);
    expect(JSON.stringify(useAccountsStore.getState().accounts)).toBe(before);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('masks account cards, tooltips and links while keeping numbered aliases', async () => {
    useSettingsStore.getState().setPrivacyMode(true);
    const { container } = wrap(<AccountList />);
    const row = await screen.findByRole('link', { name: /账号 1/ });
    await waitFor(() => expect(row.getAttribute('href')).toMatch(/^\/accounts\/id\/[a-f0-9]+$/));
    for (const value of [account.email, account.firstName, account.lastName, '中国大陆']) {
      expect(container.innerHTML).not.toContain(value);
    }
    expect(screen.getByRole('link', { name: /账号 2/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /账号 2/ }).getAttribute('href')).not.toBe(row.getAttribute('href'));
    act(() => useSettingsStore.getState().setPrivacyMode(false));
    expect(screen.getByText(account.email)).toBeInTheDocument();
  });

  it('keeps real selection values out of options but selects the correct account', () => {
    useSettingsStore.getState().setPrivacyMode(true);
    const selected = vi.fn();
    function Selection() {
      const [value, setValue] = useState(account.email);
      return <AccountSelect accounts={[account, second]} value={value} onChange={(email) => { selected(email); setValue(email); }} />;
    }
    const { container } = wrap(<Selection />);
    expect(container.innerHTML).not.toContain(account.email);
    expect(container.innerHTML).not.toContain(second.email);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    expect(selected).toHaveBeenCalledWith(second.email);
    expect(screen.getByRole('option', { name: '账号 2' })).toHaveProperty('selected', true);
  });

  it('replaces email detail URLs and masks every account field', async () => {
    useSettingsStore.getState().setPrivacyMode(true);
    const { container } = wrap(<><LocationProbe /><Routes>
      <Route path="/accounts/:email" element={<AccountDetail />} />
      <Route path="/accounts/id/:accountId" element={<AccountDetail />} />
    </Routes></>, `/accounts/${encodeURIComponent(account.email)}`);
    await waitFor(() => expect(screen.getByTestId('location').textContent).toMatch(/^\/accounts\/id\/[a-f0-9]+$/));
    for (const value of [account.email, account.firstName, account.appleId, account.directoryServicesIdentifier, account.deviceIdentifier]) {
      expect(container.innerHTML).not.toContain(value);
    }
    act(() => useSettingsStore.getState().setPrivacyMode(false));
    expect(await screen.findByText(account.email)).toBeInTheDocument();
  });

  it('resolves opaque account URLs after a fresh mount', async () => {
    const id = await accountRouteId(account.email);
    wrap(<Routes><Route path="/accounts/id/:accountId" element={<AccountDetail />} /></Routes>, `/accounts/id/${id}`);
    expect(await screen.findByText(account.email)).toBeInTheDocument();
  });

  it('uses masked inputs for a new account email and device identifier', () => {
    useSettingsStore.getState().setPrivacyMode(true);
    wrap(<AddAccountForm />);
    expect(screen.getByLabelText('Apple ID (邮箱)')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText(zhCN.accounts.addForm.deviceId)).toHaveAttribute('type', 'password');
  });

  it('keeps the login payload real and hides the two-factor input', async () => {
    useSettingsStore.getState().setPrivacyMode(true);
    mocks.authenticate.mockRejectedValue(new AuthenticationError('Verification required', true));
    const { container } = wrap(<AddAccountForm />);
    fireEvent.change(screen.getByLabelText('Apple ID (邮箱)'), { target: { value: 'new@private.test' } });
    fireEvent.change(screen.getByLabelText(zhCN.accounts.addForm.password), { target: { value: 'fixture-password' } });
    fireEvent.submit(container.querySelector('form')!);
    const input = await screen.findByLabelText(zhCN.accounts.addForm.code);
    expect(input).toHaveAttribute('type', 'password');
    expect(mocks.authenticate).toHaveBeenCalledWith('new@private.test', 'fixture-password', undefined, undefined, expect.any(String));
  });

  it('hides existing notification contents immediately when enabled', () => {
    useToastStore.setState({ toasts: [{ id: '1', type: 'error', title: account.email, message: 'draft-user@private.test secret-otp-123456' }] });
    const { container } = wrap(<ToastContainer />);
    expect(container.textContent).toContain('draft-user@private.test');
    act(() => useSettingsStore.getState().setPrivacyMode(true));
    expect(container.innerHTML).not.toContain(account.email);
    expect(container.innerHTML).not.toContain('draft-user@private.test');
    expect(container.innerHTML).not.toContain('secret-otp-123456');
    expect(screen.getByText('操作失败')).toBeInTheDocument();
  });

  it('hides raw signer and download error details', () => {
    useSettingsStore.getState().setPrivacyMode(true);
    useSapStore.setState({ stage: 'error', error: 'private-token alice@secret.test' });
    const { container } = wrap(<><Alert type="error">alice@secret.test private-token</Alert><SapStatus /><DownloadItem task={task} onPause={vi.fn()} onResume={vi.fn()} onDelete={vi.fn()} /></>);
    expect(container.innerHTML).not.toContain('private-token');
    expect(container.innerHTML).not.toContain(account.email);
  });

  it('hides package account values and their hover titles', () => {
    useSettingsStore.getState().setPrivacyMode(true);
    const { container } = wrap(<Routes><Route path="/downloads/:id" element={<PackageDetail />} /></Routes>, `/downloads/${task.id}`);
    expect(container.innerHTML).not.toContain(account.email);
    expect(container.innerHTML).not.toContain(task.accountHash);
    expect(container.innerHTML).not.toContain('private-token');
  });

  it('hides install QR tooltips in privacy mode', () => {
    useSettingsStore.getState().setPrivacyMode(true);
    const completed = { ...task, status: 'completed' as const, hasFile: true, error: undefined };
    wrap(<DownloadItem task={completed} onPause={vi.fn()} onResume={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByRole('tooltip', { hidden: true })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: zhCN.downloads.package.share })).not.toHaveAttribute('aria-describedby');
  });
});
