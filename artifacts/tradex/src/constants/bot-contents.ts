type TTabsTitle = {
    [key: string]: string | number;
};

type TDashboardTabIndex = {
    [key: string]: number;
};

export const tabs_title: TTabsTitle = Object.freeze({
    WORKSPACE: 'Workspace',
    CHART: 'Chart',
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    DASHBOARD: 0,
    BOT_BUILDER: 1,
    AUTO_TRADES: 2,
    MANUAL_TRADING: 3,
    SCANNER: 4,
    ANALYSIS_TOOL: 5,
    DTRADER: 6,
    MATCHES: 7,
    CHART: 8,
    TRADING_BOTS: 9,
    STRATEGIES: 10,
    COPY_TRADING: 11,
    TRADINGVIEW: 12,
    SPEEDBOT: 13,
    HYBRID_BOTS: 14,
    CHATS: 15,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-auto-trades',
    'id-manual-trading',
    'id-scanner',
    'id-analysistool',
    'id-dtrader',
    'id-matches',
    'id-chart',
    'id-trading-bots',
    'id-strategies',
    'id-copy-trading',
    'id-tradingview',
    'id-speedbot',
    'id-hybrid-bots',
    'id-chats',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
