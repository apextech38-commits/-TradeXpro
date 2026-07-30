import { useCallback, useEffect, useRef, useState } from 'react';
import { buyContractForUi, streamContractUntilSettled } from '@/utils/trade-purchase';

const WS_URL = `wss://api.derivws.com/trading/v1/options/ws/public`;

export type TDigitDirection = 'DIGITEVEN' | 'DIGITODD';

export interface BulkTradeRecord {
    id: string;
    direction: TDigitDirection;
    stake: number;
    profit: number;
    isWin: boolean;
    contractId?: number;
}

export interface BulkRunnerConfig {
    symbol: string;
    currency: string;
    stake: number;
    ticksDuration: number;
    bulkCount: number;
    /** Auto Trader only: stop once total net profit reaches this. undefined = no target */
    profitTarget?: number;
    /** Auto Trader only: re-evaluate direction each trade instead of using a fixed one */
    isAuto: boolean;
    /** Auto Trader only: current best direction based on live digit stats, consulted before each trade */
    getAutoDirection?: () => TDigitDirection;
}

export interface UseBulkTradingResult {
    isRunning: boolean;
    trades: BulkTradeRecord[];
    tradesCompleted: number;
    wins: number;
    losses: number;
    totalProfit: number;
    consecutiveLosses: number;
    stopReason: string | null;
    lastError: string | null;
    start: (direction: TDigitDirection) => void;
    stop: () => void;
}

const LOSS_STREAK_LIMIT = 3;

/**
 * Runs a sequence of digit (Even/Odd) contracts, one at a time: place ->
 * wait for settlement -> wait for the next tick -> place the next one.
 * Never fires two trades against the same tick.
 *
 * Manual mode: direction is fixed for the whole run, stops only at
 * bulkCount or manual stop.
 *
 * Auto mode layers on three additional stop conditions (whichever hits
 * first): 3 consecutive losses, total profit reaching profitTarget, or
 * bulkCount as a hard cap regardless of streaks. Direction is
 * re-evaluated before each trade via getAutoDirection so it can follow
 * updated digit stats mid-run. A stop condition only blocks *future*
 * trades - a trade already placed is left to settle normally.
 */
