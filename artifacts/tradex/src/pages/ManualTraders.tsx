import {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import {
  ChevronDown, Minus, Plus, Check, Info, BarChart2, MousePointer2, X
} from "lucide-react";
import LightweightChart from "@/components/LightweightChart";
import AuthGateModal from "@/components/AuthGateModal";
import { useAuth, DERIV_APP_ID } from "@/context/AuthContext";

/* --- Constants & Helpers --- */
const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;
const MARKETS = [
  { label: "Volatility 100 (1s) Index", id: "1HZ100V" },
  { label: "Volatility 100 Index", id: "R_100" },
  { label: "Volatility 75 (1s) Index", id: "1HZ75V" },
  { label: "Volatility 50 (1s) Index", id: "1HZ50V" },
  { label: "Volatility 25 (1s) Index", id: "1HZ25V" },
  { label: "Volatility 10 (1s) Index", id: "1HZ10V" },
];

const GROWTH_RATES = [1, 2, 3, 4, 5];

/* --- Theming --- */
const COLORS = {
  bg: "#ffffff",
  border: "#eeeeee",
  textMain: "#333333",
  textSub: "#999999",
  green: "#00ff00", // The "vivid neon green" from image
  greenDark: "#00c853",
  blue: "#2e59bb",
};

/* --- Simplified Live Price Hook --- */
function useLivePrice(symbol: string) {
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<string>("0.00 (0.00%)");
  const [isDown, setIsDown] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const sock = new WebSocket(WS_URL);
    ws.current = sock;
    sock.onopen = () => sock.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    sock.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.tick) {
        setPrice(m.tick.quote);
        // Mocking the percentage change for UI fidelity
        setIsDown(true); 
        setChange("0.47 (0.04%)");
      }
    };
    return () => sock.close();
  }, [symbol]);

  return { price, change, isDown };
}

