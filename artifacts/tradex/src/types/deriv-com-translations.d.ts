declare module '@deriv-com/translations' {
    import type { ComponentType, PropsWithChildren, ReactNode } from 'react';

    export type LocalizeProps = {
        i18n_default_text: string;
        [key: string]: any;
    };

    export function localize(text: string, replacements?: Record<string, string | number>): string;
    export function initializeI18n(language: string): void;
    export function getInitialLanguage(): string;
    export function getAllowedLanguages(): string[];
    export function loadIncontextTranslation(path: string): Promise<void>;
    export function useTranslations(): Record<string, any>;

    export const Localize: ComponentType<LocalizeProps>;
    export const TranslationProvider: ComponentType<PropsWithChildren<unknown>>;
}
