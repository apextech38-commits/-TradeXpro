type TBrandLogoProps = {
    width?: number;
    height?: number;
    fill?: string;
    className?: string;
};

export const BrandLogo = ({ className = '' }: TBrandLogoProps) => {
    return (
        <div className={`flex items-center gap-2 ${className}`} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <svg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg' style={{ filter: 'drop-shadow(0 0 8px rgba(0, 184, 173, 0.4))' }}>
                <defs>
                    <linearGradient id='logo-grad' x1='0%' y1='0%' x2='100%' y2='100%'>
                        <stop offset='0%' stopColor='#22d3ee' />
                        <stop offset='100%' stopColor='#00b8ad' />
                    </linearGradient>
                </defs>
                <rect width='32' height='32' rx='8' fill='url(#logo-grad)'/>
                <rect x='7' y='16' width='4' height='8' rx='1' fill='white'/>
                <rect x='14' y='11' width='4' height='13' rx='1' fill='white'/>
                <rect x='21' y='6' width='4' height='18' rx='1' fill='white'/>
                <path d='M7 16L14 11L21 6' stroke='white' strokeWidth='2' strokeLinecap='round'/>
            </svg>
            <span style={{ 
                fontWeight: '800', 
                fontSize: '1.4rem', 
                letterSpacing: '0.5px',
                color: 'var(--text-prominent)',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
                profit<span style={{ color: '#00b8ad' }}>hub</span>
            </span>
        </div>
    );
};
