// Removed unused React import - React 17+ JSX transform doesn't require it
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '@/hooks/useStore';

interface ChartWrapperProps {
    prefix?: string;
    show_digits_stats?: boolean;
}

// This renders the standalone charts.tradexpro.co.ke deployment in an iframe.
// The old native chart implementation (chart.tsx, chart.scss, toolbar-widgets.tsx)
// has been deleted entirely - it was broken (crashed on useStore() in trees
// without a StoreProvider) and is fully superseded by this iframe approach.
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
