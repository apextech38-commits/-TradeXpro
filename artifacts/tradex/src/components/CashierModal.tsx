import { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// TradeX Pro — Custom Cashier Modal
// ---------------------------------------------------------------------------
// Replaces the generic Deposit/Withdraw cashier with one that calls Deriv's
// `cashier` API directly using your registered app_id, then hands the user
// off to the returned cashier URL.
//
// IMPORTANT — Deriv platform constraints (not a choice, a hard requirement):
//   1. Deriv's cashier pages send X-Frame-Options: DENY, so the returned URL
//      CANNOT be embedded in an iframe. This modal opens it in a new tab.
//   2. Cashier (deposit/withdraw) is only available on REAL money accounts.
//      Demo/virtual accounts will get an error back from the API — this is
//      handled below with a clear message rather than a silent failure.
//   3. The call must be made on an AUTHORIZED connection (token already
//      exchanged via your PKCE flow, read from localStorage as in the rest
//      of the app).
// ---------------------------------------------------------------------------

const APP_ID = '33ughhvgtxloGWBQQZEeD';
const WS_URL = `wss://api.derivws.com/trading/v1/options/ws/public?app_id=${APP_ID}`;
const TOKEN_KEY = 'tradex_access_token';

type CashierAction = 'deposit' | 'withdraw';
type Status = 'idle' | 'connecting' | 'requesting' | 'success' | 'error';

interface CashierModalProps {
  open: boolean;
  onClose: () => void;
  isDemo?: boolean; // pass the account type you already track in AuthContext
}

export default function CashierModal({ open, onClose, isDemo = false }: CashierModalProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [action, setAction] = useState<CashierAction | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!open) {
      // reset on close
      setStatus('idle');
      setAction(null);
      setErrorMsg('');
      wsRef.current?.close();
      wsRef.current = null;
    }
  }, [open]);

  const requestCashierUrl = (type: CashierAction) => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setStatus('error');
      setErrorMsg('No active session found. Please log in again.');
      return;
    }

    if (isDemo) {
      setStatus('error');
      setErrorMsg(
        'Cashier is only available on a real-money account. Switch out of Demo mode to deposit or withdraw.'
      );
      return;
    }

    setAction(type);
    setStatus('connecting');
    setErrorMsg('');

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ authorize: token }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.msg_type === 'authorize') {
        if (data.error) {
          setStatus('error');
          setErrorMsg(data.error.message || 'Authorization failed.');
          ws.close();
          return;
        }
        setStatus('requesting');
        ws.send(
          JSON.stringify({
            cashier: type, // "deposit" | "withdraw"
            provider: 'doughflow',
            type: 'url',
          })
        );
      }

      if (data.msg_type === 'cashier') {
        if (data.error) {
          setStatus('error');
          setErrorMsg(data.error.message || `Unable to open ${type} page.`);
          ws.close();
          return;
        }
        setStatus('success');
        const cashierUrl = data.cashier as string;
        // Deriv blocks iframe embedding of cashier pages — open a new tab.
        window.open(cashierUrl, '_blank', 'noopener,noreferrer');
        ws.close();
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setErrorMsg('Connection to Deriv failed. Check your network and try again.');
    };

    ws.onclose = () => {
      wsRef.current = null;
    };
  };

  if (!open) return null;

  return (
    <div className="cashier-overlay" role="dialog" aria-modal="true" aria-labelledby="cashier-title">
      <div className="cashier-modal">
        <div className="cashier-header">
          <h2 id="cashier-title">Cashier</h2>
          <button className="cashier-close" onClick={onClose} aria-label="Close cashier">
            ×
          </button>
        </div>

        {status === 'error' && (
          <div className="cashier-banner cashier-banner-error">{errorMsg}</div>
        )}

        {(status === 'connecting' || status === 'requesting') && (
          <div className="cashier-banner cashier-banner-info">
            {status === 'connecting' ? 'Connecting to Deriv…' : `Preparing your ${action} link…`}
          </div>
        )}

        {status === 'success' && (
          <div className="cashier-banner cashier-banner-success">
            Opened your {action} page in a new tab. Didn't see it? Check your popup blocker.
          </div>
        )}

        <div className="cashier-actions">
          <button
            className="cashier-action cashier-action-deposit"
            onClick={() => requestCashierUrl('deposit')}
            disabled={status === 'connecting' || status === 'requesting'}
          >
            <span className="cashier-action-icon">💰</span>
            <span className="cashier-action-text">
              <span className="cashier-action-title">Deposit</span>
              <span className="cashier-action-sub">Add funds to your account</span>
            </span>
          </button>

          <button
            className="cashier-action cashier-action-withdraw"
            onClick={() => requestCashierUrl('withdraw')}
            disabled={status === 'connecting' || status === 'requesting'}
          >
            <span className="cashier-action-icon">🏦</span>
            <span className="cashier-action-text">
              <span className="cashier-action-title">Withdraw</span>
              <span className="cashier-action-sub">Transfer funds to your bank</span>
            </span>
          </button>
        </div>
      </div>

      <style>{`
        .cashier-overlay {
          position: fixed;
          inset: 0;
          background: rgba(4, 8, 20, 0.72);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 1000;
        }
        @media (min-width: 640px) {
          .cashier-overlay { align-items: center; }
        }
        .cashier-modal {
          width: 100%;
          max-width: 560px;
          background: #0f1729;
          border: 1px solid #1f2c47;
          border-radius: 16px 16px 0 0;
          padding: 28px 24px 32px;
          box-shadow: 0 -8px 40px rgba(0,0,0,0.5);
        }
        @media (min-width: 640px) {
          .cashier-modal { border-radius: 16px; }
        }
        .cashier-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .cashier-header h2 {
          color: #e8ecf5;
          font-size: 22px;
          font-weight: 700;
          margin: 0;
        }
        .cashier-close {
          background: none;
          border: none;
          color: #8b96ab;
          font-size: 26px;
          line-height: 1;
          cursor: pointer;
          padding: 4px 8px;
        }
        .cashier-close:hover { color: #e8ecf5; }
        .cashier-banner {
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 14px;
          margin-bottom: 16px;
        }
        .cashier-banner-error {
          background: rgba(220, 38, 38, 0.12);
          border: 1px solid rgba(220, 38, 38, 0.4);
          color: #fca5a5;
        }
        .cashier-banner-info {
          background: rgba(37, 99, 235, 0.12);
          border: 1px solid rgba(37, 99, 235, 0.4);
          color: #93c5fd;
        }
        .cashier-banner-success {
          background: rgba(22, 163, 74, 0.12);
          border: 1px solid rgba(22, 163, 74, 0.4);
          color: #86efac;
        }
        .cashier-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .cashier-action {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          text-align: left;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid #22304d;
          background: #141d33;
          cursor: pointer;
          transition: transform 0.12s ease, border-color 0.12s ease;
        }
        .cashier-action:not(:disabled):hover {
          border-color: #3b82f6;
          transform: translateY(-1px);
        }
        .cashier-action:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .cashier-action-icon { font-size: 26px; }
        .cashier-action-text { display: flex; flex-direction: column; gap: 2px; }
        .cashier-action-title { color: #e8ecf5; font-weight: 600; font-size: 16px; }
        .cashier-action-sub { color: #8b96ab; font-size: 13px; }
      `}</style>
    </div>
  );
}
