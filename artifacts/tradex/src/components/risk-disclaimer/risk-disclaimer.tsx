import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './risk-disclaimer.scss';

const SESSION_STORAGE_KEY = 'riskDisclaimerHidden';

// Rendered via createPortal straight into document.body. Every previous
// version of this component rendered in-place wherever <RiskDisclaimer />
// happened to sit in the app's own DOM tree, and relied on the shared
// Modal component's position:absolute centering. That centering resolves
// against the nearest *positioned* ancestor -- not necessarily the
// viewport -- so depending on which page it was mounted under, the dialog
// could center itself relative to some unrelated ancestor box and land
// off-screen, while the (correctly fixed-position) backdrop still covered
// the viewport. A portal to document.body sidesteps all of that.
//
// Also deliberately NOT using localize() from @deriv-com/translations here.
// App.tsx (where this mounts) has no TranslationProvider/I18nextProvider
// anywhere above it in the tree -- every other localize() usage in this
// codebase lives deep inside the legacy BotBuilder subsystem, which sets
// up its own i18n context internally further down. Without that context,
// localize() calls at this mount point were very likely returning empty
// strings, not just rendering invisible text -- which matches the "still
// blank" report even after the color fix. Plain strings sidestep that
// dependency entirely, consistent with this component being self-contained.
const RiskDisclaimer: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isHidden, setIsHidden] = useState(false);

    useEffect(() => {
        if (sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true') setIsHidden(true);
    }, []);

    useEffect(() => {
        if (!isOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [isOpen]);

    const handleDontShowAgain = () => {
        sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
        setIsHidden(true);
        setIsOpen(false);
    };

    if (isHidden) return null;

    return createPortal(
        <>
            <button
                type='button'
                className='risk-disclaimer-trigger'
                onClick={() => setIsOpen(true)}
            >
                Risk Disclaimer
            </button>

            {isOpen && (
                <div
                    className='risk-disclaimer-overlay'
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        className='risk-disclaimer-dialog'
                        role='dialog'
                        aria-modal='true'
                        aria-labelledby='risk-disclaimer-title'
                        onClick={event => event.stopPropagation()}
                    >
                        <button
                            type='button'
                            className='risk-disclaimer-dialog__close'
                            aria-label='Close'
                            onClick={() => setIsOpen(false)}
                        >
                            &times;
                        </button>

                        <h2 id='risk-disclaimer-title' className='risk-disclaimer-dialog__title'>
                            Important Risk Warning
                        </h2>

                        <p className='risk-disclaimer-dialog__text'>
                            Deriv offers complex derivatives, such as options and contracts for difference
                            (&quot;CFDs&quot;). These products are complex and may not be suitable for all
                            clients. Trading them carries risk, and you should understand the risks before
                            trading.
                        </p>

                        <ul className='risk-disclaimer-dialog__points'>
                            <li>You may lose some or all of the money you invest in a trade.</li>
                            <li>
                                If your trade involves currency conversion, exchange rates will affect your
                                profit and loss.
                            </li>
                            <li>
                                You should never trade with borrowed money or with funds you cannot afford
                                to lose.
                            </li>
                        </ul>

                        <p className='risk-disclaimer-dialog__footer'>
                            Always trade responsibly and only with money that you can afford to lose.
                        </p>

                        <div className='risk-disclaimer-dialog__actions'>
                            <button
                                type='button'
                                className='risk-disclaimer-dialog__btn risk-disclaimer-dialog__btn--primary'
                                onClick={() => setIsOpen(false)}
                            >
                                I Understand
                            </button>
                            <button
                                type='button'
                                className='risk-disclaimer-dialog__btn risk-disclaimer-dialog__btn--secondary'
                                onClick={handleDontShowAgain}
                            >
                                Don&apos;t Show Again
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>,
        document.body
    );
};

export default RiskDisclaimer;
