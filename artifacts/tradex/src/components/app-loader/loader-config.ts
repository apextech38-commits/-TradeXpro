// App Loader Configuration
// Customize your loader settings here

export const LOADER_CONFIG = {
    // Duration in milliseconds (6000 = 6 seconds)
    DURATION: 6000,

    // Whether to show the loader (useful for development vs production)
    ENABLED: true,

    // App branding
    BRANDING: {
        title: 'Duke Trading Academy',
        subtitle: 'Trading Bot Platform',
    },

    // Environment-specific settings
    ENVIRONMENT: {
        // Show loader only in production
        PRODUCTION_ONLY: false,

        // Different durations for different environments
        DEVELOPMENT_DURATION: 3000, // 3 seconds in development
        PRODUCTION_DURATION: 6000, // 6 seconds in production
    },

    // Animation settings
    ANIMATION: {
        FADE_IN_DURATION: 500, // ms
        FADE_OUT_DURATION: 300, // ms
        PROGRESS_UPDATE_INTERVAL: 100, // ms
    },
};

// Helper function to get duration based on environment
export const getLoaderDuration = (): number => {
    if (LOADER_CONFIG.ENVIRONMENT.PRODUCTION_ONLY && process.env.NODE_ENV !== 'production') {
        return 0; // Skip loader in development
    }

    if (process.env.NODE_ENV === 'development') {
        return LOADER_CONFIG.ENVIRONMENT.DEVELOPMENT_DURATION;
    }

    return LOADER_CONFIG.ENVIRONMENT.PRODUCTION_DURATION;
};

// Helper function to check if loader should be enabled
export const isLoaderEnabled = (): boolean => {
    if (LOADER_CONFIG.ENVIRONMENT.PRODUCTION_ONLY && process.env.NODE_ENV !== 'production') {
        return false;
    }

    return LOADER_CONFIG.ENABLED;
};
