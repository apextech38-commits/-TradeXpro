import { createContext, useContext, useState, ReactNode } from "react";

export interface BotParams {
  symbol: string;
  contractType: string;
  duration: number;
  durationUnit: string;
  stake: number;
}

export interface ContractResult {
  id: string;
  buyPrice: number;
  payout: number;
  profit: number | null;
  status: "open" | "won" | "lost";
  timestamp: number;
}

interface BotState {
  botLoaded: boolean;
  isRunning: boolean;
  params: BotParams;
  results: ContractResult[];
  totalStake: number;
  totalPayout: number;
  totalProfit: number;
  won: number;
  lost: number;
  runs: number;
  setBotLoaded: (loaded: boolean) => void;
  setIsRunning: (running: boolean) => void;
  setParams: (p: Partial<BotParams>) => void;
  addResult: (r: ContractResult) => void;
  reset: () => void;
}

const defaultParams: BotParams = {
  symbol: "R_100",
  contractType: "DIGITEVEN",
  duration: 1,
  durationUnit: "t",
  stake: 1.00,
};

const BotContext = createContext<BotState>({
  botLoaded: false,
  isRunning: false,
  params: defaultParams,
  results: [],
  totalStake: 0,
  totalPayout: 0,
  totalProfit: 0,
  won: 0,
  lost: 0,
  runs: 0,
  setBotLoaded: () => {},
  setIsRunning: () => {},
  setParams: () => {},
  addResult: () => {},
  reset: () => {},
});

export function BotProvider({ children }: { children: ReactNode }) {
  const [botLoaded, setBotLoaded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [params, setParamsState] = useState<BotParams>(defaultParams);
  const [results, setResults] = useState<ContractResult[]>([]);

  const setParams = (p: Partial<BotParams>) =>
    setParamsState(prev => ({ ...prev, ...p }));

  const addResult = (r: ContractResult) =>
    setResults(prev => [r, ...prev].slice(0, 200));

  const reset = () => {
    setResults([]);
    setIsRunning(false);
  };

  const totalStake  = results.reduce((s, r) => s + r.buyPrice, 0);
  const totalPayout = results.reduce((s, r) => s + (r.payout || 0), 0);
  const totalProfit = results.reduce((s, r) => s + (r.profit || 0), 0);
  const won  = results.filter(r => r.status === "won").length;
  const lost = results.filter(r => r.status === "lost").length;
  const runs = results.length;

  return (
    <BotContext.Provider value={{
      botLoaded, isRunning, params, results,
      totalStake, totalPayout, totalProfit, won, lost, runs,
      setBotLoaded, setIsRunning, setParams, addResult, reset,
    }}>
      {children}
    </BotContext.Provider>
  );
}

export const useBot = () => useContext(BotContext);
