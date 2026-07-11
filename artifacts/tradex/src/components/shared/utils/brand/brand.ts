import config_data from '../../../../../brand.config.json';

type TLogoConfig = {
    type: string;
    component_name?: string;
    alt_text?: string;
    link_url?: string;
    show_text?: boolean;
    text?: string;
};

type TPlatform = {
    name: string;
    logo?: TLogoConfig | string;
};

const isDomainAllowed = (domain_name: string) => {
    const custom_domains = [
        'riskmanagers.site',
        'termicafx.site',
        'mrzetuzetu.site',
        'masterhunter.site',
        'tradinghubs.site',
        'mafiahub.site',
    ];

    const hostname = domain_name.split(':')[0].toLowerCase();
    if (custom_domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))) {
        return true;
    }

    // This regex will match any official deriv production and testing domain names.
    // Allowed deriv domains: localhost, binary.sx, binary.com, deriv.com, deriv.be, deriv.me and their subdomains.
    return /^(((.*)\.)?(localhost|pages.dev|binary\.(sx|com)|deriv.(com|me|be|dev)))$/.test(hostname);
};

export const getBrandWebsiteName = () => {
    return config_data.domain_name;
};

const getHostBaseName = (hostname?: string) => {
    let host = hostname || (typeof window !== 'undefined' ? window.location.hostname : config_data.domain_name);
    if (!host) return config_data.brand_name;

    host = host
        .toLowerCase()
        .split(':')[0]
        .replace(/^www\./, '');
    const parts = host.split('.');
    let base = parts.length > 2 ? parts[parts.length - 2] : parts[0];
    if (base === 'localhost') return 'localhost';

    base = base.replace(/hub$/i, '');
    base = base.replace(/[^a-z0-9]+/g, ' ').trim();
    return base || config_data.brand_name;
};

const formatBrandDisplay = (base: string) =>
    base
        .split(/[^a-z0-9]+/i)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

export const getBrandLabel = () => {
    return `${formatBrandDisplay(getHostBaseName())} Trading Hub`;
};

export const getBrandTitle = () => {
    return `${getHostBaseName().replace(/\s+/g, ' ').toUpperCase()} TRADING HUB`;
};

export const getPlatformConfig = (): TPlatform => {
    const allowed_config_data = { ...config_data.platform };

    if (!isDomainAllowed(window.location.host)) {
        // Remove all official platform logos if the app is hosted under unofficial domain
        allowed_config_data.logo = undefined;
    }

    return allowed_config_data;
};
