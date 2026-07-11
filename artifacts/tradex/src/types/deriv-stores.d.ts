declare module '@deriv/stores/types' {
    export type TNotificationMessage = {
        key?: string;
        header?: string;
        message?: string;
        type?: string;
        is_persistent?: boolean;
        action?: {
            text?: string;
            onClick?: () => void;
        };
        platform?: string;
        is_disposable?: boolean;
    };

    export type TStores = {
        client: any;
        common: {
            server_time: any;
        };
    };
}
