export {};

declare global {
    interface LiveChatWidgetInterface {
        init: () => void;
        on: (eventName: string, callback: (data: any) => void) => void;
        call: (method: string, ...args: any[]) => void;
    }

    interface Window {
        LiveChatWidget?: LiveChatWidgetInterface;
    }
}
