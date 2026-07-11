import React, { useEffect, useState } from 'react';
import './app-loader.scss';

interface AppLoaderProps {
    onLoadingComplete: () => void;
    duration?: number;
}

const LOADING_STEPS = ['Connecting…', 'Loading Charts', 'Loading Blockly', 'Initializing Bots', 'Ready'];

const AppLoader: React.FC<AppLoaderProps> = ({ onLoadingComplete, duration }) => {
    const [progress, setProgress] = useState(0);
    const [stepIndex, setStepIndex] = useState(0);
    const [fading, setFading] = useState(false);

    const DURATION = duration || 6000;

    useEffect(() => {
        const step = DURATION / 100;
        const interval = setInterval(() => {
            setProgress(prev => {
                const next = prev + 1;
                const si = Math.min(LOADING_STEPS.length - 1, Math.floor(next / (100 / LOADING_STEPS.length)));
                setStepIndex(si);
                if (next >= 100) {
                    clearInterval(interval);
                    setFading(true);
                    setTimeout(onLoadingComplete, 500);
                }
                return next;
            });
        }, step);
        return () => clearInterval(interval);
    }, [onLoadingComplete]);

    return (
        <div className={`ph-loader${fading ? ' ph-loader--fading' : ''}`}>
            {/* animated grid bg */}
            <div className='ph-loader__grid' />
            {/* radial glow orbs */}
            <div className='ph-loader__orb ph-loader__orb--1' />
            <div className='ph-loader__orb ph-loader__orb--2' />

            <div className='ph-loader__card'>
                {/* Logo */}
                <div className='ph-loader__logo'>
                    <div className='ph-loader__logo-icon'>
                        <svg viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'>
                            <rect x='5'  y='24' width='7' height='11' rx='2' fill='#00b8ad'/>
                            <rect x='17' y='16' width='7' height='19' rx='2' fill='#22d3ee'/>
                            <rect x='29' y='6'  width='7' height='29' rx='2' fill='#00b8ad'/>
                            <polyline points='8,24 20,15 32,6' stroke='#ffffff' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'/>
                        </svg>
                    </div>
                    <div className='ph-loader__logo-text'>
                        profit<span>hub</span>
                    </div>
                </div>

                <p className='ph-loader__tagline'>Automated Precision Trading Platform</p>

                {/* Tiles */}
                <div className='ph-loader__tiles'>
                    {[
                        { icon: '🤖', label: 'Free Bots' },
                        { icon: '🧠', label: 'AI Bots' },
                        { icon: '📊', label: 'Analysis' },
                        { icon: '✨', label: 'Smart AI' },
                        { icon: '📄', label: 'Copy Trade' },
                        { icon: '📡', label: 'Signals' },
                    ].map((t, i) => (
                        <div key={t.label} className='ph-loader__tile' style={{ animationDelay: `${i * 0.18}s` }}>
                            <div className='ph-loader__tile-icon'>{t.icon}</div>
                            <div className='ph-loader__tile-label'>{t.label}</div>
                        </div>
                    ))}
                </div>

                {/* Progress */}
                <div className='ph-loader__progress'>
                    <div className='ph-loader__progress-track'>
                        <div className='ph-loader__progress-fill' style={{ width: `${progress}%` }} />
                        <div className='ph-loader__progress-shine' />
                    </div>
                    <div className='ph-loader__progress-row'>
                        <span className='ph-loader__step-text'>{LOADING_STEPS[stepIndex]}</span>
                        <span className='ph-loader__pct'>{progress}%</span>
                    </div>
                </div>

                {/* Steps dots */}
                <div className='ph-loader__steps'>
                    {LOADING_STEPS.map((s, i) => (
                        <div key={s} className={`ph-loader__dot${i < stepIndex ? ' ph-loader__dot--done' : ''}${i === stepIndex ? ' ph-loader__dot--active' : ''}`} />
                    ))}
                </div>

                <div className='ph-loader__footer'>© 2025 ProfitHub. Powered by Deriv.</div>
            </div>
        </div>
    );
};

export default AppLoader;