/* --- Main Component --- */
export default function ManualTraders() {
  const { isLoggedIn, balance } = useAuth();
  const [market, setMarket] = useState(MARKETS[0]);
  const [mktOpen, setMktOpen] = useState(false);
  const [stake, setStake] = useState(10);
  const [growth, setGrowth] = useState(3);
  const [tpOn, setTpOn] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const { price, change, isDown } = useLivePrice(market.id);
  const MAX_PAYOUT = 6000;
  
  const maxTicks = useMemo(() => {
    return Math.floor(Math.log(MAX_PAYOUT / stake) / Math.log(1 + growth / 100));
  }, [stake, growth]);

  return (
    <div className="tx-container">
      <style>{`
        .tx-container {
          background: #f4f4f4;
          height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        /* --- Header / Chart Section --- */
        .tx-chart-section {
          background: #fff;
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .tx-market-selector {
          padding: 12px 16px;
          border-bottom: 1px solid #eee;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 10;
        }

        .tx-mkt-info {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }

        .tx-price-display {
          text-align: right;
        }

        .tx-price-main {
          font-size: 14px;
          font-weight: 600;
          color: #666;
        }

        .tx-price-change {
          font-size: 12px;
          color: #e53935;
        }

        /* --- Trading Panel --- */
        .tx-panel {
          background: #fff;
          padding: 16px;
          border-top: 1px solid #ddd;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .tx-dropdown-box {
          border: 1px solid #eee;
          border-radius: 4px;
          padding: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-weight: 600;
          font-size: 14px;
        }

        .tx-input-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .tx-stepper {
          display: flex;
          align-items: center;
          background: #fff;
          border: 1px solid #eee;
          border-radius: 4px;
          overflow: hidden;
        }

        .tx-step-btn {
          padding: 12px;
          background: #f9f9f9;
          border: none;
          cursor: pointer;
        }

        .tx-step-val {
          flex: 1;
          text-align: center;
          font-weight: 700;
          font-size: 15px;
        }

        .tx-percentage-box {
          border: 1px solid #eee;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          gap: 4px;
        }

        .tx-checkbox-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .tx-info-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #333;
          padding: 4px 0;
        }

        .tx-info-val {
          font-weight: 600;
          border-bottom: 1px dotted #ccc;
        }

        /* --- Buy Button --- */
        .tx-buy-container {
           margin-top: 8px;
        }

        .tx-btn-buy {
          width: 100%;
          background: #00ff00;
          border: none;
          padding: 18px;
          border-radius: 4px;
          font-weight: 800;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
        }

        .tx-chart-icons {
          position: absolute;
          top: 80px;
          right: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .tx-icon-btn {
          background: #fff;
          border: 1px solid #eee;
          padding: 8px;
          border-radius: 4px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
      `}</style>

      {/* 1. Header & Chart Section */}
      <section className="tx-chart-section">
        <div className="tx-market-selector" onClick={() => setMktOpen(!mktOpen)}>
          <div className="tx-mkt-info">
            <img src={`/assets/markets/${market.id}.svg`} width={24} height={24} alt="" onError={(e) => e.currentTarget.src='https://deriv.com/static/47413d789069d5843a8904724a87b02c/5448b/volatility-100-1s-index.png'} />
            <span style={{fontWeight: 700, fontSize: '15px'}}>{market.label}</span>
            <ChevronDown size={18} />
          </div>
          <div className="tx-price-display">
            <div className="tx-price-main">{price ? price.toFixed(2) : "Loading..."}</div>
            <div className={`tx-price-change ${isDown ? 'text-red-500' : 'text-green-500'}`}>
              {isDown ? '▼' : '▲'} {change}
            </div>
          </div>
        </div>

        {/* Lightweight Chart Placeholder */}
        <div style={{flex: 1, background: '#fff'}}>
           <LightweightChart symbol={market.id} />
        </div>

        {/* Floating Chart Icons */}
        <div className="tx-chart-icons">
          <button className="tx-icon-btn"><BarChart2 size={20} color="#666"/></button>
          <button className="tx-icon-btn"><MousePointer2 size={20} color="#666"/></button>
        </div>
      </section>

      {/* 2. Trading Panel */}
      <section className="tx-panel">
        {/* Trade Type Dropdown */}
        <div className="tx-dropdown-box">
          <div style={{display:'flex', gap: '10px', alignItems: 'center'}}>
            <img src="/assets/icons/accu.svg" width={20} alt="" />
            <span>Accumulators</span>
          </div>
          <ChevronDown size={18} />
        </div>

        {/* Stake & Percentage Side-by-Side */}
        <div className="tx-input-grid">
          <div className="tx-stepper">
            <button className="tx-step-btn" onClick={() => setStake(s => Math.max(1, s - 1))}><Minus size={16}/></button>
            <div className="tx-step-val">{stake}</div>
            <button className="tx-step-btn" onClick={() => setStake(s => s + 1)}><Plus size={16}/></button>
          </div>
          
          <div className="tx-percentage-box">
            <span>{growth}%</span>
            <Info size={14} color="#ccc" />
          </div>
        </div>

        {/* Take Profit */}
        <div className="tx-checkbox-row" onClick={() => setTpOn(!tpOn)}>
          <div style={{
            width: 18, height: 18, border: '2px solid #ccc', borderRadius: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: tpOn ? COLORS.blue : 'transparent',
            borderColor: tpOn ? COLORS.blue : '#ccc'
          }}>
            {tpOn && <Check size={14} color="#fff" />}
          </div>
          <span>Take profit</span>
        </div>

        {/* Info Rows */}
        <div style={{marginTop: '4px'}}>
          <div className="tx-info-row">
            <span>Max. payout</span>
            <span className="tx-info-val">{MAX_PAYOUT.toFixed(2)} AUD</span>
          </div>
          <div className="tx-info-row">
            <span>Max. ticks</span>
            <span className="tx-info-val">{maxTicks} ticks</span>
          </div>
        </div>

        {/* 3. Action Buttons */}
        <div className="tx-buy-container">
          <button className="tx-btn-buy" onClick={() => !isLoggedIn && setShowAuth(true)}>
             <TrendingUp size={20} />
             <span>Buy</span>
          </button>
        </div>
      </section>

      {/* Auth Modal */}
      {showAuth && <AuthGateModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
