import React, { useEffect, useState } from 'react';
import Button from '@/components/shared_ui/button';
import Modal from '@/components/shared_ui/modal';
import Text from '@/components/shared_ui/text';
import { localize } from '@deriv-com/translations';
import './risk-disclaimer.scss';

const SESSION_STORAGE_KEY = 'riskDisclaimerHidden';

const RiskDisclaimer = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isHidden, setIsHidden] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsHidden(sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true');
        }
    }, []);

    const handleOpenModal = () => setIsModalOpen(true);
    const handleCloseModal = () => setIsModalOpen(false);

    const handleDontShowAgain = () => {
        if (typeof window !== 'undefined') {
            sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
        }
        setIsHidden(true);
        setIsModalOpen(false);
    };

    if (isHidden) {
        return null;
    }

    return (
        <>
            {/* Static bottom-left link -- fixed in place, no drag, no animation */}
            <button type='button' className='risk-disclaimer-link' onClick={handleOpenModal}>
                {localize('⚠ Risk Disclaimer')}
            </button>

            <Modal
                is_open={isModalOpen}
                title={localize('Risk Disclaimer')}
                onClose={handleCloseModal}
                width='520px'
                className='risk-disclaimer-modal'
            >
                <div className='risk-disclaimer-modal__content'>
                    <Text size='xs' color='general' className='risk-disclaimer-modal__text'>
                        {localize(
                            'Deriv offers complex derivatives, such as options and contracts for difference ("CFDs"). These products may not be suitable for all clients, and trading them puts you at risk. Please make sure that you understand the following risks before trading Deriv products:'
                        )}
                    </Text>

                    <div className='risk-disclaimer-modal__points'>
                        <div className='risk-disclaimer-modal__point'>
                            <span>•</span>
                            <Text size='xs' color='general'>
                                {localize('You may lose some or all of the money you invest in the trade.')}
                            </Text>
                        </div>
                        <div className='risk-disclaimer-modal__point'>
                            <span>•</span>
                            <Text size='xs' color='general'>
                                {localize(
                                    'If your trade involves currency conversion, exchange rates will affect your profit and loss.'
                                )}
                            </Text>
                        </div>
                    </div>

                    <Text size='xs' color='general' className='risk-disclaimer-modal__footer'>
                        {localize('You should never trade with borrowed money or with money that you cannot afford to lose.')}
                    </Text>

                    <div className='risk-disclaimer-modal__actions'>
                        <Button
                            className='risk-disclaimer-modal__dont-show-btn'
                            onClick={handleDontShowAgain}
                            secondary
                        >
                            {localize("Dont Show Again")}
                        </Button>
                        <Button className='risk-disclaimer-modal__close-btn' onClick={handleCloseModal} primary>
                            {localize('Close')}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default RiskDisclaimer;
