// Removed unused React import - React 17+ JSX transform doesn't require it
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '@/hooks/useStore';
import './chart.scss';

interface ChartWrapperProps {
    prefix?: string;
    show_digits_stats: boolean;
}

// TEMP: iframing the standalone charts.tradexpro.co.ke deployment here instead
// of the native <Chart /> component while the native integration is being
// worked on separately. Swap back to `import Chart from './chart'` +
// `<Chart key={uniqueKey} show_digits_stats={show_digits_stats} />` once
// that's ready.
const ChartWrapper = observer(({ prefix = 'chart', show_digits_stats: _show_digits_stats }: ChartWrapperProps) => {
    const { client } = useStore();
    const [uuid] = useState(uuidv4());

    const uniqueKey = client.loginid ? `${prefix}-${client.loginid}` : `${prefix}-${uuid}`;

    return (
        <iframe
            key={uniqueKey}
            src='https://charts.tradexpro.co.ke'
            title='TradeXpro Charts'
            style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
            }}
            allow='fullscreen'
        />
    );
});

export default ChartWrapper;
