import React from 'react';
import OpenLiveChatLink from '@/components/shared_ui/open-livechat-link';
import './chats.scss';

const Chats = () => {
    return (
        <div className='chats-page'>
            <header className='chats-header'>
                <h2>Support & Chats</h2>
                <p>If you need help, open the live chat window below.</p>
            </header>

            <div className='chats-content'>
                <OpenLiveChatLink className='open-chat-btn'>Open Live Chat</OpenLiveChatLink>
            </div>
        </div>
    );
};

export default Chats;
