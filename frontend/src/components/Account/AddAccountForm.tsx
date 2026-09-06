import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from '../Layout/PageContainer';
import ActionGroup from '../common/ActionGroup';
import Button from '../common/Button';
import { Input } from '../common/FormControl';
import Section from '../common/Section';
import Spinner from '../common/Spinner';
import SapStatus from '../common/SapStatus';
import { usePrivacy } from '../../hooks/usePrivacy';
import { useAccounts } from '../../hooks/useAccounts';
import { useToastStore } from '../../store/toast';
import { authenticate, AuthenticationError } from '../../apple/authenticate';
import { getErrorMessage } from '../../utils/error';
import { generateDeviceId } from '../../apple/config';

export default function AddAccountForm() {
  const navigate = useNavigate();
  const { privacyMode } = usePrivacy();
  const { addAccount } = useAccounts();
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [deviceId, setDeviceId] = useState(() => generateDeviceId());
  const [needsCode, setNeedsCode] = useState(false);
  const [loading, setLoading] = useState(false);


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanedDeviceId = deviceId.replace(/[: ]/g, "");
      setDeviceId(cleanedDeviceId);

      const account = await authenticate(
        email,
        password,
        needsCode && code ? code : undefined,
        undefined,
        cleanedDeviceId,
      );
      await addAccount(account);
      addToast(t("accounts.addForm.addSuccess"), "success");
      navigate("/accounts");
    } catch (err) {
      if (err instanceof AuthenticationError && err.codeRequired) {
        setNeedsCode(true);
        addToast(err.message, "error");
      } else {
        addToast(
          getErrorMessage(err, t("accounts.addForm.authFailed")),
          "error",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer back={{ to: "/accounts", label: t('nav.backTo', { page: t('nav.accounts') }) }} title={t("accounts.addForm.title")}>
      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Section className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t("accounts.addForm.email")}
              </label>
              <Input
                id="email"
                type={privacyMode ? "password" : "text"}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                placeholder={privacyMode ? undefined : t("accounts.addForm.emailPlaceholder")}
                autoComplete={privacyMode ? "off" : "username"}

              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t("accounts.addForm.password")}
              </label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}

              />
            </div>

            <div>
              <label
                htmlFor="deviceId"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t("accounts.addForm.deviceId")}
              </label>
              <div className="flex items-start gap-2">
                <Input
                  id="deviceId"
                  type={privacyMode ? "password" : "text"}
                  required
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  disabled={loading || needsCode}
                  className="flex-1 font-mono"
                />
                <Button
                  type="button"
                  onClick={() => setDeviceId(generateDeviceId())}
                  disabled={loading || needsCode}
                  variant="secondary" className="shrink-0"
                >
                  {t("accounts.addForm.randomize")}
                </Button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("accounts.addForm.deviceIdHelp")}
              </p>
            </div>

            {needsCode && (
              <div>
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {t("accounts.addForm.code")}
                </label>
                <Input
                  id="code"
                  type={privacyMode ? "password" : "text"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={loading}
                  placeholder={t("accounts.addForm.codePlaceholder")}

                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t("accounts.addForm.codeHelp")}
                </p>
              </div>
            )}
          </Section>

          <ActionGroup>
            <Button
              type="button"
              onClick={() => navigate("/accounts")}
              disabled={loading}
              variant="secondary"
            >
              {t("accounts.addForm.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              variant="primary"
            >
              {loading && <Spinner />}
              {needsCode
                ? t("accounts.addForm.verify")
                : t("accounts.addForm.signIn")}
            </Button>
          </ActionGroup>
          <SapStatus />
        </form>
      </div>
    </PageContainer>
  );
}
