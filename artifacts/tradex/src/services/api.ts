import { API_BASE } from '@/utils/api-base';

const handleJson = async (res: Response) => {
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText || 'API error');
    }
    return res.json();
};

export const statsAPI = {
    getAll: () => fetch(`${API_BASE}/best-bot-stats`).then(handleJson),
    getById: (id: string) => fetch(`${API_BASE}/best-bot-stats/${id}`).then(handleJson),
    update: (id: string, data: any) =>
        fetch(`${API_BASE}/best-bot-stats/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }).then(handleJson),
};

export const aiAPI = {
    generateStrategy: (strategyText: string) =>
        fetch(`${API_BASE}/ai/auto-trade-strategy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ strategyText }),
        }).then(handleJson),
};

export const exchangeRatesAPI = {
    getUsdKes: () => fetch(`${API_BASE}/exchange-rates/usd-kes`).then(handleJson),
};

export default {
    statsAPI,
    aiAPI,
    exchangeRatesAPI,
};
