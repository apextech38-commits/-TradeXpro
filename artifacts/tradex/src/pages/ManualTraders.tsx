import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

const DTRADER_URL = 'https://dtrader.tradexpro.co.ke';
const LOGINID_KEY = 'active_loginid';

/**
 * Manual Traders — embeds the white-labeled dtrader fork in an iframe and
 * passes the Deriv OAuth bearer token through via postMessage so the user
 * doesn't have to log in twice.
 *
 * NOTE: This component includes a temporary navigation guard (see
 * `installNavGuard` below) to diagnose an issue where the top-level window
 * was unexpectedly navigating to dtrader.tradexpro.co.ke instead of keeping
 * it embedded in the iframe. The guard logs (and attempts to block) any
 * programmatic top-level navigation while this component is mounted, and
 * prints a stack trace identifying the exact call site responsible.
 *
 * Once the root cause is found and fixed, the guard block can be removed —
 * it's intentionally verbose and defensive, not meant to ship long-term.
 */

function installNavGuard(): () => void {
  const cleanups: Array<() => void> = [];

  const warn = (label: string, extra?: unknown) => {
    // eslint-disable-next-line no-console
    console.warn(
      `[ManualTraders nav-guard] Blocked/observed: ${label}`,
      extra ?? '',
    );
    // eslint-disable-next-line no-console
    console.trace(`[ManualTraders nav-guard] stack for: ${label}`);
  };

  // 1. Catch assignment to window.location / window.location.href
  //    Most browsers won't let us fully override `location`, but we CAN
  //    detect attempts via the `beforeunload` event below. This listener
  //    is best-effort and may no-op in some browsers — that's fine, the
  //    beforeunload + visibilitychange listeners are the reliable signal.
  try {
    const originalAssign = window.location.assign.bind(window.location);
    const originalReplace = window.location.replace.bind(window.location);

    window.location.assign = function patchedAssign(url: string | URL) {
      warn('window.location.assign()', url);
      return originalAssign(url as string);
    };
    window.location.replace = function patchedReplace(url: string | URL) {
      warn('window.location.replace()', url);
      return originalReplace(url as string);
    };

    cleanups.push(() => {
      try {
        window.location.assign = originalAssign;
        window.location.replace = originalReplace;
      } catch {
        /* ignore restore failures */
      }
    });
  } catch {
    // Some browsers disallow patching `location` methods — ignore.
  }

  // 2. Wrap history.pushState / replaceState to catch SPA-style nav calls
  //    (this is what flagged "Session History Item Has Been Marked
  //    Skippable" for the manualtraders resource in Chrome's Issues panel —
  //    a history entry created without user interaction).
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = function patchedPushState(...args: Parameters<typeof history.pushState>) {
    warn('history.pushState()', args);
    return originalPushState(...args);
  };
  history.replaceState = function patchedReplaceState(...args: Parameters<typeof history.replaceState>) {
    warn('history.replaceState()', args);
    return originalReplaceState(...args);
  };

  cleanups.push(() => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
  });

  // 3. beforeunload fires for ANY top-level navigation away from this page,
  //    including a script-driven `location.href = ...` assignment that we
  //    can't intercept directly. This is the most reliable catch-all.
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    warn('beforeunload (top-level navigation is about to happen)');
    // Returning a string here triggers the browser's native "leave site?"
    // confirmation dialog, which gives us a chance to confirm this is
    // really happening and not just a normal user-initiated nav (e.g.
    // closing the tab). Comment out the next two lines if the dialog
    // becomes too disruptive during testing.
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  cleanups.push(() => window.removeEventListener('beforeunload', handleBeforeUnload));

  // 4. visibilitychange can also hint at an unexpected navigation/reload
  const handleVisibility = () => {
    if (document.visibilityState === 'hidden') {
      warn('visibilitychange -> hidden (page may be navigating/unloading)');
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
  cleanups.push(() => document.removeEventListener('visibilitychange', handleVisibility));

  return () => cleanups.forEach((fn) => fn());
}

export default function ManualTraders() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isLoggedIn, activeAccount } = useAuth();

  // Navigation guard — diagnostic, see installNavGuard() docblock above.
  useEffect(() => {
    const removeGuard = installNavGuard();
    return removeGuard;
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const sendAuth = () => {
      // Send the bearer token TradeXpro's own AuthContext stores after login.
      // NOTE: AuthContext.tsx writes this under localStorage['tradex_access_token']
      // (see TOKEN_KEY in AuthContext.tsx) — NOT sessionStorage['auth_info'],
      // which was the original assumption but doesn't actually get written
      // anywhere in the current auth flow.
      const token = localStorage.getItem('tradex_access_token');
      const loginid = localStorage.getItem(LOGINID_KEY);

      if (!token) {
        // eslint-disable-next-line no-console
        console.warn('[ManualTraders] No access_token found in localStorage["tradex_access_token"]; skipping auth postMessage');
        return;
      }

      iframe.contentWindow?.postMessage(
        {
          type: 'TRADEXPRO_AUTH',
          token,
          loginid,
        },
        DTRADER_URL,
      );
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== DTRADER_URL) return;
      if (event.data?.type === 'DTRADER_AUTH_READY') {
        sendAuth();
      }
    };

    window.addEventListener('message', handleMessage);
    iframe.addEventListener('load', sendAuth);

    return () => {
      window.removeEventListener('message', handleMessage);
      iframe.removeEventListener('load', sendAuth);
    };
  }, [isLoggedIn, activeAccount]);

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        src={DTRADER_URL}
        title="Manual Traders"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        allow="clipboard-read; clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}