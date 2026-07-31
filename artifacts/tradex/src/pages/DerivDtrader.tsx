import { useEffect, useMemo, useState } from 'react';
import { useAuth, DERIV_APP_ID } from '@/context/AuthContext';

// Comparison page for a third-party hosted copy of Deriv's dtrader app
// (deriv-dtrader.vercel.app), as an alternative to the self-hosted
// dtrader-template iframe at /manualtraders. Unlike that one, this
// authenticates by passing the token in the iframe's URL query string
// rather than a postMessage bridge -- simpler (no bridge/reload logic to
// keep in sync on account switches, since a new src just reloads the
// iframe on its own) but weaker: the token sits in the URL, and this is
// someone else's deployment, not infrastructure we control or can fix
// if it goes down.
const DerivDtrader = () => {
  const { isLoggedIn, activeAccount } = useAuth();
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const iframeSrc = useMemo(() => {
    if (!activeAccount?.token || !activeAccount?.account) return null;

    const params = new URLSearchParams({
      acct1: activeAccount.account,
      token1: activeAccount.token,
      cur1: activeAccount.currency || 'USD',
      lang: 'EN',
      app_id: DERIV_APP_ID,
      chart_type: 'area',
      interval: '1t',
      symbol: '1HZ100V',
      trade_type: 'accumulator',
    });

    return `https://deriv-dtrader.vercel.app/dtrader?${params.toString()}`;
  }, [activeAccount?.token, activeAccount?.account, activeAccount?.currency]);

  // New src -> browser reloads the iframe on its own, so switching
  // Real/Demo on the main site just naturally picks up the new account.
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [iframeSrc]);

  if (!isLoggedIn || !iframeSrc) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Log in to load DTrader.
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
        <h2 className="text-lg font-semibold">DTrader failed to load</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          deriv-dtrader.vercel.app may be temporarily unavailable, or blocking embedding.
          This is a third-party service outside our infrastructure.
        </p>
        <button
          className="mt-2 px-4 py-2 rounded bg-primary text-primary-foreground text-sm"
          onClick={() => {
            setHasError(false);
            setIsLoading(true);
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height: 'calc(100vh - 80px)' }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
          Loading DTrader...
        </div>
      )}
      <iframe
        key={iframeSrc}
        src={iframeSrc}
        title="DTrader (deriv-dtrader.vercel.app)"
        className="w-full h-full border-0"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
    </div>
  );
};

export default DerivDtrader;
