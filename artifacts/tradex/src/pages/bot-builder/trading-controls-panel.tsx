import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import ToggleSwitch from '@/components/shared_ui/toggle-switch';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import './trading-controls-panel.scss';

type TTradingControlsPanelProps = {
    className?: string;
    compact?: boolean;
    showSpeedMode?: boolean;
};

const TradingControlsPanel = observer(
    ({ className, compact = false, showSpeedMode = true }: TTradingControlsPanelProps) => {
    const { toolbar } = useStore();
    const { speed_mode_enabled, setSpeedModeEnabled } = toolbar;

    if (!showSpeedMode) return null;

    return (
        <div className={classNames('bot-builder-trading-controls', className, { compact })}>
            <div className='bot-builder-trading-controls__section bot-builder-trading-controls__section--accent'>
                <div className='bot-builder-trading-controls__row'>
                    <span className='bot-builder-trading-controls__label'>{localize('Speed mode')}</span>
                    <ToggleSwitch
                        id='bot-builder-speed-mode-toggle'
                        is_enabled={speed_mode_enabled}
                        handleToggle={() => setSpeedModeEnabled(!speed_mode_enabled)}
                        name='speed_mode_toggle'
                    />
                </div>
                <p>{localize('Executes every tick without skipping any trades.')}</p>
            </div>
        </div>
    );
});

export default TradingControlsPanel;
