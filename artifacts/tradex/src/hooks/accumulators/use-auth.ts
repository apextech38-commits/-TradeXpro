import { useAuth } from '@/context/AuthContext';
import type { AuthState, AuthInfo, DerivAccount } from '@/lib/deriv-core';

/**
 * Accumulator hook — wraps AuthContext and exposes all functions
 * that components import from @deriv/core / use-auth.
 */
export function useAuthAccumulator() {
  const auth = useAuth();

  const initiateLogin = () => auth.login();

  const initiateSignUp = () => {
    // Deriv uses the same OAuth flow for signup — just redirect
    auth.login();
  };

  const handleOAuthCallback = async (code: string, state: string) => {
    const cb = (window as Record<string, unknown>)._derivHandleCallback as
      | ((code: string, state: string) => Promise<void>)
      | undefined;
    if (cb) await cb(code, state);
  };

  const refreshAccessToken = async () => {
    // Token refresh: re-trigger login flow (Deriv OAuth2 issues short-lived tokens)
    auth.login();
  };

  const fetchAccounts = async (): Promise<DerivAccount[]> => {
    if (!auth.accessToken) return [];
    const res = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
    const data = await res.json();
    return data.data ?? [];
  };

  const getWebSocketOTP = async (accountId: string): Promise<string> => {
    return auth.getWsUrl(accountId);
  };

  const logout = () => auth.logout();

  const getAuthInfo = (): AuthInfo | null => {
    if (!auth.accessToken || !auth.account) return null;
    return {
      token: auth.accessToken,
      accountId: auth.account.accountId,
      loginId: auth.account.accountId,
    };
  };

  const getDerivAccounts = async (): Promise<DerivAccount[]> => fetchAccounts();

  const getActiveLoginId = (): string | null => auth.account?.accountId ?? null;

  const setActiveLoginId = (_id: string) => {
    // Would require switching account — stub for now
    console.warn('setActiveLoginId: account switching not yet implemented');
  };

  const setAccountType = (_type: string) => {
    console.warn('setAccountType: not yet implemented');
  };

  const clearAllAuthData = () => {
    auth.logout();
  };

  const authState: AuthState = {
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    accessToken: auth.accessToken,
    account: auth.account
      ? { ...auth.account, loginId: auth.account.accountId, accountType: 'real', accounts: [] }
      : null,
    error: auth.error,
    activeLoginId: auth.account?.accountId ?? null,
    accountType: 'real',
    accounts: auth.account ? [{ ...auth.account, loginId: auth.account.accountId }] : [],
  };

  return {
    ...authState,
    initiateLogin,
    initiateSignUp,
    handleOAuthCallback,
    refreshAccessToken,
    fetchAccounts,
    getWebSocketOTP,
    logout,
    getAuthInfo,
    getDerivAccounts,
    getActiveLoginId,
    setActiveLoginId,
    setAccountType,
    clearAllAuthData,
  };
}

// Named re-exports so files that do:
//   import { initiateLogin, ... } from '@/lib/deriv-core'
// still work after the path rewrite
export {
  useAuth,
} from '@/context/AuthContext';