export function useBulkTrading(config: BulkRunnerConfig): UseBulkTradingResult {
    const [isRunning, setIsRunning] = useState(false);
    const [trades, setTrades] = useState<BulkTradeRecord[]>([]);
    const [wins, setWins] = useState(0);
    const [losses, setLosses] = useState(0);
    const [totalProfit, setTotalProfit] = useState(0);
    const [consecutiveLosses, setConsecutiveLosses] = useState(0);
    const [stopReason, setStopReason] = useState<string | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);

    // Refs mirror the state above so the async run loop always reads the
    // latest values without needing to be re-created (and without stale
    // closures) on every state update.
    const stopRequestedRef = useRef(false);
    const runTokenRef = useRef(0);
    const configRef = useRef(config);
    configRef.current = config;

    // Dedicated tick subscription purely for pacing ("wait for next tick"),
    // decoupled from whatever hook is driving the visible digit stats -
    // same one-connection-per-feature pattern already used elsewhere in
    // this app (Dashboard, AIScanner, tick-analyser each manage their own).
    const wsRef = useRef<WebSocket | null>(null);
    const tickResolversRef = useRef<Array<() => void>>([]);
    const currentSymbolRef = useRef(config.symbol);

    useEffect(() => {
        currentSymbolRef.current = config.symbol;
    }, [config.symbol]);

    useEffect(() => {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({ ticks: currentSymbolRef.current, subscribe: 1 }));
        };

        ws.onmessage = event => {
            try {
                const data = JSON.parse(event.data);
                if (data.tick) {
                    const resolvers = tickResolversRef.current;
                    tickResolversRef.current = [];
                    resolvers.forEach(resolve => resolve());
                }
            } catch {
                // ignore malformed frames
            }
        };

        return () => {
            ws.close();
            wsRef.current = null;
        };
        // Only resubscribe if the symbol actually changes - re-created via key prop upstream if needed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.symbol]);

    const waitForNextTick = useCallback(
        () =>
            new Promise<void>(resolve => {
                tickResolversRef.current.push(resolve);
            }),
        []
    );

    const stop = useCallback((reason?: string) => {
        stopRequestedRef.current = true;
        setIsRunning(false);
        setStopReason(reason ?? 'Stopped manually');
    }, []);

    const start = useCallback(
        (initialDirection: TDigitDirection) => {
            const myToken = ++runTokenRef.current;
            stopRequestedRef.current = false;
            setIsRunning(true);
            setStopReason(null);
            setLastError(null);
            setTrades([]);
            setWins(0);
            setLosses(0);
            setTotalProfit(0);
            setConsecutiveLosses(0);

            let localWins = 0;
            let localLosses = 0;
            let localProfit = 0;
            let localStreak = 0;
            let localCount = 0;

            const isStale = () => runTokenRef.current !== myToken;

            const runLoop = async () => {
                while (!stopRequestedRef.current && !isStale()) {
                    const cfg = configRef.current;

                    if (localCount >= cfg.bulkCount) {
                        stop(`Reached ${cfg.bulkCount} trades`);
                        return;
                    }

                    const direction = cfg.isAuto && cfg.getAutoDirection ? cfg.getAutoDirection() : initialDirection;

                    const parameters: Record<string, number | string> = {
                        amount: cfg.stake,
                        basis: 'stake',
                        contract_type: direction,
                        currency: cfg.currency,
                        duration: cfg.ticksDuration,
                        duration_unit: 't',
                        symbol: cfg.symbol,
                    };

                    try {
                        const buy = await buyContractForUi({
                            parameters,
                            price: cfg.stake,
                            source: 'BulkTrader',
                        });

                        if (isStale()) return;

                        const settled = await streamContractUntilSettled({
                            contractId: buy.contract_id,
                            fallback: {
                                buy_price: buy.buy_price,
                                contract_type: direction,
                                currency: cfg.currency,
                                symbol: cfg.symbol,
                            },
                            source: 'BulkTrader',
                        });

                        if (isStale()) return;

                        const profit = Number(settled.profit ?? 0);
                        const isWin = profit > 0;

                        localCount += 1;
                        localProfit += profit;
                        if (isWin) {
                            localWins += 1;
                            localStreak = 0;
                        } else {
                            localLosses += 1;
                            localStreak += 1;
                        }

                        setTrades(prev => [
                            ...prev,
                            {
                                id: `${buy.contract_id ?? Date.now()}`,
                                direction,
                                stake: cfg.stake,
                                profit,
                                isWin,
                                contractId: buy.contract_id,
                            },
                        ]);
                        setWins(localWins);
                        setLosses(localLosses);
                        setTotalProfit(localProfit);
                        setConsecutiveLosses(localStreak);

                        if (localStreak >= LOSS_STREAK_LIMIT) {
                            stop(`Stopped after ${LOSS_STREAK_LIMIT} consecutive losses`);
                            return;
                        }

                        if (
                            cfg.isAuto &&
                            cfg.profitTarget !== undefined &&
                            cfg.profitTarget > 0 &&
                            localProfit >= cfg.profitTarget
                        ) {
                            stop(`Reached profit target of ${cfg.profitTarget} ${cfg.currency}`);
                            return;
                        }

                        if (localCount >= cfg.bulkCount) {
                            stop(`Reached ${cfg.bulkCount} trades`);
                            return;
                        }
                    } catch (err) {
                        if (isStale()) return;
                        setLastError(err instanceof Error ? err.message : 'Bulk Trader could not place this trade.');
                        stop('Stopped due to an error');
                        return;
                    }

                    if (stopRequestedRef.current || isStale()) return;
                    await waitForNextTick();
                }
            };

            void runLoop();
        },
        [stop, waitForNextTick]
    );

    // Stop any in-flight run loop on unmount by invalidating its token.
    useEffect(() => {
        return () => {
            runTokenRef.current += 1;
            stopRequestedRef.current = true;
        };
    }, []);

    return {
        isRunning,
        trades,
        tradesCompleted: trades.length,
        wins,
        losses,
        totalProfit,
        consecutiveLosses,
        stopReason,
        lastError,
        start,
        stop: () => stop('Stopped manually'),
    };
}
